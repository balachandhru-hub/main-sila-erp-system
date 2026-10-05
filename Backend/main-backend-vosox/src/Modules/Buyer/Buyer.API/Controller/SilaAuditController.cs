using Buyer.Application.Features.Queries.GetSilaAuditLog;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>SILA ME audit log: every workflow event (counts, enquiries, alerts, physical inventories, transfers...).</summary>
    [ApiController]
    public class SilaAuditController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaAuditController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/audit")]
        [ApiAuthorization(Name = "VIEW_SILA_AUDIT")]
        [SwaggerOperation("GetSilaAuditLog")]
        [SwaggerResponse(200, type: typeof(List<SilaAuditEventDto>))]
        public async Task<IActionResult> List(
            [FromQuery] string? referenceType,
            [FromQuery] Guid? referenceId,
            [FromQuery] Guid? actor,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching audit log. ReferenceType: {referenceType}, ReferenceId: {referenceId}, Actor: {actor}, Index: {index}, Limit: {limit}");
            List<SilaAuditEventDto> result = await _mediator.Send(new GetSilaAuditLogQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                Actor = actor,
                From = from,
                To = to,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Audit log fetched. Count: {result.Count}");
            return Ok(result);
        }
    }
}
