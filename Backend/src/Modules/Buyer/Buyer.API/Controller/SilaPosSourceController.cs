using Buyer.Application.Features.Commands.DeleteSilaPosItemMapping;
using Buyer.Application.Features.Commands.DeleteSilaPosOutletMapping;
using Buyer.Application.Features.Commands.DeleteSilaPosSource;
using Buyer.Application.Features.Commands.SaveSilaPosItemMapping;
using Buyer.Application.Features.Commands.SaveSilaPosOutletMapping;
using Buyer.Application.Features.Commands.SaveSilaPosSource;
using Buyer.Application.Features.Queries.GetSilaPosItemMappings;
using Buyer.Application.Features.Queries.GetSilaPosOutletMappings;
using Buyer.Application.Features.Queries.GetSilaPosSources;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>SILA ME POS master data: POS sources, POS outlet → SILA outlet mapping and POS item → recipe mapping.</summary>
    [ApiController]
    public class SilaPosSourceController : BaseController
    {
        private const string FEATURE = "MANAGE_SILA_POS";

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaPosSourceController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/sources")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("GetSilaPosSources")]
        [SwaggerResponse(200, type: typeof(List<SilaPosSourceDto>))]
        public async Task<IActionResult> Sources()
        {
            _logger.LogDebug("Fetching POS sources.");
            List<SilaPosSourceDto> result = await _mediator.Send(new GetSilaPosSourcesQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId()
            });
            _logger.LogDebug($"POS sources fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/sources")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("CreateSilaPosSource")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateSource([FromBody] SilaPosSourceWriteDto request)
        {
            _logger.LogDebug("Creating POS source.");
            Guid id = await _mediator.Send(new SaveSilaPosSourceCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), Request = request });
            _logger.LogDebug($"POS source created. SourceId: {id}");
            return Ok(Success(id, "POS source created."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("UpdateSilaPosSource")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpdateSource([FromRoute] Guid sourceId, [FromBody] SilaPosSourceWriteDto request)
        {
            _logger.LogDebug($"Updating POS source. SourceId: {sourceId}");
            Guid id = await _mediator.Send(new SaveSilaPosSourceCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, Request = request });
            _logger.LogDebug($"POS source updated. SourceId: {id}");
            return Ok(Success(id, "POS source updated."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("DeleteSilaPosSource")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeleteSource([FromRoute] Guid sourceId)
        {
            _logger.LogDebug($"Deleting POS source. SourceId: {sourceId}");
            await _mediator.Send(new DeleteSilaPosSourceCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId });
            _logger.LogDebug($"POS source deleted. SourceId: {sourceId}");
            return Ok(Success(sourceId, "POS source deleted."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/outlets")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("GetSilaPosOutletMappings")]
        [SwaggerResponse(200, type: typeof(SilaPosPageDto<SilaPosOutletMappingDto>))]
        public async Task<IActionResult> OutletMappings([FromRoute] Guid sourceId, [FromQuery] string? search, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching POS outlet mappings. SourceId: {sourceId}, Search: {search}");
            SilaPosPageDto<SilaPosOutletMappingDto> result = await _mediator.Send(new GetSilaPosOutletMappingsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                SourceId = sourceId,
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"POS outlet mappings fetched. Total: {result.Total}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/outlets")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("CreateSilaPosOutletMapping")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateOutletMapping([FromRoute] Guid sourceId, [FromBody] SilaPosOutletMappingWriteDto request)
        {
            _logger.LogDebug($"Creating POS outlet mapping. SourceId: {sourceId}");
            Guid id = await _mediator.Send(new SaveSilaPosOutletMappingCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, Request = request });
            _logger.LogDebug($"POS outlet mapping created. MappingId: {id}");
            return Ok(Success(id, "Outlet mapping created."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/outlets/{mappingId}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("UpdateSilaPosOutletMapping")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpdateOutletMapping([FromRoute] Guid sourceId, [FromRoute] Guid mappingId, [FromBody] SilaPosOutletMappingWriteDto request)
        {
            _logger.LogDebug($"Updating POS outlet mapping. SourceId: {sourceId}, MappingId: {mappingId}");
            Guid id = await _mediator.Send(new SaveSilaPosOutletMappingCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, MappingId = mappingId, Request = request });
            _logger.LogDebug($"POS outlet mapping updated. MappingId: {id}");
            return Ok(Success(id, "Outlet mapping updated."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/outlets/{mappingId}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("DeleteSilaPosOutletMapping")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeleteOutletMapping([FromRoute] Guid sourceId, [FromRoute] Guid mappingId)
        {
            _logger.LogDebug($"Deleting POS outlet mapping. SourceId: {sourceId}, MappingId: {mappingId}");
            await _mediator.Send(new DeleteSilaPosOutletMappingCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, MappingId = mappingId });
            _logger.LogDebug($"POS outlet mapping deleted. MappingId: {mappingId}");
            return Ok(Success(mappingId, "Outlet mapping deleted."));
        }

        private static SuccessResponseDto Success(Guid id, string description)
        {
            return new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = description };
        }
    }
}
