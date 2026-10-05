using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeactivateSilaLocation
{
    /// <summary>Deactivates a location that holds no stock (on hand and in transit are zero for every material).</summary>
    public class DeactivateSilaLocationCommandHandler : IRequestHandler<DeactivateSilaLocationCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeactivateSilaLocationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeactivateSilaLocationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deactivating inventory location. LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId);

            bool holdsStock = await _repository.InventoryBalance
                .FindByCondition(x => x.LocationId == location.Id && x.IsActive && (x.OnHandQty != 0 || x.InTransitQty != 0))
                .AnyAsync(cancellationToken);
            if (holdsStock)
            {
                _logger.LogError($"Location still holds stock. LocationId: {location.Id}");
                throw new BadRequestCustomException("Location still holds stock.", "Transfer or adjust the remaining stock to zero before deactivating the location.");
            }

            bool hasChildren = await _repository.InventoryLocation
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.ParentLocationId == location.Id)
                .AnyAsync(cancellationToken);
            if (hasChildren)
            {
                _logger.LogError($"Venue still has locations. LocationId: {location.Id}");
                throw new ConflictCustomException("The venue has locations.", "Move or deactivate the stores and outlets of this venue first.");
            }

            location.IsActive = false;
            _repository.InventoryLocation.Update(location);
            await _repository.SaveAsync();

            _logger.LogInfo($"Inventory location deactivated. LocationId: {location.Id}");
            return Unit.Value;
        }
    }
}
