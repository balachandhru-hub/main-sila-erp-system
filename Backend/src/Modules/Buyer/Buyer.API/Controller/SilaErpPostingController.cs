using Buyer.Application.Features.Commands.ReconcileSilaErpPosting;
using Buyer.Application.Features.Commands.ReprocessSilaErpPosting;
using Buyer.Application.Features.Queries.GetSilaErpPostings;
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
    /// SILA ME ERP postings: the inventory documents queued for the ERP and their outcome.
    /// </summary>
    [ApiController]
    public class SilaErpPostingController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaErpPostingController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/erp-postings")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("GetSilaErpPostings")]
        [SwaggerResponse(200, type: typeof(List<SilaErpPostingListItemDto>))]
        public async Task<IActionResult> List([FromQuery] string? status, [FromQuery] string? search, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching ERP postings. Status: {status}, Search: {search}, Index: {index}, Limit: {limit}");
            List<SilaErpPostingListItemDto> result = await _mediator.Send(new GetSilaErpPostingsQuery
            {
                OrganizationId = GetOrganizationId(),
                Status = status,
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"ERP postings fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/erp-postings/{postingId}/reprocess")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("ReprocessSilaErpPosting")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Reprocess([FromRoute] Guid postingId)
        {
            _logger.LogDebug($"Reprocessing ERP posting. PostingId: {postingId}");
            Guid result = await _mediator.Send(new ReprocessSilaErpPostingCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                PostingId = postingId
            });
            _logger.LogDebug($"ERP posting queued again. PostingId: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "The posting is queued and will be sent to the ERP within a minute."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/erp-postings/{postingId}/reconcile")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("ReconcileSilaErpPosting")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Reconcile([FromRoute] Guid postingId, [FromBody] SilaErpPostingReconcileDto request)
        {
            _logger.LogDebug($"Reconciling ERP posting. PostingId: {postingId}, Posted: {request.Posted}");
            Guid result = await _mediator.Send(new ReconcileSilaErpPostingCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                PostingId = postingId,
                Request = request
            });
            _logger.LogDebug($"ERP posting reconciled. PostingId: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = request.Posted ? "The posting is marked as posted." : "The posting is queued and will be sent to the ERP again."
            });
        }
    }
}
