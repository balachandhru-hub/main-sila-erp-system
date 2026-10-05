using Microsoft.EntityFrameworkCore;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaGoodsIssueFromBucket
{
    /// <summary>
    /// Suggested goods issue lines for an outlet location: the approved quantities of the outlet's lines in the latest
    /// frozen weekly bucket of its property (lines with an Item Master material), minus what was already issued against
    /// that bucket to the location. Quantities are in the base unit of the material.
    /// </summary>
    public class GetSilaGoodsIssueFromBucketQueryHandler : IRequestHandler<GetSilaGoodsIssueFromBucketQuery, SilaGoodsIssueBucketDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaGoodsIssueFromBucketQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaGoodsIssueBucketDto> Handle(GetSilaGoodsIssueFromBucketQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching weekly bucket lines for a goods issue. OutletLocationId: {request.OutletLocationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.OutletLocationId);
            if (location.LocationType != Common.SILA_LOCATION_OUTLET || location.OutletId == null)
            {
                _logger.LogError($"Location is not an outlet. LocationId: {location.Id}");
                throw new BadRequestCustomException("Select an outlet location.", "Weekly bucket lines belong to outlets.");
            }

            await EnsureIssuerAccessAsync(buyer.Id, request, location, cancellationToken);
            Guid outletId = location.OutletId.Value;
            // Frozen buckets: everything after OPEN except a rejected bucket.
            List<string> frozen = new List<string>
            {
                Common.WEEKLY_BUCKET_PENDING_APPROVAL,
                Common.WEEKLY_BUCKET_APPROVED,
                Common.WEEKLY_BUCKET_PO_CREATED,
                Common.WEEKLY_BUCKET_PO_FAILED
            };
            List<Guid> bucketIds = await _repository.WeeklyBucket
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.PropertyId == location.PropertyId && frozen.Contains(x.Status))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            List<Guid> outletBucketIds = await _repository.WeeklyBucketItem
                .FindByCondition(x => bucketIds.Contains(x.WeeklyBucketId)
                    && x.IsActive
                    && x.OutletId == outletId
                    && x.MaterialId != null
                    && x.ApprovedQuantity > 0)
                .Select(x => x.WeeklyBucketId)
                .Distinct()
                .ToListAsync(cancellationToken);
            WeeklyBucket? bucket = await _repository.WeeklyBucket
                .FindByCondition(x => outletBucketIds.Contains(x.Id))
                .OrderByDescending(x => x.Year)
                .ThenByDescending(x => x.WeekNumber)
                .FirstOrDefaultAsync(cancellationToken);
            if (bucket == null)
            {
                _logger.LogInfo($"No frozen weekly bucket for the outlet. OutletId: {outletId}");
                return new SilaGoodsIssueBucketDto();
            }

            List<WeeklyBucketItem> bucketItems = await _repository.WeeklyBucketItem
                .FindByCondition(x => x.WeeklyBucketId == bucket.Id
                    && x.IsActive
                    && x.OutletId == outletId
                    && x.MaterialId != null
                    && x.ApprovedQuantity > 0
                    && x.LineStatus != Common.LINE_EXCLUDED)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = bucketItems.Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, MaterialEntity> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Keys, cancellationToken);

            List<Guid> issueIds = await _repository.GoodsIssue
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.WeeklyBucketId == bucket.Id && x.ToLocationId == location.Id)
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, decimal> issued = await _repository.GoodsIssueItem
                .FindByCondition(x => issueIds.Contains(x.GoodsIssueId) && x.IsActive)
                .GroupBy(x => x.MaterialId)
                .Select(x => new { MaterialId = x.Key, Quantity = x.Sum(i => i.BaseQuantity) })
                .ToDictionaryAsync(x => x.MaterialId, x => x.Quantity, cancellationToken);

            List<SilaGoodsIssueBucketLineDto> lines = new List<SilaGoodsIssueBucketLineDto>();
            foreach (IGrouping<Guid, WeeklyBucketItem> group in bucketItems.GroupBy(x => x.MaterialId!.Value))
            {
                if (!materials.TryGetValue(group.Key, out MaterialEntity? material))
                {
                    continue;
                }

                decimal approved = 0;
                foreach (WeeklyBucketItem item in group)
                {
                    approved += ToBaseOrSame(material, item, conversions);
                }

                decimal alreadyIssued = issued.GetValueOrDefault(material.Id);
                lines.Add(new SilaGoodsIssueBucketLineDto
                {
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    MaterialName = material.Description ?? material.MaterialCode ?? string.Empty,
                    ApprovedQuantity = approved,
                    IssuedQuantity = alreadyIssued,
                    RemainingQuantity = Math.Max(0, approved - alreadyIssued),
                    Uom = UomConverter.BaseUomOf(material)
                });
            }

            _logger.LogInfo($"Weekly bucket lines fetched. WeeklyBucketId: {bucket.Id}, Lines: {lines.Count}");
            return new SilaGoodsIssueBucketDto
            {
                WeeklyBucketId = bucket.Id,
                BucketCode = bucket.BucketCode,
                Status = bucket.Status,
                Lines = lines.OrderBy(x => x.MaterialCode).ToList()
            };
        }

        // The issuer works at a store of the outlet's property, or at the outlet itself.
        private async Task EnsureIssuerAccessAsync(
            Guid buyerId, GetSilaGoodsIssueFromBucketQuery request, InventoryLocation outlet, CancellationToken cancellationToken)
        {
            if (SilaAccess.HasFullAccess(request.RoleId))
            {
                return;
            }

            List<Guid> allowed = await SilaAccess.GetLocationIdsAsync(_repository, buyerId, request.UserId, request.RoleId, cancellationToken);
            bool permitted = allowed.Contains(outlet.Id) || await _repository.InventoryLocation
                .FindByCondition(x => allowed.Contains(x.Id) && x.PropertyId == outlet.PropertyId && x.LocationType == Common.SILA_LOCATION_STORE)
                .AnyAsync(cancellationToken);
            if (!permitted)
            {
                _logger.LogError($"User has no access to issue goods to the outlet. UserId: {request.UserId}, LocationId: {outlet.Id}");
                throw new ForBiddenCustomException("No access to this outlet.", "Ask your administrator to assign you to a store of the outlet's property.");
            }
        }

        // A bucket line in a unit without a conversion is taken as base quantity, so the screen still loads.
        private decimal ToBaseOrSame(MaterialEntity material, WeeklyBucketItem item, Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            try
            {
                return UomConverter.ToBase(_logger, material, item.ApprovedQuantity, item.UnitOfMeasure, conversions);
            }
            catch (BadRequestCustomException)
            {
                _logger.LogInfo($"Weekly bucket line unit taken as base unit. ItemId: {item.Id}, Uom: {item.UnitOfMeasure}");
                return item.ApprovedQuantity;
            }
        }
    }
}
