using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpsertSilaMaterialConversion
{
    /// <summary>
    /// Adds or changes a UOM conversion of a material: 1 FromUom = Factor ToUom. One of the two units must be the material's
    /// base unit, so every unit converts to the base unit in one step.
    /// </summary>
    public class UpsertSilaMaterialConversionCommandHandler : IRequestHandler<UpsertSilaMaterialConversionCommand, Guid>
    {
        private const int MAX_UOM_LENGTH = 20;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpsertSilaMaterialConversionCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(UpsertSilaMaterialConversionCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving UOM conversion. MaterialId: {request.MaterialId}, From: {request.Request.FromUom}, To: {request.Request.ToUom}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            ItemBuyerMaster material = await SilaLocationRules.GetMaterialAsync(_repository, _logger, buyer.Id, request.MaterialId);
            string fromUom = (request.Request.FromUom ?? string.Empty).Trim().ToUpperInvariant();
            string toUom = (request.Request.ToUom ?? string.Empty).Trim().ToUpperInvariant();
            string baseUom = UomConverter.BaseUomOf(material);

            if (string.IsNullOrWhiteSpace(fromUom) || string.IsNullOrWhiteSpace(toUom) || fromUom == toUom)
            {
                _logger.LogError($"Invalid conversion units. From: {fromUom}, To: {toUom}");
                throw new BadRequestCustomException("Invalid units.", "Enter two different units of measure.");
            }

            if (fromUom != baseUom && toUom != baseUom)
            {
                _logger.LogError($"Conversion does not use the base unit. From: {fromUom}, To: {toUom}, Base: {baseUom}");
                throw new BadRequestCustomException("Conversion must use the base unit.", $"Make {baseUom} (the base unit of {material.MaterialCode}) one of the two units.");
            }

            SilaInputRules.MaxLength(_logger, fromUom, MAX_UOM_LENGTH, "From unit");
            SilaInputRules.MaxLength(_logger, toUom, MAX_UOM_LENGTH, "To unit");
            if (request.Request.Factor <= 0 || request.Request.Factor > SilaInputRules.MAX_QUANTITY)
            {
                _logger.LogError($"Invalid conversion factor. Factor: {request.Request.Factor}");
                throw new BadRequestCustomException("Invalid factor.", "Enter a factor greater than zero and at most 1,000,000,000.");
            }

            // One conversion per unit pair, whichever direction it was entered in; the unique index covers inactive rows too.
            MaterialUomConversion? conversion = await _repository.MaterialUomConversion.FindFirstByConditionAsync(
                x => x.MaterialId == material.Id &&
                    ((x.FromUom == fromUom && x.ToUom == toUom) || (x.FromUom == toUom && x.ToUom == fromUom)));
            if (conversion == null)
            {
                conversion = new MaterialUomConversion
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyer.Id,
                    MaterialId = material.Id,
                    FromUom = fromUom,
                    ToUom = toUom,
                    Factor = request.Request.Factor,
                    IsActive = true
                };
                _repository.MaterialUomConversion.Create(conversion);
            }
            else
            {
                conversion.FromUom = fromUom;
                conversion.ToUom = toUom;
                conversion.Factor = request.Request.Factor;
                conversion.IsActive = true;
                _repository.MaterialUomConversion.Update(conversion);
            }

            await _repository.SaveAsync();

            _logger.LogInfo($"UOM conversion saved. ConversionId: {conversion.Id}, MaterialId: {material.Id}");
            return conversion.Id;
        }
    }
}
