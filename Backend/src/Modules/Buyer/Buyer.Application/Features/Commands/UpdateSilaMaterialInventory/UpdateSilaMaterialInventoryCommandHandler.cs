using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaMaterialInventory
{
    /// <summary>
    /// Updates the inventory fields of an Item Master material: barcode, inventory item flag and type, batch / expiry / serial
    /// management, standard and moving average price. The unit price changes only through an approved price change.
    /// </summary>
    public class UpdateSilaMaterialInventoryCommandHandler : IRequestHandler<UpdateSilaMaterialInventoryCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaMaterialInventoryCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(UpdateSilaMaterialInventoryCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating material inventory fields. MaterialId: {request.MaterialId}, OrganizationId: {request.OrganizationId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            ItemBuyerMaster material = await SilaLocationRules.GetMaterialAsync(_repository, _logger, buyer.Id, request.MaterialId);

            string? barcode = string.IsNullOrWhiteSpace(request.Request.Barcode) ? null : request.Request.Barcode.Trim();
            if (barcode != null)
            {
                bool barcodeTaken = await _repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Barcode == barcode && x.Id != material.Id)
                    .AnyAsync(cancellationToken);
                if (barcodeTaken)
                {
                    _logger.LogError($"Barcode already used. Barcode: {barcode}, BuyerId: {buyer.Id}");
                    throw new ConflictCustomException("Barcode already used.", "Enter a barcode that no other material of this organization uses.");
                }
            }

            List<string> errors = SilaMaterialRules.Apply(material, request.Request);
            if (errors.Count > 0)
            {
                _logger.LogError($"Invalid material inventory fields. MaterialId: {material.Id}, Errors: {errors.Count}");
                throw new BadRequestCustomException("The material fields are not valid.", string.Join(" ", errors));
            }

            _repository.ItemBuyerMaster.Update(material);
            await _repository.SaveAsync();

            _logger.LogInfo($"Material inventory fields updated. MaterialId: {material.Id}");
            return Unit.Value;
        }
    }
}
