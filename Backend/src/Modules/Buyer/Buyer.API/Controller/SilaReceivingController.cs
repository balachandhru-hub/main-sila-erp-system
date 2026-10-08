using Buyer.Application.Features.Commands.ExtractSilaInvoice;
using Buyer.Application.Features.Commands.PostSilaGoodsReceipt;
using Buyer.Application.Features.Commands.UpdateSilaInvoice;
using Buyer.Application.Features.Commands.UploadSilaInvoice;
using Buyer.Application.Features.Queries.GetSilaGoodsReceipt;
using Buyer.Application.Features.Queries.GetSilaGoodsReceipts;
using Buyer.Application.Features.Queries.GetSilaInvoice;
using Buyer.Application.Features.Queries.GetSilaInvoiceFile;
using Buyer.Application.Features.Queries.GetSilaInvoices;
using Buyer.Application.Features.Queries.GetSilaOpenPurchaseOrders;
using Buyer.Application.Features.Queries.GetSilaPurchaseOrder;
using Buyer.Application.Features.Queries.ValidateSilaGoodsReceipt;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME receiving: open purchase orders, goods receipts (GRN) and supplier invoices with OCR.
    /// </summary>
    [ApiController]
    public class SilaReceivingController : BaseController
    {
        // 20 MB invoice plus the multipart envelope.
        private const long UPLOAD_LIMIT = 21L * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaReceivingController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/purchase-orders/open")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaOpenPurchaseOrders")]
        [SwaggerResponse(200, type: typeof(List<SilaReceivingPoListItemDto>))]
        public async Task<IActionResult> ListOpenPurchaseOrders([FromQuery] string? search, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching open purchase orders. Search: {search}, Index: {index}, Limit: {limit}");
            List<SilaReceivingPoListItemDto> result = await _mediator.Send(new GetSilaOpenPurchaseOrdersQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Open purchase orders fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/purchase-orders/{purchaseOrderId}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaPurchaseOrder")]
        [SwaggerResponse(200, type: typeof(SilaReceivingPoDetailDto))]
        public async Task<IActionResult> GetPurchaseOrder([FromRoute] Guid purchaseOrderId)
        {
            _logger.LogDebug($"Fetching purchase order for receiving. PurchaseOrderId: {purchaseOrderId}");
            SilaReceivingPoDetailDto result = await _mediator.Send(new GetSilaPurchaseOrderQuery
            {
                OrganizationId = GetOrganizationId(),
                PurchaseOrderId = purchaseOrderId
            });
            _logger.LogDebug($"Purchase order for receiving fetched. PurchaseOrderId: {purchaseOrderId}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/grns")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaGoodsReceipts")]
        [SwaggerResponse(200, type: typeof(List<SilaReceivingGrnListItemDto>))]
        public async Task<IActionResult> ListGoodsReceipts(
            [FromQuery] string? search,
            [FromQuery] DateTime? fromDate,
            [FromQuery] DateTime? toDate,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching goods receipts. Search: {search}, From: {fromDate}, To: {toDate}");
            List<SilaReceivingGrnListItemDto> result = await _mediator.Send(new GetSilaGoodsReceiptsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Search = search,
                FromDate = fromDate,
                ToDate = toDate,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Goods receipts fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/grns/{goodsReceiptId}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaGoodsReceipt")]
        [SwaggerResponse(200, type: typeof(SilaReceivingGrnDetailDto))]
        public async Task<IActionResult> GetGoodsReceipt([FromRoute] Guid goodsReceiptId)
        {
            _logger.LogDebug($"Fetching goods receipt. GoodsReceiptId: {goodsReceiptId}");
            SilaReceivingGrnDetailDto result = await _mediator.Send(new GetSilaGoodsReceiptQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                GoodsReceiptId = goodsReceiptId
            });
            _logger.LogDebug($"Goods receipt fetched. GrnNumber: {result.GrnNumber}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/grns")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("PostSilaGoodsReceipt")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> PostGoodsReceipt([FromBody] SilaReceivingGrnWriteDto request)
        {
            _logger.LogDebug($"Posting goods receipt. PurchaseOrderId: {request.PurchaseOrderId}, LocationId: {request.LocationId}");
            Guid result = await _mediator.Send(new PostSilaGoodsReceiptCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Goods receipt posted. GoodsReceiptId: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Goods receipt posted."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/grns/validate")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("ValidateSilaGoodsReceipt")]
        [SwaggerResponse(200, type: typeof(SilaReceivingGrnValidationDto))]
        public async Task<IActionResult> ValidateGoodsReceipt([FromBody] SilaReceivingGrnWriteDto request)
        {
            _logger.LogDebug($"Validating goods receipt. PurchaseOrderId: {request.PurchaseOrderId}, LocationId: {request.LocationId}");
            SilaReceivingGrnValidationDto result = await _mediator.Send(new ValidateSilaGoodsReceiptQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Goods receipt validated. Valid: {result.Valid}, Errors: {result.Errors.Count}, Warnings: {result.Warnings.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaInvoices")]
        [SwaggerResponse(200, type: typeof(List<SilaInvoiceListItemDto>))]
        public async Task<IActionResult> ListInvoices([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching invoices. Search: {search}, Status: {status}");
            List<SilaInvoiceListItemDto> result = await _mediator.Send(new GetSilaInvoicesQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Invoices fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/upload")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("UploadSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UploadInvoice(IFormFile file)
        {
            _logger.LogDebug($"Uploading invoice. FileName: {file?.FileName}, Bytes: {file?.Length}");
            byte[] content = Array.Empty<byte>();
            if (file != null && file.Length > 0)
            {
                using MemoryStream stream = new MemoryStream();
                await file.CopyToAsync(stream);
                content = stream.ToArray();
            }

            Guid result = await _mediator.Send(new UploadSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Request = new SilaInvoiceUploadDto
                {
                    FileName = file?.FileName ?? string.Empty,
                    ContentType = file?.ContentType,
                    Content = content
                }
            });
            _logger.LogDebug($"Invoice uploaded. InvoiceId: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Invoice uploaded."
            });
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> GetInvoice([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Fetching invoice. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new GetSilaInvoiceQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice fetched. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/file")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaInvoiceFile")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> GetInvoiceFile([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Fetching invoice file. InvoiceId: {invoiceId}");
            SilaInvoiceFileDto result = await _mediator.Send(new GetSilaInvoiceFileQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice file fetched. InvoiceId: {invoiceId}, Bytes: {result.Content.Length}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/extract")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("ExtractSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> ExtractInvoice([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Extracting invoice with OCR. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new ExtractSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice extraction finished. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/reread")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("RereadSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> RereadInvoice([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Re-reading invoice. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new ExtractSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Trigger = "REREAD"
            });
            _logger.LogDebug($"Invoice re-read. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("UpdateSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> UpdateInvoice([FromRoute] Guid invoiceId, [FromBody] SilaInvoiceWriteDto request)
        {
            _logger.LogDebug($"Saving reviewed invoice. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new UpdateSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Request = request
            });
            _logger.LogDebug($"Invoice reviewed. InvoiceId: {invoiceId}");
            return Ok(result);
        }
    }
}
