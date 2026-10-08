using Microsoft.EntityFrameworkCore;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaAdjustment
{
    public class GetSilaAdjustmentQueryHandler : IRequestHandler<GetSilaAdjustmentQuery, SilaAdjustmentDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaAdjustmentQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaAdjustmentDetailDto> Handle(GetSilaAdjustmentQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching stock adjustment. AdjustmentId: {request.AdjustmentId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockAdjustment? adjustment = await _repository.StockAdjustment
                .FindByCondition(x => x.Id == request.AdjustmentId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (adjustment == null)
            {
                _logger.LogError($"Stock adjustment not found. AdjustmentId: {request.AdjustmentId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Stock adjustment not found.", "Open a stock adjustment of this organization.");
            }

            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, adjustment.LocationId, cancellationToken);

            List<StockAdjustmentItem> items = await _repository.StockAdjustmentItem
                .FindByCondition(x => x.StockAdjustmentId == adjustment.Id && x.IsActive)
                .OrderBy(x => x.MaterialCode)
                .ToListAsync(cancellationToken);
            Dictionary<Guid, string> locations = await SilaMovementLookup.GetLocationNamesAsync(
                _repository, buyer.Id, new[] { adjustment.LocationId }, cancellationToken);
            Dictionary<Guid, string> users = await SilaMovementLookup.GetUserNamesAsync(
                _identityApiClient, _logger, new[] { adjustment.PostedBy }, cancellationToken);

            _logger.LogInfo($"Stock adjustment fetched. AdjustmentId: {adjustment.Id}, Lines: {items.Count}");
            return new SilaAdjustmentDetailDto
            {
                Id = adjustment.Id,
                AdjustmentNumber = adjustment.AdjustmentNumber,
                LocationId = adjustment.LocationId,
                LocationName = locations.GetValueOrDefault(adjustment.LocationId),
                AdjustmentType = adjustment.AdjustmentType,
                Reason = adjustment.Reason,
                PostedBy = adjustment.PostedBy,
                PostedByName = SilaMovementLookup.NameOf(users, adjustment.PostedBy),
                PostedOn = adjustment.DateCreated,
                Items = items.Select(x => new SilaAdjustmentItemDto
                {
                    Id = x.Id,
                    MaterialId = x.MaterialId,
                    MaterialCode = x.MaterialCode,
                    MaterialName = x.MaterialName,
                    Quantity = x.Quantity,
                    Uom = x.Uom,
                    BaseQuantity = x.BaseQuantity,
                    UnitCost = x.UnitCost
                }).ToList()
            };
        }
    }
}
