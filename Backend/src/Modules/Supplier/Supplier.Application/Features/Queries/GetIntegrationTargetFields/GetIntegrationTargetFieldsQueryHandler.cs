using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;
using Supplier.Domain.Common;

namespace Supplier.Application.Features.Queries.GetIntegrationTargetFields
{
    public class GetIntegrationTargetFieldsQueryHandler : IRequestHandler<GetIntegrationTargetFieldsQuery, List<IntegrationTargetFieldResponseDto>>
    {
        private readonly ILoggerManager _logger;

        public GetIntegrationTargetFieldsQueryHandler(ILoggerManager logger)
        {
            _logger = logger;
        }

        public Task<List<IntegrationTargetFieldResponseDto>> Handle(GetIntegrationTargetFieldsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching integration target fields. OrganizationId: {request.OrganizationId}, ProcessType: {request.ProcessType}");
            List<IntegrationProcessType> processTypes = request.ProcessType == null
                ? Enum.GetValues<IntegrationProcessType>().Where(item => IntegrationProcessCatalog.BelongsTo(item, Common.INTEGRATION_SIDE)).ToList()
                : new List<IntegrationProcessType> { request.ProcessType.Value };
            List<IntegrationTargetFieldResponseDto> fields = IntegrationTargetFieldRegistry.Fields
                .Where(field => processTypes.Any(processType => IntegrationProcessCatalog.OwnsTarget(processType, field.TargetField)))
                .ToList();
            _logger.LogInfo($"Integration target fields fetched. Count: {fields.Count}");
            return Task.FromResult(fields);
        }
    }
}
