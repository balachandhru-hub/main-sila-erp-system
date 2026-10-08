using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dto;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SetSilaLocationUsers
{
    /// <summary>Replaces the users assigned to a location. Every user must belong to the signed-in organization.</summary>
    public class SetSilaLocationUsersCommandHandler : IRequestHandler<SetSilaLocationUsersCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public SetSilaLocationUsersCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<Unit> Handle(SetSilaLocationUsersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Assigning users to location. LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId);
            List<Guid> requested = (request.Request.UserIds ?? new List<Guid>()).Where(id => id != Guid.Empty).Distinct().ToList();

            if (requested.Count > 0)
            {
                List<IdentityUserDto> organizationUsers = await _identityApiClient.GetOrganizationUsers(request.OrganizationId, cancellationToken);
                Guid unknown = requested.FirstOrDefault(id => !organizationUsers.Any(user => user.UserId == id));
                if (unknown != Guid.Empty)
                {
                    _logger.LogError($"User not found in organization. UserId: {unknown}, OrganizationId: {request.OrganizationId}");
                    throw new NotFoundCustomException("User not found.", "Select users that belong to this buyer organization.");
                }
            }

            // Rows are unique per (location, user), also when inactive: reuse them instead of inserting again.
            List<InventoryLocationUserMapping> existing = await _repository.InventoryLocationUserMapping
                .FindByCondition(x => x.LocationId == location.Id)
                .ToListAsync(cancellationToken);
            _repository.InventoryLocationUserMapping.DeleteRange(existing.Where(x => !requested.Contains(x.UserId)));
            List<InventoryLocationUserMapping> reactivated = existing.Where(x => requested.Contains(x.UserId) && !x.IsActive).ToList();
            foreach (InventoryLocationUserMapping mapping in reactivated)
            {
                mapping.IsActive = true;
            }

            if (reactivated.Count > 0)
            {
                _repository.InventoryLocationUserMapping.UpdateRange(reactivated);
            }

            foreach (Guid userId in requested.Where(id => !existing.Any(x => x.UserId == id)))
            {
                _repository.InventoryLocationUserMapping.Create(new InventoryLocationUserMapping
                {
                    Id = Guid.NewGuid(),
                    LocationId = location.Id,
                    UserId = userId,
                    IsActive = true
                });
            }

            await _repository.SaveAsync();

            _logger.LogInfo($"Users assigned to location. LocationId: {location.Id}, Count: {requested.Count}");
            return Unit.Value;
        }
    }
}
