using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaMaterialPriceHistory
{
    public class GetSilaMaterialPriceHistoryQueryHandler : IRequestHandler<GetSilaMaterialPriceHistoryQuery, List<SilaMaterialPriceChangeDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaMaterialPriceHistoryQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaMaterialPriceChangeDto>> Handle(GetSilaMaterialPriceHistoryQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching material price history. MaterialId: {request.MaterialId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            bool materialExists = await _repository.ItemBuyerMaster
                .FindByCondition(x => x.Id == request.MaterialId && x.BuyerId == buyer.Id)
                .AnyAsync(cancellationToken);
            if (!materialExists)
            {
                _logger.LogError($"Material not found. MaterialId: {request.MaterialId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Material not found.", "Select a material of this organization.");
            }

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, 200);
            List<MaterialPriceChange> changes = await _repository.MaterialPriceChange
                .FindByCondition(x => x.BuyerId == buyer.Id && x.MaterialId == request.MaterialId && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
            List<SilaMaterialPriceChangeDto> result = await SilaPriceChangeViews.ToDtosAsync(_repository, _identityApiClient, changes, cancellationToken);

            _logger.LogInfo($"Material price history fetched. Count: {result.Count}, MaterialId: {request.MaterialId}");
            return result;
        }
    }
}
