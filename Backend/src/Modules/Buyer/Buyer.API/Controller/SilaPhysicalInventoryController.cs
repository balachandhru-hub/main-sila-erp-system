using Buyer.Application.Features.Commands.CancelSilaPhysicalInventory;
using Buyer.Application.Features.Commands.CreateSilaPhysicalInventory;
using Buyer.Application.Features.Commands.RescheduleSilaPhysicalInventory;
using Buyer.Application.Features.Queries.GetSilaPhysicalInventories;
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
    /// <summary>
    /// SILA ME physical inventory requests: surprise blind counts scheduled on a random working day for the cost controller's
    /// inspection. The PhysicalInventoryJob opens the count on the scheduled day.
    /// </summary>
    [ApiController]
    public class SilaPhysicalInventoryController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaPhysicalInventoryController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/physical-inventory")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("GetSilaPhysicalInventories")]
        [SwaggerResponse(200, type: typeof(List<SilaPhysicalInventoryDto>))]
        public async Task<IActionResult> List(
            [FromQuery] string? status, [FromQuery] Guid? locationId, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching physical inventories. Status: {status}, LocationId: {locationId}, Index: {index}, Limit: {limit}");
            List<SilaPhysicalInventoryDto> result = await _mediator.Send(new GetSilaPhysicalInventoriesQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                LocationId = locationId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Physical inventories fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/physical-inventory")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("CreateSilaPhysicalInventory")]
        [SwaggerResponse(200, type: typeof(SilaPhysicalInventoryDto))]
        public async Task<IActionResult> Create([FromBody] SilaPhysicalInventoryWriteDto request)
        {
            _logger.LogDebug($"Requesting physical inventory. LocationId: {request.LocationId}, ScheduledDate: {request.ScheduledDate:yyyy-MM-dd}");
            SilaPhysicalInventoryDto result = await _mediator.Send(new CreateSilaPhysicalInventoryCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Physical inventory requested. RequestId: {result.Id}, ScheduledDate: {result.ScheduledDate:yyyy-MM-dd}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/physical-inventory/{requestId:guid}/schedule")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("RescheduleSilaPhysicalInventory")]
        [SwaggerResponse(200, type: typeof(SilaPhysicalInventoryDto))]
        public async Task<IActionResult> Reschedule([FromRoute] Guid requestId, [FromBody] SilaPhysicalInventoryScheduleDto request)
        {
            _logger.LogDebug($"Rescheduling physical inventory. RequestId: {requestId}, ScheduledDate: {request.ScheduledDate:yyyy-MM-dd}");
            SilaPhysicalInventoryDto result = await _mediator.Send(new RescheduleSilaPhysicalInventoryCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RequestId = requestId,
                Request = request
            });
            _logger.LogDebug($"Physical inventory rescheduled. RequestId: {requestId}, ScheduledDate: {result.ScheduledDate:yyyy-MM-dd}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/physical-inventory/{requestId:guid}/cancel")]
        [ApiAuthorization(Name = "APPROVE_SILA_STOCK_COUNT")]
        [SwaggerOperation("CancelSilaPhysicalInventory")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Cancel([FromRoute] Guid requestId, [FromBody] SilaPhysicalInventoryCancelDto? request)
        {
            _logger.LogDebug($"Cancelling physical inventory. RequestId: {requestId}");
            await _mediator.Send(new CancelSilaPhysicalInventoryCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RequestId = requestId,
                Request = request ?? new SilaPhysicalInventoryCancelDto()
            });
            _logger.LogDebug($"Physical inventory cancelled. RequestId: {requestId}");
            return Ok(new SuccessResponseDto
            {
                Id = requestId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Physical inventory cancelled."
            });
        }
    }
}
