using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaAlerts
{
    public class GetSilaAlertsQueryHandler : IRequestHandler<GetSilaAlertsQuery, List<SilaAlertDto>>
    {
        private static readonly string[] Statuses =
        {
            Common.SILA_ALERT_NEW, Common.SILA_ALERT_ACKNOWLEDGED, Common.SILA_ALERT_RESOLVED, Common.SILA_ALERT_DISMISSED
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaAlertsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaAlertDto>> Handle(GetSilaAlertsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching inventory alerts. Status: {request.Status}, Take: {request.Take}, Index: {request.Index}, Limit: {request.Limit}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            IQueryable<InventoryAlert> query = _repository.InventoryAlert
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && (x.LocationId == null || locationIds.Contains(x.LocationId.Value)));
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, Statuses, "alert status");
                query = query.Where(x => x.Status == status);
            }

            // "take" is the older page-size parameter; "limit" wins when both are sent.
            int limit = SilaInputRules.Limit(request.Limit > 0 ? request.Limit : request.Take);
            List<InventoryAlert> alerts = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.Id)
                .Skip(SilaInputRules.Index(request.Index))
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = alerts.Where(x => x.MaterialId != null).Select(x => x.MaterialId!.Value).Distinct().ToList();
            Dictionary<Guid, Buyer.Domain.Entities.ItemBuyerMaster> materials = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyer.Id && materialIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> alertLocationIds = alerts.Where(x => x.LocationId != null).Select(x => x.LocationId!.Value).Distinct().ToList();
            Dictionary<Guid, string> locationNames = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && alertLocationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);

            List<SilaAlertDto> result = alerts.Select(alert =>
            {
                Buyer.Domain.Entities.ItemBuyerMaster? material = alert.MaterialId != null && materials.TryGetValue(alert.MaterialId.Value, out Buyer.Domain.Entities.ItemBuyerMaster? found) ? found : null;
                return new SilaAlertDto
                {
                    Id = alert.Id,
                    AlertType = alert.AlertType,
                    Severity = alert.Severity,
                    Status = alert.Status,
                    Title = alert.Title,
                    Message = alert.Message,
                    LocationId = alert.LocationId,
                    LocationName = alert.LocationId != null && locationNames.TryGetValue(alert.LocationId.Value, out string? name) ? name : null,
                    MaterialId = alert.MaterialId,
                    MaterialCode = material?.MaterialCode,
                    MaterialName = material?.Description,
                    ReferenceType = alert.ReferenceType,
                    ReferenceId = alert.ReferenceId,
                    RecommendedAction = alert.RecommendedAction,
                    DateCreated = alert.DateCreated
                };
            }).ToList();

            _logger.LogInfo($"Inventory alerts fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
