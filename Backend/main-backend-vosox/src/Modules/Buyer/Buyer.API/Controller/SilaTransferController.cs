using Buyer.Application.Features.Commands.ApproveSilaTransfer;
using Buyer.Application.Features.Commands.CancelSilaTransfer;
using Buyer.Application.Features.Commands.ConfirmSilaTransferHandover;
using Buyer.Application.Features.Commands.CreateSilaQuickTransfer;
using Buyer.Application.Features.Commands.CreateSilaTransfer;
using Buyer.Application.Features.Commands.DispatchSilaTransfer;
using Buyer.Application.Features.Commands.DisputeSilaTransfer;
using Buyer.Application.Features.Commands.ReceiveSilaTransfer;
using Buyer.Application.Features.Commands.RejectSilaTransfer;
using Buyer.Application.Features.Queries.GetSilaTransfer;
using Buyer.Application.Features.Queries.GetSilaTransfers;
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
    /// SILA ME internal transfer orders (ITO) between locations of the same property:
    /// request, approve / reject, dispatch, receive, cancel, and the quick transfer that is dispatched at once.
    /// </summary>
    [ApiController]
    public class SilaTransferController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaTransferController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/transfers")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaTransfers")]
        [SwaggerResponse(200, type: typeof(List<SilaTransferListItemDto>))]
        public async Task<IActionResult> List(
            [FromQuery] string? tab,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 50,
            [FromQuery] string? mode = null,
            [FromQuery] Guid? fromLocationId = null,
            [FromQuery] Guid? toLocationId = null,
            [FromQuery] Guid? propertyId = null,
            [FromQuery] DateTime? fromDate = null,
            [FromQuery] DateTime? toDate = null)
        {
            _logger.LogDebug($"Fetching transfers. Tab: {tab}, Index: {index}, Limit: {limit}");
            List<SilaTransferListItemDto> result = await _mediator.Send(new GetSilaTransfersQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Tab = tab ?? string.Empty,
                Index = index,
                Limit = limit,
                Mode = mode,
                FromLocationId = fromLocationId,
                ToLocationId = toLocationId,
                PropertyId = propertyId,
                FromDate = fromDate,
                ToDate = toDate
            });
            _logger.LogDebug($"Transfers fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/transfers/{transferId}")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SilaTransferDetailDto))]
        public async Task<IActionResult> Get([FromRoute] Guid transferId)
        {
            _logger.LogDebug($"Fetching transfer. TransferId: {transferId}");
            SilaTransferDetailDto result = await _mediator.Send(new GetSilaTransferQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId
            });
            _logger.LogDebug($"Transfer fetched. ItoNumber: {result.ItoNumber}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers")]
        [ApiAuthorization(Name = "MANAGE_SILA_TRANSFER")]
        [SwaggerOperation("CreateSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromBody] SilaTransferWriteDto request)
        {
            _logger.LogDebug($"Creating transfer. From: {request.FromLocationId}, To: {request.ToLocationId}");
            Guid id = await _mediator.Send(new CreateSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Transfer created. TransferId: {id}");
            return Ok(Success(id, "Transfer requested."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/quick")]
        [ApiAuthorization(Name = "MANAGE_SILA_TRANSFER")]
        [SwaggerOperation("CreateSilaQuickTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateQuick([FromBody] SilaTransferWriteDto request)
        {
            _logger.LogDebug($"Creating quick transfer. From: {request.FromLocationId}, To: {request.ToLocationId}");
            Guid id = await _mediator.Send(new CreateSilaQuickTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Quick transfer dispatched. TransferId: {id}");
            return Ok(Success(id, "Quick transfer dispatched."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/approve")]
        [ApiAuthorization(Name = "APPROVE_SILA_TRANSFER")]
        [SwaggerOperation("ApproveSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Approve([FromRoute] Guid transferId, [FromBody] SilaTransferQuantitiesDto request)
        {
            _logger.LogDebug($"Approving transfer. TransferId: {transferId}");
            await _mediator.Send(new ApproveSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request
            });
            _logger.LogDebug($"Transfer approved. TransferId: {transferId}");
            return Ok(Success(transferId, "Transfer approved."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/reject")]
        [ApiAuthorization(Name = "APPROVE_SILA_TRANSFER")]
        [SwaggerOperation("RejectSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Reject([FromRoute] Guid transferId, [FromBody] SilaTransferCommentDto request)
        {
            _logger.LogDebug($"Rejecting transfer. TransferId: {transferId}");
            await _mediator.Send(new RejectSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request
            });
            _logger.LogDebug($"Transfer rejected. TransferId: {transferId}");
            return Ok(Success(transferId, "Transfer rejected."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/dispatch")]
        [ApiAuthorization(Name = "APPROVE_SILA_TRANSFER")]
        [SwaggerOperation("DispatchSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Dispatch([FromRoute] Guid transferId, [FromBody] SilaTransferCommentDto? request)
        {
            _logger.LogDebug($"Dispatching transfer. TransferId: {transferId}");
            await _mediator.Send(new DispatchSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request ?? new SilaTransferCommentDto()
            });
            _logger.LogDebug($"Transfer dispatched. TransferId: {transferId}");
            return Ok(Success(transferId, "Transfer dispatched."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/receive")]
        [ApiAuthorization(Name = "MANAGE_SILA_TRANSFER")]
        [SwaggerOperation("ReceiveSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Receive([FromRoute] Guid transferId, [FromBody] SilaTransferQuantitiesDto request)
        {
            _logger.LogDebug($"Receiving transfer. TransferId: {transferId}");
            await _mediator.Send(new ReceiveSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request
            });
            _logger.LogDebug($"Transfer received. TransferId: {transferId}");
            return Ok(Success(transferId, "Transfer received."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/cancel")]
        [ApiAuthorization(Name = "MANAGE_SILA_TRANSFER")]
        [SwaggerOperation("CancelSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Cancel([FromRoute] Guid transferId, [FromBody] SilaTransferCommentDto? request)
        {
            _logger.LogDebug($"Cancelling transfer. TransferId: {transferId}");
            await _mediator.Send(new CancelSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request ?? new SilaTransferCommentDto()
            });
            _logger.LogDebug($"Transfer cancelled. TransferId: {transferId}");
            return Ok(Success(transferId, "Transfer cancelled."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/handover")]
        [ApiAuthorization(Name = "APPROVE_SILA_TRANSFER")]
        [SwaggerOperation("ConfirmSilaTransferHandover")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> ConfirmHandover([FromRoute] Guid transferId, [FromBody] SilaTransferCommentDto? request)
        {
            _logger.LogDebug($"Confirming transfer handover. TransferId: {transferId}");
            await _mediator.Send(new ConfirmSilaTransferHandoverCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request ?? new SilaTransferCommentDto()
            });
            _logger.LogDebug($"Transfer handover confirmed. TransferId: {transferId}");
            return Ok(Success(transferId, "Handover confirmed."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/transfers/{transferId}/dispute")]
        [ApiAuthorization(Name = "APPROVE_SILA_TRANSFER")]
        [SwaggerOperation("DisputeSilaTransfer")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Dispute([FromRoute] Guid transferId, [FromBody] SilaTransferCommentDto request)
        {
            _logger.LogDebug($"Disputing transfer handover. TransferId: {transferId}");
            await _mediator.Send(new DisputeSilaTransferCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                TransferId = transferId,
                Request = request ?? new SilaTransferCommentDto()
            });
            _logger.LogDebug($"Transfer handover disputed. TransferId: {transferId}");
            return Ok(Success(transferId, "Handover disputed."));
        }

        private static SuccessResponseDto Success(Guid id, string description)
        {
            return new SuccessResponseDto
            {
                Id = id.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = description
            };
        }
    }
}
