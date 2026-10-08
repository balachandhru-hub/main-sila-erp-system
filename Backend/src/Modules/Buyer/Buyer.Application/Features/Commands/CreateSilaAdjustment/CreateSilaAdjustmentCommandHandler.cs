using Microsoft.EntityFrameworkCore;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaAdjustment
{
    /// <summary>
    /// Posts a stock adjustment at once: opening stock (in), waste / damage / breakage / spoilage / expired (out),
    /// or a manual adjustment (signed quantity). Every type except opening stock is queued for the ERP.
    /// </summary>
    public class CreateSilaAdjustmentCommandHandler : IRequestHandler<CreateSilaAdjustmentCommand, Guid>
    {
        private const string TYPE_WASTE = "WASTE";
        private const string TYPE_DAMAGE = "DAMAGE";
        private const string TYPE_BREAKAGE = "BREAKAGE";
        private const string TYPE_SPOILAGE = "SPOILAGE";
        private const string TYPE_EXPIRED = "EXPIRED";

        private static readonly string[] OutTypes = { TYPE_WASTE, TYPE_DAMAGE, TYPE_BREAKAGE, TYPE_SPOILAGE, TYPE_EXPIRED };

        private const int MAX_LINES = 500;
        private const int MAX_UOM_LENGTH = 20;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaAdjustmentCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(CreateSilaAdjustmentCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaAdjustmentCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(CreateSilaAdjustmentCommand request, CancellationToken cancellationToken)
        {
            string type = (request.Request.AdjustmentType ?? string.Empty).Trim().ToUpperInvariant();
            _logger.LogInfo($"Creating stock adjustment. OrganizationId: {request.OrganizationId}, LocationId: {request.Request.LocationId}, Type: {type}");

            bool opening = type == Common.SILA_TXN_OPENING_STOCK;
            bool manual = type == Common.SILA_TXN_MANUAL_ADJUSTMENT;
            if (!opening && !manual && !OutTypes.Contains(type))
            {
                _logger.LogError($"Unknown adjustment type. Type: {request.Request.AdjustmentType}");
                throw new BadRequestCustomException(
                    "Unknown adjustment type.",
                    "Use OPENING_STOCK, WASTE, DAMAGE, BREAKAGE, SPOILAGE, EXPIRED or MANUAL_ADJUSTMENT.");
            }

            string? reason = request.Request.Reason?.Trim();
            if (!opening && string.IsNullOrWhiteSpace(reason))
            {
                _logger.LogError($"Adjustment reason is missing. Type: {type}");
                throw new BadRequestCustomException("A reason is required.", "Enter why the stock is adjusted.");
            }

            SilaInputRules.MaxLength(_logger, reason, SilaInputRules.COMMENT_LENGTH, "Reason");
            List<SilaAdjustmentLineWriteDto> lines = request.Request.Items ?? new List<SilaAdjustmentLineWriteDto>();
            ValidateLines(lines, manual);

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.Request.LocationId);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, location.Id, cancellationToken);

            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, lines.Select(x => x.MaterialId), cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Keys, cancellationToken);

            string adjustmentNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.ADJUSTMENT, 6, cancellationToken);
            StockAdjustment adjustment = new StockAdjustment
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                AdjustmentNumber = adjustmentNumber,
                LocationId = location.Id,
                AdjustmentType = type,
                Reason = reason,
                PostedBy = request.UserId,
                IsActive = true
            };
            _repository.StockAdjustment.Create(adjustment);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            foreach (SilaAdjustmentLineWriteDto line in lines)
            {
                ItemBuyerMaster material = materials[line.MaterialId];
                string baseUom = UomConverter.BaseUomOf(material);
                string enteredUom = string.IsNullOrWhiteSpace(line.Uom) ? baseUom : line.Uom.Trim().ToUpperInvariant();
                decimal baseQuantity = UomConverter.ToBase(_logger, material, line.Quantity, enteredUom, conversions);
                _repository.StockAdjustmentItem.Create(new StockAdjustmentItem
                {
                    Id = Guid.NewGuid(),
                    StockAdjustmentId = adjustment.Id,
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    MaterialName = material.Description ?? material.MaterialCode ?? string.Empty,
                    Quantity = line.Quantity,
                    Uom = enteredUom,
                    BaseQuantity = baseQuantity,
                    UnitCost = line.UnitCost,
                    IsActive = true
                });

                string direction = opening || (manual && line.Quantity > 0) ? Common.SILA_DIRECTION_IN : Common.SILA_DIRECTION_OUT;
                await ledger.PostAsync(new InventoryMovement
                {
                    LocationId = location.Id,
                    Material = material,
                    Direction = direction,
                    TransactionType = type,
                    BaseQuantity = Math.Abs(baseQuantity),
                    EnteredQuantity = Math.Abs(line.Quantity),
                    EnteredUom = enteredUom,
                    UnitCost = line.UnitCost,
                    ReferenceType = Common.SILA_REF_ADJUSTMENT,
                    ReferenceId = adjustment.Id,
                    ReferenceNumber = adjustment.AdjustmentNumber,
                    Reason = reason
                }, cancellationToken);
            }

            if (!opening)
            {
                ledger.QueueErpPosting(Common.SILA_REF_ADJUSTMENT, adjustment.Id, adjustment.AdjustmentNumber, location.Id, Common.SILA_MOVEMENT_ADJUSTMENT);
            }

            await _repository.SaveAsync();

            _logger.LogInfo($"Stock adjustment posted. AdjustmentId: {adjustment.Id}, AdjustmentNumber: {adjustment.AdjustmentNumber}, Lines: {lines.Count}");
            return adjustment.Id;
        }

        private void ValidateLines(List<SilaAdjustmentLineWriteDto> lines, bool manual)
        {
            SilaInputRules.Lines(_logger, lines, MAX_LINES, "material");
            if (lines.Any(x => Math.Abs(x.Quantity) > SilaInputRules.MAX_QUANTITY))
            {
                _logger.LogError("Stock adjustment line quantity is above the maximum.");
                throw new BadRequestCustomException("Quantity is too large.", "Enter a quantity of at most 1,000,000,000 on every line.");
            }

            foreach (SilaAdjustmentLineWriteDto line in lines)
            {
                SilaInputRules.Price(_logger, line.UnitCost, "unit cost");
                SilaInputRules.MaxLength(_logger, line.Uom, MAX_UOM_LENGTH, "Unit of measure");
            }

            if (manual && lines.Any(x => x.Quantity == 0))
            {
                _logger.LogError("Manual adjustment line quantity is zero.");
                throw new BadRequestCustomException("Quantities cannot be zero.", "Enter a positive quantity to add stock or a negative one to remove it.");
            }

            if (!manual && lines.Any(x => x.Quantity <= 0))
            {
                _logger.LogError("Stock adjustment line quantity is not positive.");
                throw new BadRequestCustomException("Quantities must be greater than zero.", "Enter a positive quantity on every line.");
            }

            if (lines.Any(x => x.UnitCost < 0))
            {
                _logger.LogError("Stock adjustment unit cost is negative.");
                throw new BadRequestCustomException("Unit cost cannot be negative.", "Enter zero or a positive unit cost.");
            }

            if (lines.GroupBy(x => x.MaterialId).Any(x => x.Count() > 1))
            {
                _logger.LogError("Stock adjustment has the same material twice.");
                throw new BadRequestCustomException("A material appears more than once.", "Combine the quantities of the same material in one line.");
            }
        }
    }
}
