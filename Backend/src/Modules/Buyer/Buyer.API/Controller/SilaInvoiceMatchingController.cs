using Buyer.Application.Features.Commands.MatchSilaInvoiceLines;
using Buyer.Application.Features.Commands.MatchSilaInvoicePurchaseOrder;
using Buyer.Application.Features.Commands.MatchSilaInvoiceSupplier;
using Buyer.Application.Features.Queries.GetSilaInvoiceExtractions;
using Buyer.Application.Features.Queries.GetSilaInvoicePoCandidates;
using Buyer.Application.Features.Queries.GetSilaInvoiceSupplierCandidates;
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
    /// SILA ME invoice review: supplier and purchase order matching, line matching and the reading history.
    /// </summary>
    [ApiController]
    public class SilaInvoiceMatchingController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaInvoiceMatchingController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/supplier-candidates")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaInvoiceSupplierCandidates")]
        [SwaggerResponse(200, type: typeof(List<SilaInvoiceSupplierCandidateDto>))]
        public async Task<IActionResult> SupplierCandidates([FromRoute] Guid invoiceId, [FromQuery] string? search)
        {
            _logger.LogDebug($"Fetching invoice supplier candidates. InvoiceId: {invoiceId}, Search: {search}");
            List<SilaInvoiceSupplierCandidateDto> result = await _mediator.Send(new GetSilaInvoiceSupplierCandidatesQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId,
                Search = search
            });
            _logger.LogDebug($"Invoice supplier candidates fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/match-supplier")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("MatchSilaInvoiceSupplier")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> MatchSupplier([FromRoute] Guid invoiceId, [FromBody] SilaInvoiceMatchSupplierDto request)
        {
            _logger.LogDebug($"Matching invoice supplier. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new MatchSilaInvoiceSupplierCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Request = request
            });
            _logger.LogDebug($"Invoice supplier matched. InvoiceId: {invoiceId}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/po-candidates")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaInvoicePoCandidates")]
        [SwaggerResponse(200, type: typeof(List<SilaReceivingPoListItemDto>))]
        public async Task<IActionResult> PoCandidates([FromRoute] Guid invoiceId, [FromQuery] string? search, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching invoice purchase order candidates. InvoiceId: {invoiceId}, Search: {search}");
            List<SilaReceivingPoListItemDto> result = await _mediator.Send(new GetSilaInvoicePoCandidatesQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId,
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Invoice purchase order candidates fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/match-po")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("MatchSilaInvoicePurchaseOrder")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> MatchPurchaseOrder([FromRoute] Guid invoiceId, [FromBody] SilaInvoiceMatchPoDto request)
        {
            _logger.LogDebug($"Matching invoice purchase order. InvoiceId: {invoiceId}, PurchaseOrderId: {request.PurchaseOrderId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new MatchSilaInvoicePurchaseOrderCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Request = request
            });
            _logger.LogDebug($"Invoice purchase order matched. InvoiceId: {invoiceId}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/match-lines")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("MatchSilaInvoiceLines")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> MatchLines([FromRoute] Guid invoiceId, [FromBody] SilaInvoiceMatchLinesDto request)
        {
            _logger.LogDebug($"Matching invoice lines. InvoiceId: {invoiceId}, Lines: {request.Lines?.Count ?? 0}");
            SilaInvoiceDetailDto result = await _mediator.Send(new MatchSilaInvoiceLinesCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Request = request
            });
            _logger.LogDebug($"Invoice lines matched. InvoiceId: {invoiceId}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/extractions")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaInvoiceExtractions")]
        [SwaggerResponse(200, type: typeof(List<SilaInvoiceExtractionDto>))]
        public async Task<IActionResult> Extractions([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Fetching invoice extraction history. InvoiceId: {invoiceId}");
            List<SilaInvoiceExtractionDto> result = await _mediator.Send(new GetSilaInvoiceExtractionsQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice extraction history fetched. Count: {result.Count}");
            return Ok(result);
        }
    }
}
