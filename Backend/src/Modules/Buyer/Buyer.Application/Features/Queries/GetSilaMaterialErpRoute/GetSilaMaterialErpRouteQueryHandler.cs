using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaMaterialErpRoute
{
    public class GetSilaMaterialErpRouteQueryHandler : IRequestHandler<GetSilaMaterialErpRouteQuery, SilaMaterialErpRouteDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public GetSilaMaterialErpRouteQueryHandler(IRepositoryWrapper repository, IMediator mediator, ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _logger = logger;
        }

        public async Task<SilaMaterialErpRouteDto> Handle(GetSilaMaterialErpRouteQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Resolving the ERP material route. OrganizationId: {request.OrganizationId}, CompanyCode: {request.CompanyCode}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaInputRules.MaxLength(_logger, request.CompanyCode, SilaInputRules.CODE_LENGTH, "Company code");
            string? companyCode = string.IsNullOrWhiteSpace(request.CompanyCode) ? null : request.CompanyCode.Trim().ToUpperInvariant();
            IntegrationApiDto api = await _mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = request.OrganizationId,
                ProcessType = IntegrationProcessType.GET_MATERIAL,
                EntityCode = companyCode
            }, cancellationToken);

            SilaMaterialErpRouteDto result = new SilaMaterialErpRouteDto { Configured = api.Configured, CompanyCode = companyCode };
            if (api.Configured && api.ConfigurationId != null)
            {
                ApiIntegrationConfiguration? configuration = await _repository.ApiIntegrationConfiguration
                    .FindByCondition(x => x.Id == api.ConfigurationId.Value && IntegrationLookup.BuyerIdsOf(_repository, request.OrganizationId).Contains(x.BuyerId))
                    .FirstOrDefaultAsync(cancellationToken);
                result.ConfigurationName = api.Name;
                result.SystemName = api.SystemName;
                result.EntityCode = api.EntityCode;
                result.LastSyncAt = configuration?.LastSuccessfulRunAt;
                result.LastError = configuration?.LastErrorSafe;
            }

            _logger.LogInfo($"ERP material route resolved. Configured: {result.Configured}, BuyerId: {buyer.Id}");
            return result;
        }
    }
}
