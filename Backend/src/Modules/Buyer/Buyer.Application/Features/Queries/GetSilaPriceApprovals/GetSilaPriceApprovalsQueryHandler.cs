using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaPriceApprovals
{
    public class GetSilaPriceApprovalsQueryHandler : IRequestHandler<GetSilaPriceApprovalsQuery, List<SilaMaterialPriceChangeDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaPriceApprovalsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaMaterialPriceChangeDto>> Handle(GetSilaPriceApprovalsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching price approvals waiting for the user. UserId: {request.UserId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 50 : Math.Min(request.Limit, 200);
            List<Guid> waiting = await SilaApprovals.PendingForUserAsync(
                _repository, buyer.Id, Common.SILA_REF_MATERIAL_PRICE, request.UserId, cancellationToken);

            List<MaterialPriceChange> changes = waiting.Count == 0
                ? new List<MaterialPriceChange>()
                : await _repository.MaterialPriceChange
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL && waiting.Contains(x.Id))
                    .OrderBy(x => x.DateCreated)
                    .Skip(index)
                    .Take(limit)
                    .ToListAsync(cancellationToken);
            List<SilaMaterialPriceChangeDto> result = await SilaPriceChangeViews.ToDtosAsync(_repository, _identityApiClient, changes, cancellationToken);

            _logger.LogInfo($"Price approvals fetched. Count: {result.Count}, UserId: {request.UserId}");
            return result;
        }
    }
}
