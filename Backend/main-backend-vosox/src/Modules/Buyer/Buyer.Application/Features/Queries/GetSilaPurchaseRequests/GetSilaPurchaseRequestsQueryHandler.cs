using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPurchaseRequests
{
    /// <summary>One page of the purchase requests of the user's locations, newest first, optionally by status and location.</summary>
    public class GetSilaPurchaseRequestsQueryHandler : IRequestHandler<GetSilaPurchaseRequestsQuery, List<SilaPurchaseRequestDto>>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaPurchaseRequestsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaPurchaseRequestDto>> Handle(GetSilaPurchaseRequestsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching purchase requests. OrganizationId: {request.OrganizationId}, Status: {request.Status}, Index: {request.Index}");

            if (request.Index < 0 || request.Limit < 1 || request.Limit > MAX_LIMIT)
            {
                _logger.LogError($"Invalid paging. Index: {request.Index}, Limit: {request.Limit}");
                throw new BadRequestCustomException("Invalid paging.", $"Use an index of 0 or more and a limit from 1 to {MAX_LIMIT}.");
            }

            string? status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim().ToUpperInvariant();
            if (status != null && !SilaPurchaseRequestRules.Statuses.Contains(status))
            {
                _logger.LogError($"Invalid purchase request status filter. Status: {status}");
                throw new BadRequestCustomException("Invalid status.", "Filter by SUBMITTED, ADDED_TO_BUCKET or CANCELLED.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            if (request.LocationId != null)
            {
                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, request.LocationId.Value, cancellationToken);
                locationIds = new List<Guid> { request.LocationId.Value };
            }

            IQueryable<InternalPurchaseRequest> query = _repository.InternalPurchaseRequest
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.LocationId));
            if (status != null)
            {
                query = query.Where(x => x.Status == status);
            }

            List<InternalPurchaseRequest> rows = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(request.Index)
                .Take(request.Limit)
                .ToListAsync(cancellationToken);
            List<SilaPurchaseRequestDto> result = await SilaPurchaseRequestRules.ToDtosAsync(
                _repository, _identityApiClient, _logger, buyer.Id, rows, cancellationToken);

            _logger.LogInfo($"Purchase requests fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
