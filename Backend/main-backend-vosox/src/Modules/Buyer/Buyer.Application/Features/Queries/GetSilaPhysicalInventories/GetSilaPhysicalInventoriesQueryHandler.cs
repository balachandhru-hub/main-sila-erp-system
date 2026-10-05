using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPhysicalInventories
{
    /// <summary>One page of the physical inventory requests of the user's locations, soonest scheduled first.</summary>
    public class GetSilaPhysicalInventoriesQueryHandler : IRequestHandler<GetSilaPhysicalInventoriesQuery, List<SilaPhysicalInventoryDto>>
    {
        private const int MAX_LIMIT = 200;

        private static readonly string[] Statuses = { Common.SILA_PI_SCHEDULED, Common.SILA_PI_IN_PROGRESS, Common.SILA_PI_COMPLETED, Common.SILA_PI_CANCELLED };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaPhysicalInventoriesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaPhysicalInventoryDto>> Handle(GetSilaPhysicalInventoriesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Fetching physical inventories. Status: {request.Status}, LocationId: {request.LocationId}, Index: {request.Index}, Limit: {request.Limit}, OrganizationId: {request.OrganizationId}");

            string? status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim().ToUpperInvariant();
            if (status != null && !Statuses.Contains(status))
            {
                _logger.LogError($"Invalid physical inventory status filter. Status: {request.Status}");
                throw new BadRequestCustomException("Status is not valid.", "Use SCHEDULED, IN_PROGRESS, COMPLETED or CANCELLED.");
            }

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, MAX_LIMIT);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            if (request.LocationId != null)
            {
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, request.LocationId.Value, cancellationToken);
                locationIds = locationIds.Where(x => x == request.LocationId.Value).ToList();
            }

            IQueryable<PhysicalInventoryRequest> query = _repository.PhysicalInventoryRequest
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.LocationId));
            if (status != null)
            {
                query = query.Where(x => x.Status == status);
            }

            List<PhysicalInventoryRequest> requests = await query
                .OrderByDescending(x => x.Status == Common.SILA_PI_SCHEDULED || x.Status == Common.SILA_PI_IN_PROGRESS)
                .ThenBy(x => x.ScheduledDate)
                .ThenByDescending(x => x.DateCreated)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<SilaPhysicalInventoryDto> result = await SilaPhysicalInventoryRules.MapAsync(_repository, buyer.Id, requests, cancellationToken);

            _logger.LogInfo($"Physical inventories fetched. BuyerId: {buyer.Id}, Count: {result.Count}");
            return result;
        }
    }
}
