using Buyer.Application.Features.Commands.RequestSilaAlertCount;
using Buyer.Application.Features.Commands.UpdateSilaAlertStatus;
using Buyer.Application.Features.Queries.GetSilaAlerts;
using Buyer.Domain.Common;
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
    /// SILA ME inventory alerts (low stock, negative stock, count variances, transfer discrepancies) and their actions.
    /// </summary>
    [ApiController]
    public class SilaAlertController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaAlertController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/alerts")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaAlerts")]
        [SwaggerResponse(200, type: typeof(List<SilaAlertDto>))]
        public async Task<IActionResult> List(
            [FromQuery] string? status, [FromQuery] int take = 0, [FromQuery] int index = 0, [FromQuery] int limit = 0)
        {
            _logger.LogDebug($"Fetching inventory alerts. Status: {status}, Take: {take}, Index: {index}, Limit: {limit}");
            List<SilaAlertDto> result = await _mediator.Send(new GetSilaAlertsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                Take = take,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Inventory alerts fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/alerts/{alertId:guid}/acknowledge")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("AcknowledgeSilaAlert")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Acknowledge([FromRoute] Guid alertId)
        {
            return await ChangeStatus(alertId, Common.SILA_ALERT_ACKNOWLEDGED, "Alert acknowledged.");
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/alerts/{alertId:guid}/resolve")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("ResolveSilaAlert")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Resolve([FromRoute] Guid alertId)
        {
            return await ChangeStatus(alertId, Common.SILA_ALERT_RESOLVED, "Alert resolved.");
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/alerts/{alertId:guid}/dismiss")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("DismissSilaAlert")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Dismiss([FromRoute] Guid alertId)
        {
            return await ChangeStatus(alertId, Common.SILA_ALERT_DISMISSED, "Alert dismissed.");
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/alerts/{alertId:guid}/request-count")]
        [ApiAuthorization(Name = "MANAGE_SILA_STOCK_COUNT")]
        [SwaggerOperation("RequestSilaAlertCount")]
        [SwaggerResponse(200, type: typeof(SilaPhysicalInventoryDto))]
        public async Task<IActionResult> RequestCount([FromRoute] Guid alertId, [FromBody] SilaPhysicalInventoryScheduleDto? request)
        {
            _logger.LogDebug($"Requesting a physical inventory from an alert. AlertId: {alertId}");
            SilaPhysicalInventoryDto result = await _mediator.Send(new RequestSilaAlertCountCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                AlertId = alertId,
                ScheduledDate = request?.ScheduledDate
            });
            _logger.LogDebug($"Physical inventory requested from an alert. AlertId: {alertId}, RequestId: {result.Id}, ScheduledDate: {result.ScheduledDate:yyyy-MM-dd}");
            return Ok(result);
        }

        private async Task<IActionResult> ChangeStatus(Guid alertId, string status, string description)
        {
            _logger.LogDebug($"Changing alert status. AlertId: {alertId}, Status: {status}");
            await _mediator.Send(new UpdateSilaAlertStatusCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                AlertId = alertId,
                Status = status
            });
            _logger.LogDebug($"Alert status changed. AlertId: {alertId}, Status: {status}");
            return Ok(new SuccessResponseDto
            {
                Id = alertId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = description
            });
        }
    }
}
