using Buyer.Application.Features.Commands.DecideSilaMaterialPriceChange;
using Buyer.Application.Features.Commands.SubmitSilaMaterialPriceChange;
using Buyer.Application.Features.Queries.GetSilaMaterialPriceHistory;
using Buyer.Application.Features.Queries.GetSilaPriceApprovals;
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
    /// SILA ME material master: price change requests and their approval, the price history of a material, the material
    /// Excel template / export / import and the ERP material pull (GET_MATERIAL) per company code.
    /// </summary>
    [ApiController]
    public partial class SilaMaterialController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaMaterialController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/materials/{materialId:guid}/price-changes")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("SubmitSilaMaterialPriceChange")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> SubmitPriceChange([FromRoute] Guid materialId, [FromBody] SilaMaterialPriceChangeWriteDto request)
        {
            _logger.LogDebug($"Submitting material price change. MaterialId: {materialId}");
            Guid id = await _mediator.Send(new SubmitSilaMaterialPriceChangeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                MaterialId = materialId,
                Request = request
            });
            _logger.LogDebug($"Material price change submitted. PriceChangeId: {id}");
            return Ok(Success(id, "Price change submitted for approval."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/materials/{materialId:guid}/price-changes")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaMaterialPriceHistory")]
        [SwaggerResponse(200, type: typeof(List<SilaMaterialPriceChangeDto>))]
        public async Task<IActionResult> PriceHistory([FromRoute] Guid materialId, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching material price history. MaterialId: {materialId}, Index: {index}");
            List<SilaMaterialPriceChangeDto> result = await _mediator.Send(new GetSilaMaterialPriceHistoryQuery
            {
                OrganizationId = GetOrganizationId(),
                MaterialId = materialId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Material price history fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/price-approvals")]
        [ApiAuthorization(Name = "APPROVE_SILA_PRICE")]
        [SwaggerOperation("GetSilaPriceApprovals")]
        [SwaggerResponse(200, type: typeof(List<SilaMaterialPriceChangeDto>))]
        public async Task<IActionResult> PriceApprovals([FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching price approvals waiting for the caller. Index: {index}");
            List<SilaMaterialPriceChangeDto> result = await _mediator.Send(new GetSilaPriceApprovalsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Price approvals fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/price-approvals/{priceChangeId:guid}/approve")]
        [ApiAuthorization(Name = "APPROVE_SILA_PRICE")]
        [SwaggerOperation("ApproveSilaMaterialPriceChange")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public Task<IActionResult> ApprovePrice([FromRoute] Guid priceChangeId, [FromBody] SilaPriceDecisionWriteDto request)
        {
            return Decide(priceChangeId, true, request);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/price-approvals/{priceChangeId:guid}/reject")]
        [ApiAuthorization(Name = "APPROVE_SILA_PRICE")]
        [SwaggerOperation("RejectSilaMaterialPriceChange")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public Task<IActionResult> RejectPrice([FromRoute] Guid priceChangeId, [FromBody] SilaPriceDecisionWriteDto request)
        {
            return Decide(priceChangeId, false, request);
        }

        private async Task<IActionResult> Decide(Guid priceChangeId, bool approve, SilaPriceDecisionWriteDto request)
        {
            _logger.LogDebug($"Deciding material price change. PriceChangeId: {priceChangeId}, Approve: {approve}");
            string status = await _mediator.Send(new DecideSilaMaterialPriceChangeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                PriceChangeId = priceChangeId,
                Approve = approve,
                Comment = request?.Comment
            });
            _logger.LogDebug($"Material price change decided. PriceChangeId: {priceChangeId}, Status: {status}");
            return Ok(Success(priceChangeId, status));
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
