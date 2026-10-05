using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaLocationUsers
{
    public class GetSilaLocationUsersQueryHandler : IRequestHandler<GetSilaLocationUsersQuery, SilaLocationUsersDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaLocationUsersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaLocationUsersDto> Handle(GetSilaLocationUsersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching location users. LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId);
            List<Guid> userIds = await _repository.InventoryLocationUserMapping
                .FindByCondition(x => x.LocationId == location.Id && x.IsActive)
                .Select(x => x.UserId)
                .Distinct()
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Location users fetched. Count: {userIds.Count}, LocationId: {location.Id}");
            Dictionary<Guid, IdentityUserDto> users = new Dictionary<Guid, IdentityUserDto>();
            if (userIds.Count > 0)
            {
                try
                {
                    users = (await _identityApiClient.GetUsersByIds(userIds, cancellationToken))
                        .GroupBy(x => x.UserId)
                        .ToDictionary(x => x.Key, x => x.First());
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    _logger.LogError($"Location user details could not be loaded from Identity. Users: {userIds.Count}, Error: {SilaLogText.Short(exception.Message)}");
                }
            }

            return new SilaLocationUsersDto
            {
                LocationId = location.Id,
                UserIds = userIds,
                Users = userIds.Select(id => new SilaLocationUserDto
                {
                    UserId = id,
                    Name = users.TryGetValue(id, out IdentityUserDto? user) ? user.Name : null,
                    Email = user?.Email,
                    RoleName = user?.RoleName
                }).OrderBy(x => x.Name ?? x.UserId.ToString()).ToList()
            };
        }
    }
}
