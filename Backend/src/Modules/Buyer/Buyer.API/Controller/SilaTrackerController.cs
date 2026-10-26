using Buyer.Application.Features.Commands.ReprocessSilaTracker;
using Buyer.Application.Features.Queries.GetSilaTransactionTracker;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// The two transaction trackers: purchasing integration movements and SILA ME operational movements.
    /// </summary>
    [ApiController]
    public class SilaTrackerController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaTrackerController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/trackers/{tracker}")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("GetSilaTransactionTracker")]
        [SwaggerResponse(200, type: typeof(SilaTrackerPageDto))]
        public async Task<IActionResult> List(
            [FromRoute] string tracker,
            [FromQuery] string? transactionType,
            [FromQuery] string? direction,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] string? companyCode,
            [FromQuery] string? status,
            [FromQuery] Guid? userId,
            [FromQuery] Guid? propertyId,
            [FromQuery] string? plant,
            [FromQuery] string? storageLocation,
            [FromQuery] string? sourceSystem,
            [FromQuery] string? targetSystem,
            [FromQuery] string? dataClass,
            [FromQuery] string? search,
            [FromQuery] string? material,
            [FromQuery] string? integration,
            [FromQuery] string? stage,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 25)
        {
            _logger.LogDebug($"Fetching transaction tracker. Tracker: {tracker}, Status: {status}, Search: {search}");
            SilaTrackerPageDto result = await _mediator.Send(new GetSilaTransactionTrackerQuery
            {
                OrganizationId = GetOrganizationId(),
                Tracker = tracker,
                TransactionType = transactionType,
                Direction = direction,
                From = from,
                To = to,
                CompanyCode = companyCode,
                Status = status,
                UserId = userId,
                PropertyId = propertyId,
                Plant = plant,
                StorageLocation = storageLocation,
                SourceSystem = sourceSystem,
                TargetSystem = targetSystem,
                DataClass = dataClass,
                Search = search,
                Material = material,
                Integration = integration,
                Stage = stage,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Transaction tracker fetched. Tracker: {tracker}, Count: {result.Rows.Count}, Total: {result.Total}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/trackers/{tracker}/{id}")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("GetSilaTransactionTrackerDetail")]
        [SwaggerResponse(200, type: typeof(SilaTrackerDetailDto))]
        public async Task<IActionResult> Detail([FromRoute] string tracker, [FromRoute] string id)
        {
            _logger.LogDebug($"Fetching tracker transaction. Tracker: {tracker}, Id: {id}");
            SilaTrackerDetailDto result = await _mediator.Send(new GetSilaTransactionTrackerDetailQuery
            {
                OrganizationId = GetOrganizationId(),
                Tracker = tracker,
                Id = id
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/trackers/reprocess")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("ReprocessSilaTracker")]
        [SwaggerResponse(200, type: typeof(SilaTrackerReprocessResultDto))]
        public async Task<IActionResult> Reprocess([FromBody] SilaTrackerReprocessRequestDto request)
        {
            _logger.LogDebug($"Reprocessing tracker transactions. Count: {request.Ids.Count}");
            SilaTrackerReprocessResultDto result = await _mediator.Send(new ReprocessSilaTrackerCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Ids = request.Ids
            });
            _logger.LogDebug($"Tracker reprocess finished. Completed: {result.Completed}, Failed: {result.Failed}");
            return Ok(result);
        }
    }
}
