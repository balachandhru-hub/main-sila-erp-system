using Buyer.Application.Features.Commands.ActivateIntegration;
using Buyer.Application.Features.Commands.CreateIntegration;
using Buyer.Application.Features.Commands.DeactivateIntegration;
using Buyer.Application.Features.Commands.DiscoverIntegrationSchema;
using Buyer.Application.Features.Commands.RunIntegration;
using Buyer.Application.Features.Commands.SaveIntegrationMappings;
using Buyer.Application.Features.Commands.TestIntegration;
using Buyer.Application.Features.Commands.UpdateIntegration;
using Buyer.Application.Features.Commands.UpdateIntegrationRequestBody;
using Buyer.Application.Features.Queries.GetIntegration;
using Buyer.Application.Features.Queries.GetIntegrationExecutions;
using Buyer.Application.Features.Queries.GetIntegrationMappings;
using Buyer.Application.Features.Queries.GetIntegrationSchema;
using Buyer.Application.Features.Queries.GetIntegrationTargetFields;
using Buyer.Application.Features.Queries.GetIntegrations;
using Buyer.Domain.Common;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// API integrations of the buyer organization: configurations, test, schema, field mappings,
    /// activation and pulls of the buyer's API types.
    /// </summary>
    [ApiController]
    [OrganizationType(Common.INTEGRATION_SIDE)]
    public class IntegrationController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public IntegrationController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/integrations/target-fields")]
        [ApiAuthorization(Name = "VIEW_INTEGRATION")]
        [SwaggerOperation("GetIntegrationTargetFields")]
        [SwaggerResponse(200, type: typeof(List<IntegrationTargetFieldResponseDto>))]
        public async Task<IActionResult> GetIntegrationTargetFields([FromQuery] IntegrationProcessType? processType)
        {
            _logger.LogDebug($"Fetching integration target fields. ProcessType: {processType}");
            List<IntegrationTargetFieldResponseDto> result = await _mediator.Send(new GetIntegrationTargetFieldsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ProcessType = processType
            });
            _logger.LogDebug($"Integration target fields fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/integrations/executions")]
        [ApiAuthorization(Name = "VIEW_INTEGRATION")]
        [SwaggerOperation("GetIntegrationExecutions")]
        [SwaggerResponse(200, type: typeof(List<IntegrationExecutionResponseDto>))]
        public async Task<IActionResult> GetIntegrationExecutions([FromQuery] Guid? configurationId)
        {
            _logger.LogDebug($"Fetching integration executions. ConfigurationId: {configurationId}");
            List<IntegrationExecutionResponseDto> result = await _mediator.Send(new GetIntegrationExecutionsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration executions fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/integrations")]
        [ApiAuthorization(Name = "VIEW_INTEGRATION")]
        [SwaggerOperation("GetIntegrations")]
        [SwaggerResponse(200, type: typeof(List<IntegrationConfigurationResponseDto>))]
        public async Task<IActionResult> GetIntegrations()
        {
            _logger.LogDebug("Fetching integrations.");
            List<IntegrationConfigurationResponseDto> result = await _mediator.Send(new GetIntegrationsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId()
            });
            _logger.LogDebug($"Integrations fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/integrations")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("CreateIntegration")]
        [SwaggerResponse(200, type: typeof(IntegrationConfigurationResponseDto))]
        public async Task<IActionResult> CreateIntegration([FromBody] IntegrationConfigurationInputDto request)
        {
            _logger.LogDebug($"Creating integration. Name: {request.Name}, ProcessType: {request.ProcessType}, EntityCode: {request.EntityCode}");
            IntegrationConfigurationResponseDto result = await _mediator.Send(new CreateIntegrationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                OrganizationType = GetOrganizationType(),
                Request = request
            });
            _logger.LogDebug($"Integration created. ConfigurationId: {result.Id}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/integrations/{configurationId:guid}")]
        [ApiAuthorization(Name = "VIEW_INTEGRATION")]
        [SwaggerOperation("GetIntegration")]
        [SwaggerResponse(200, type: typeof(IntegrationConfigurationResponseDto))]
        public async Task<IActionResult> GetIntegration([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Fetching integration. ConfigurationId: {configurationId}");
            IntegrationConfigurationResponseDto result = await _mediator.Send(new GetIntegrationQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration fetched. ConfigurationId: {result.Id}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/integrations/{configurationId:guid}")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("UpdateIntegration")]
        [SwaggerResponse(200, type: typeof(IntegrationConfigurationResponseDto))]
        public async Task<IActionResult> UpdateIntegration([FromRoute] Guid configurationId, [FromBody] IntegrationConfigurationInputDto request)
        {
            _logger.LogDebug($"Updating integration. ConfigurationId: {configurationId}");
            IntegrationConfigurationResponseDto result = await _mediator.Send(new UpdateIntegrationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                OrganizationType = GetOrganizationType(),
                ConfigurationId = configurationId,
                Request = request
            });
            _logger.LogDebug($"Integration updated. ConfigurationId: {result.Id}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/request-body")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("UpdateIntegrationRequestBody")]
        [SwaggerResponse(200, type: typeof(IntegrationConfigurationResponseDto))]
        public async Task<IActionResult> UpdateIntegrationRequestBody([FromRoute] Guid configurationId, [FromBody] IntegrationRequestBodyInputDto request)
        {
            _logger.LogDebug($"Updating integration request body. ConfigurationId: {configurationId}");
            IntegrationConfigurationResponseDto result = await _mediator.Send(new UpdateIntegrationRequestBodyCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId,
                PayloadFormat = request.PayloadFormat,
                RequestBody = request.RequestBody
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/test")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("TestIntegration")]
        [SwaggerResponse(200, type: typeof(IntegrationTestResponseDto))]
        public async Task<IActionResult> TestIntegration([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Testing integration. ConfigurationId: {configurationId}");
            IntegrationTestResponseDto result = await _mediator.Send(new TestIntegrationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration tested. ConfigurationId: {configurationId}, Success: {result.Success}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/schema")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("DiscoverIntegrationSchema")]
        [SwaggerResponse(200, type: typeof(IntegrationSchemaResponseDto))]
        public async Task<IActionResult> DiscoverIntegrationSchema([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Discovering integration schema. ConfigurationId: {configurationId}");
            IntegrationSchemaResponseDto result = await _mediator.Send(new DiscoverIntegrationSchemaCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration schema discovered. ConfigurationId: {configurationId}, Entities: {result.Entities.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/schema")]
        [ApiAuthorization(Name = "VIEW_INTEGRATION")]
        [SwaggerOperation("GetIntegrationSchema")]
        [SwaggerResponse(200, type: typeof(IntegrationSchemaResponseDto))]
        public async Task<IActionResult> GetIntegrationSchema([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Fetching integration schema. ConfigurationId: {configurationId}");
            IntegrationSchemaResponseDto result = await _mediator.Send(new GetIntegrationSchemaQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration schema fetched. ConfigurationId: {configurationId}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/mappings")]
        [ApiAuthorization(Name = "VIEW_INTEGRATION")]
        [SwaggerOperation("GetIntegrationMappings")]
        [SwaggerResponse(200, type: typeof(List<IntegrationMappingResponseDto>))]
        public async Task<IActionResult> GetIntegrationMappings([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Fetching integration mappings. ConfigurationId: {configurationId}");
            List<IntegrationMappingResponseDto> result = await _mediator.Send(new GetIntegrationMappingsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration mappings fetched. ConfigurationId: {configurationId}, Count: {result.Count}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/mappings")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("SaveIntegrationMappings")]
        [SwaggerResponse(200, type: typeof(List<IntegrationMappingResponseDto>))]
        public async Task<IActionResult> SaveIntegrationMappings([FromRoute] Guid configurationId, [FromBody] List<FieldMappingInputDto> request)
        {
            _logger.LogDebug($"Saving integration mappings. ConfigurationId: {configurationId}, Count: {request.Count}");
            List<IntegrationMappingResponseDto> result = await _mediator.Send(new SaveIntegrationMappingsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId,
                Mappings = request
            });
            _logger.LogDebug($"Integration mappings saved. ConfigurationId: {configurationId}, Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/activate")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("ActivateIntegration")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> ActivateIntegration([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Activating integration. ConfigurationId: {configurationId}");
            bool result = await _mediator.Send(new ActivateIntegrationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration activated. ConfigurationId: {configurationId}, Active: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = configurationId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Integration activated."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/deactivate")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("DeactivateIntegration")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeactivateIntegration([FromRoute] Guid configurationId)
        {
            _logger.LogDebug($"Deactivating integration. ConfigurationId: {configurationId}");
            bool result = await _mediator.Send(new DeactivateIntegrationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId
            });
            _logger.LogDebug($"Integration deactivated. ConfigurationId: {configurationId}, Active: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = configurationId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Integration deactivated."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/integrations/{configurationId:guid}/pull")]
        [ApiAuthorization(Name = "MANAGE_INTEGRATION")]
        [SwaggerOperation("RunIntegration")]
        [SwaggerResponse(200, type: typeof(IntegrationExecutionResponseDto))]
        public async Task<IActionResult> RunIntegration([FromRoute] Guid configurationId, [FromBody] IntegrationExecutionRequestDto? request)
        {
            _logger.LogDebug($"Running integration. ConfigurationId: {configurationId}, FullSync: {request?.FullSync}");
            IntegrationExecutionResponseDto result = await _mediator.Send(new RunIntegrationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ConfigurationId = configurationId,
                Trigger = IntegrationExecutionTrigger.MANUAL,
                FullSync = request?.FullSync ?? false
            });
            _logger.LogDebug($"Integration run completed. ConfigurationId: {configurationId}, Status: {result.Status}");
            return Ok(result);
        }
    }
}
