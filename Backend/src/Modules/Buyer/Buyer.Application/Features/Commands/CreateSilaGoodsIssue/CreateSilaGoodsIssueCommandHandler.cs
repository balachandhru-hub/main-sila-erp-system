using Microsoft.EntityFrameworkCore;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaGoodsIssue
{
    /// <summary>
    /// Issues stock from a store to an outlet of the same property. Posted at once: GOODS_ISSUE_OUT at the store,
    /// GOODS_ISSUE_IN at the outlet, and the issue is queued for the ERP.
    /// </summary>
    public class CreateSilaGoodsIssueCommandHandler : IRequestHandler<CreateSilaGoodsIssueCommand, Guid>
    {
        private const int MAX_LINES = 500;
        private const int MAX_UOM_LENGTH = 20;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaGoodsIssueCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(CreateSilaGoodsIssueCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaGoodsIssueCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(CreateSilaGoodsIssueCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating goods issue. OrganizationId: {request.OrganizationId}, From: {request.Request.FromLocationId}, To: {request.Request.ToLocationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation from = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.Request.FromLocationId);
            InventoryLocation to = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.Request.ToLocationId);
            ValidateLocations(from, to);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, from.Id, cancellationToken);

            List<SilaGoodsIssueLineWriteDto> lines = request.Request.Items ?? new List<SilaGoodsIssueLineWriteDto>();
            ValidateLines(lines);
            SilaInputRules.MaxLength(_logger, request.Request.Comment, SilaInputRules.COMMENT_LENGTH, "Comment");

            if (request.Request.WeeklyBucketId != null)
            {
                Guid bucketId = request.Request.WeeklyBucketId.Value;
                bool bucketExists = await _repository.WeeklyBucket
                    .FindByCondition(x => x.Id == bucketId && x.BuyerId == buyer.Id && x.PropertyId == from.PropertyId)
                    .AnyAsync(cancellationToken);
                if (!bucketExists)
                {
                    _logger.LogError($"Weekly bucket not found. WeeklyBucketId: {bucketId}, BuyerId: {buyer.Id}");
                    throw new NotFoundCustomException("Weekly bucket not found.", "Load the lines from the weekly bucket again.");
                }
            }

            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, lines.Select(x => x.MaterialId), cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Keys, cancellationToken);

            string issueNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.GOODS_ISSUE, 6, cancellationToken);
            GoodsIssue issue = new GoodsIssue
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                IssueNumber = issueNumber,
                FromLocationId = from.Id,
                ToLocationId = to.Id,
                WeeklyBucketId = request.Request.WeeklyBucketId,
                IssuedBy = request.UserId,
                Comment = request.Request.Comment?.Trim(),
                IsActive = true
            };
            _repository.GoodsIssue.Create(issue);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            foreach (SilaGoodsIssueLineWriteDto line in lines)
            {
                ItemBuyerMaster material = materials[line.MaterialId];
                string baseUom = UomConverter.BaseUomOf(material);
                string enteredUom = string.IsNullOrWhiteSpace(line.Uom) ? baseUom : line.Uom.Trim().ToUpperInvariant();
                decimal baseQuantity = UomConverter.ToBase(_logger, material, line.Quantity, enteredUom, conversions);
                _repository.GoodsIssueItem.Create(new GoodsIssueItem
                {
                    Id = Guid.NewGuid(),
                    GoodsIssueId = issue.Id,
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    MaterialName = material.Description ?? material.MaterialCode ?? string.Empty,
                    Quantity = line.Quantity,
                    Uom = enteredUom,
                    BaseQuantity = baseQuantity,
                    IsActive = true
                });

                await ledger.PostAsync(Movement(issue, from.Id, material, Common.SILA_DIRECTION_OUT, Common.SILA_TXN_GOODS_ISSUE_OUT, baseQuantity, line.Quantity, enteredUom), cancellationToken);
                await ledger.PostAsync(Movement(issue, to.Id, material, Common.SILA_DIRECTION_IN, Common.SILA_TXN_GOODS_ISSUE_IN, baseQuantity, line.Quantity, enteredUom), cancellationToken);
            }

            ledger.QueueErpPosting(Common.SILA_REF_GOODS_ISSUE, issue.Id, issue.IssueNumber, from.Id, Common.SILA_MOVEMENT_GOODS_ISSUE);
            await _repository.SaveAsync();

            _logger.LogInfo($"Goods issue posted. GoodsIssueId: {issue.Id}, IssueNumber: {issue.IssueNumber}, Lines: {lines.Count}");
            return issue.Id;
        }

        private void ValidateLocations(InventoryLocation from, InventoryLocation to)
        {
            if (from.LocationType != Common.SILA_LOCATION_STORE)
            {
                _logger.LogError($"Goods issue source is not a store. LocationId: {from.Id}");
                throw new BadRequestCustomException("Goods are issued from a store.", "Select a store location as the source.");
            }

            if (to.LocationType != Common.SILA_LOCATION_OUTLET)
            {
                _logger.LogError($"Goods issue destination is not an outlet. LocationId: {to.Id}");
                throw new BadRequestCustomException("Goods are issued to an outlet.", "Select an outlet location as the destination.");
            }

            if (from.PropertyId != to.PropertyId)
            {
                _logger.LogError($"Cross-property goods issue. From: {from.Id} ({from.PropertyId}), To: {to.Id} ({to.PropertyId})");
                throw new BadRequestCustomException("Goods issues across properties are not allowed.", "Select a store and an outlet of the same property.");
            }
        }

        private void ValidateLines(List<SilaGoodsIssueLineWriteDto> lines)
        {
            SilaInputRules.Lines(_logger, lines, MAX_LINES, "material");
            foreach (SilaGoodsIssueLineWriteDto line in lines)
            {
                SilaInputRules.PositiveQuantity(_logger, line.Quantity, "quantity");
                SilaInputRules.MaxLength(_logger, line.Uom, MAX_UOM_LENGTH, "Unit of measure");
            }

            if (lines.GroupBy(x => x.MaterialId).Any(x => x.Count() > 1))
            {
                _logger.LogError("Goods issue has the same material twice.");
                throw new BadRequestCustomException("A material appears more than once.", "Combine the quantities of the same material in one line.");
            }
        }

        private static InventoryMovement Movement(
            GoodsIssue issue, Guid locationId, ItemBuyerMaster material, string direction, string type, decimal baseQuantity, decimal enteredQuantity, string enteredUom)
        {
            return new InventoryMovement
            {
                LocationId = locationId,
                Material = material,
                Direction = direction,
                TransactionType = type,
                BaseQuantity = baseQuantity,
                EnteredQuantity = enteredQuantity,
                EnteredUom = enteredUom,
                ReferenceType = Common.SILA_REF_GOODS_ISSUE,
                ReferenceId = issue.Id,
                ReferenceNumber = issue.IssueNumber,
                Reason = issue.Comment
            };
        }
    }
}
