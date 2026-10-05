using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaLocation
{
    public class CreateSilaLocationCommandHandler : IRequestHandler<CreateSilaLocationCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaLocationCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(CreateSilaLocationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating inventory location. OrganizationId: {request.OrganizationId}, LocationCode: {request.Request.LocationCode}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            await SilaLocationRules.ValidateAsync(_repository, _logger, buyer.Id, request.Request, null, cancellationToken);

            InventoryLocation location = new InventoryLocation
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                IsActive = true
            };
            SilaLocationRules.Apply(location, request.Request);
            _repository.InventoryLocation.Create(location);
            await _repository.SaveAsync();

            _logger.LogInfo($"Inventory location created. LocationId: {location.Id}, BuyerId: {buyer.Id}");
            return location.Id;
        }
    }
}
