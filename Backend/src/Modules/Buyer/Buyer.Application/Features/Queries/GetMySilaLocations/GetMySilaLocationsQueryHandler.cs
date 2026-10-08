using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetMySilaLocations
{
    public class GetMySilaLocationsQueryHandler : IRequestHandler<GetMySilaLocationsQuery, List<SilaLocationResponseDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetMySilaLocationsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaLocationResponseDto>> Handle(GetMySilaLocationsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching the caller's inventory locations. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            List<InventoryLocation> locations = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && locationIds.Contains(x.Id))
                .ToListAsync(cancellationToken);
            List<SilaLocationResponseDto> result = await SilaLocationRules.ToResponseAsync(_repository, buyer.Id, locations, cancellationToken);

            _logger.LogInfo($"Caller's inventory locations fetched. Count: {result.Count}, UserId: {request.UserId}");
            return result;
        }
    }
}
