using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SubmitSilaMaterialPriceChange
{
    /// <summary>
    /// Stores a material price change (MP000001) and starts the MATERIAL_PRICE approval flow. The approved price is not
    /// touched until the last approver approves.
    /// </summary>
    public class SubmitSilaMaterialPriceChangeCommandHandler : IRequestHandler<SubmitSilaMaterialPriceChangeCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SubmitSilaMaterialPriceChangeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(SubmitSilaMaterialPriceChangeCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(SubmitSilaMaterialPriceChangeCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(SubmitSilaMaterialPriceChangeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Submitting material price change. MaterialId: {request.MaterialId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            SilaInputRules.SaneDate(_logger, request.Request.EffectiveFrom, "effective date", 1, 5);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            ItemBuyerMaster material = await SilaLocationRules.GetMaterialAsync(_repository, _logger, buyer.Id, request.MaterialId);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, new[] { material.Id }, cancellationToken);
            ApprovalScope scope = await SilaMaterialPricing.GetScopeAsync(_repository, buyer.Id, cancellationToken);

            MaterialPriceChange change = await SilaMaterialPricing.CreateAsync(
                _repository,
                _logger,
                buyer.Id,
                material,
                conversions,
                request.Request.UnitPrice,
                request.Request.Currency,
                request.Request.PriceUom,
                request.Request.EffectiveFrom,
                request.Request.Reason,
                request.UserId,
                scope,
                cancellationToken,
                request.Request.OutletLocationId);
            await _repository.SaveAsync();

            _logger.LogInfo($"Material price change submitted. PriceChangeId: {change.Id}, RequestNumber: {change.RequestNumber}, MaterialId: {material.Id}");
            return change.Id;
        }
    }
}
