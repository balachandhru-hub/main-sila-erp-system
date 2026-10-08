using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CountSilaStockCountItem
{
    public class CountSilaStockCountItemCommandHandler : IRequestHandler<CountSilaStockCountItemCommand, SilaStockCountItemResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CountSilaStockCountItemCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaStockCountItemResultDto> Handle(CountSilaStockCountItemCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Counting stock count item. StockCountId: {request.StockCountId}, ItemId: {request.ItemId}, MaterialId: {request.Request.MaterialId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            SilaStockCountRules.EnsureInProgress(count, _logger);
            ValidateQuantities(request.Request);

            StockCountItem item;
            ItemBuyerMaster material;
            if (request.ItemId != null)
            {
                StockCountItem? found = await _repository.StockCountItem.FindFirstByConditionAsync(
                    x => x.Id == request.ItemId.Value && x.StockCountId == count.Id && x.IsActive);
                if (found == null)
                {
                    _logger.LogError($"Stock count item not found. ItemId: {request.ItemId}, StockCountId: {count.Id}");
                    throw new NotFoundCustomException("Count line not found.", "Select a material of this stock count.");
                }

                if (SilaStockCountRules.IsReopened(count) && !found.RecountRequested)
                {
                    _logger.LogError($"Line is not marked for recount. ItemId: {found.Id}, StockCountId: {count.Id}");
                    throw new BadRequestCustomException(
                        "Line is not marked for recount.",
                        $"Count {count.CountNumber} was reopened for recount. Count only the lines marked Recount.");
                }

                item = found;
                ItemBuyerMaster? lineMaterial = await _repository.ItemBuyerMaster
                    .FindByCondition(x => x.Id == item.MaterialId && x.BuyerId == buyer.Id)
                    .FirstOrDefaultAsync(cancellationToken);
                if (lineMaterial == null)
                {
                    _logger.LogError($"Material of the count line not found. MaterialId: {item.MaterialId}, ItemId: {item.Id}");
                    throw new NotFoundCustomException("Material not found.", "The material of this count line no longer exists in the Item Master.");
                }

                material = lineMaterial;
            }
            else
            {
                if (request.Request.MaterialId == null || request.Request.MaterialId == Guid.Empty)
                {
                    _logger.LogError($"Material is required to add a count line. StockCountId: {count.Id}");
                    throw new BadRequestCustomException("Material is required.", "Select the material you counted.");
                }

                if (SilaStockCountRules.IsReopened(count))
                {
                    _logger.LogError($"Material added to a reopened count. StockCountId: {count.Id}");
                    throw new BadRequestCustomException(
                        "Count is open for recount only.",
                        $"Count {count.CountNumber} was reopened for recount. Count the lines marked Recount; new materials cannot be added.");
                }

                Guid materialId = request.Request.MaterialId.Value;
                Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                    _repository, _logger, buyer.Id, new[] { materialId }, cancellationToken);
                material = materials[materialId];
                StockCountItem? existing = await _repository.StockCountItem.FindFirstByConditionAsync(
                    x => x.StockCountId == count.Id && x.MaterialId == materialId && x.IsActive);
                if (existing != null)
                {
                    item = existing;
                }
                else
                {
                    InventoryBalance? balance = await _repository.InventoryBalance
                        .FindByCondition(x => x.LocationId == count.LocationId && x.MaterialId == materialId && x.IsActive)
                        .FirstOrDefaultAsync(cancellationToken);
                    item = SilaStockCountRules.NewItem(count.Id, material, balance);
                    _repository.StockCountItem.Create(item);
                }
            }

            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, new[] { material.Id }, cancellationToken);
            decimal countedQty = UomConverter.ToBase(_logger, material, request.Request.FullQty, request.Request.FullUom, conversions);
            if (request.Request.OpenQty != null && request.Request.OpenQty.Value > 0)
            {
                countedQty += UomConverter.ToBase(_logger, material, request.Request.OpenQty.Value, request.Request.OpenUom, conversions);
            }

            SilaStockCountRules.ApplyCount(item, countedQty, SilaStockCountRules.NormalizeMethod(request.Request.Method), request.UserId);
            await _repository.SaveAsync();

            bool canSee = SilaStockCountRules.CanSeeSystemQty(count, request.RoleId);
            _logger.LogInfo($"Stock count item counted. StockCountId: {count.Id}, ItemId: {item.Id}, CountedQty: {item.CountedQty}, Status: {item.Status}");
            return new SilaStockCountItemResultDto
            {
                Item = SilaStockCountRules.MapItem(item, canSee, material.Barcode, conversions),
                Message = SilaStockCountRules.SavedMessage(item, canSee)
            };
        }

        private void ValidateQuantities(SilaStockCountItemWriteDto request)
        {
            if (request.FullQty < 0 || (request.OpenQty != null && request.OpenQty.Value < 0))
            {
                _logger.LogError($"Negative counted quantity. FullQty: {request.FullQty}, OpenQty: {request.OpenQty}");
                throw new BadRequestCustomException("Quantity cannot be negative.", "Enter the quantity you counted, 0 or more.");
            }

            SilaInputRules.NonNegativeQuantity(_logger, request.FullQty, "counted quantity");
            SilaInputRules.NonNegativeQuantity(_logger, request.OpenQty ?? 0, "open quantity");
            SilaInputRules.MaxLength(_logger, request.FullUom, SilaInputRules.CODE_LENGTH, "unit of measure");
            SilaInputRules.MaxLength(_logger, request.OpenUom, SilaInputRules.CODE_LENGTH, "open unit of measure");

            if (request.OpenQty != null && request.OpenQty.Value > 0 && string.IsNullOrWhiteSpace(request.OpenUom))
            {
                _logger.LogError("Open quantity without a unit of measure.");
                throw new BadRequestCustomException("Open quantity needs a unit.", "Select the unit of the open or partial quantity, e.g. ML.");
            }
        }
    }
}
