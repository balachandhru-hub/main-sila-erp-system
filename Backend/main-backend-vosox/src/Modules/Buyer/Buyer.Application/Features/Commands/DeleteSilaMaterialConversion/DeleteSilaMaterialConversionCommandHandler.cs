using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaMaterialConversion
{
    /// <summary>Removes a UOM conversion of a material. Posted movements keep their base quantities.</summary>
    public class DeleteSilaMaterialConversionCommandHandler : IRequestHandler<DeleteSilaMaterialConversionCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaMaterialConversionCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeleteSilaMaterialConversionCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting UOM conversion. ConversionId: {request.ConversionId}, MaterialId: {request.MaterialId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            ItemBuyerMaster material = await SilaLocationRules.GetMaterialAsync(_repository, _logger, buyer.Id, request.MaterialId);
            MaterialUomConversion? conversion = await _repository.MaterialUomConversion.FindFirstByConditionAsync(
                x => x.Id == request.ConversionId && x.MaterialId == material.Id && x.BuyerId == buyer.Id);
            if (conversion == null)
            {
                _logger.LogError($"UOM conversion not found. ConversionId: {request.ConversionId}, MaterialId: {material.Id}");
                throw new NotFoundCustomException("Conversion not found.", "Refresh the material and select an existing conversion.");
            }

            _repository.MaterialUomConversion.Delete(conversion);
            await _repository.SaveAsync();

            _logger.LogInfo($"UOM conversion deleted. ConversionId: {conversion.Id}");
            return Unit.Value;
        }
    }
}
