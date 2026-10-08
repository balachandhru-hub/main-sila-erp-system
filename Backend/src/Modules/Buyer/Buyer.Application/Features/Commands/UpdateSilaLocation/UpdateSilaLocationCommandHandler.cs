using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaLocation
{
    public class UpdateSilaLocationCommandHandler : IRequestHandler<UpdateSilaLocationCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaLocationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(UpdateSilaLocationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating inventory location. LocationId: {request.LocationId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, request.LocationId);
            await SilaLocationRules.ValidateAsync(_repository, _logger, buyer.Id, request.Request, location.Id, cancellationToken);

            SilaLocationRules.Apply(location, request.Request);
            _repository.InventoryLocation.Update(location);
            await _repository.SaveAsync();

            _logger.LogInfo($"Inventory location updated. LocationId: {location.Id}");
            return Unit.Value;
        }
    }
}
