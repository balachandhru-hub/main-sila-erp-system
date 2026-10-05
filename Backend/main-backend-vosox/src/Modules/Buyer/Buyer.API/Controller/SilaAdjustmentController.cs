using Buyer.Application.Features.Commands.CreateSilaAdjustment;
using Buyer.Application.Features.Queries.GetSilaAdjustment;
using Buyer.Application.Features.Queries.GetSilaAdjustments;
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
    /// <summary>SILA ME stock adjustments: opening stock, waste types and manual adjustments.</summary>
    [ApiController]
    public class SilaAdjustmentController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaAdjustmentController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/adjustments")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaAdjustments")]
        [SwaggerResponse(200, type: typeof(List<SilaAdjustmentListItemDto>))]
        public async Task<IActionResult> List(
            [FromQuery] Guid? locationId, [FromQuery] string? type, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching stock adjustments. LocationId: {locationId}, Type: {type}, Index: {index}, Limit: {limit}");
            List<SilaAdjustmentListItemDto> result = await _mediator.Send(new GetSilaAdjustmentsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                AdjustmentType = type,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Stock adjustments fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/adjustments/{adjustmentId}")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaAdjustment")]
        [SwaggerResponse(200, type: typeof(SilaAdjustmentDetailDto))]
        public async Task<IActionResult> Get([FromRoute] Guid adjustmentId)
        {
            _logger.LogDebug($"Fetching stock adjustment. AdjustmentId: {adjustmentId}");
            SilaAdjustmentDetailDto result = await _mediator.Send(new GetSilaAdjustmentQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                AdjustmentId = adjustmentId
            });
            _logger.LogDebug($"Stock adjustment fetched. AdjustmentNumber: {result.AdjustmentNumber}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/adjustments")]
        [ApiAuthorization(Name = "POST_SILA_ADJUSTMENT")]
        [SwaggerOperation("CreateSilaAdjustment")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromBody] SilaAdjustmentWriteDto request)
        {
            _logger.LogDebug($"Creating stock adjustment. LocationId: {request.LocationId}, Type: {request.AdjustmentType}");
            Guid id = await _mediator.Send(new CreateSilaAdjustmentCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Stock adjustment posted. AdjustmentId: {id}");
            return Ok(new SuccessResponseDto
            {
                Id = id.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Stock adjustment posted."
            });
        }
    }
}
