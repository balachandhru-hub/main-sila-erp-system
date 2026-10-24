using Buyer.Application.Features.Commands.CopySilaInvoice;
using Buyer.Application.Features.Commands.CreateSilaInvoice;
using Buyer.Application.Features.Commands.DecideSilaCreditMemo;
using Buyer.Application.Features.Commands.DecideSilaInvoice;
using Buyer.Application.Features.Commands.PrepareSilaCreateInvoice;
using Buyer.Application.Features.Commands.ExtractSilaInvoice;
using Buyer.Application.Features.Commands.LinkSilaInvoiceGoodsReceipts;
using Buyer.Application.Features.Commands.RemoveSilaInvoiceAttachment;
using Buyer.Application.Features.Commands.RefreshSilaInvoicePosting;
using Buyer.Application.Features.Commands.ReprocessSilaInvoiceAttachment;
using Buyer.Application.Features.Commands.CreateSilaCreditMemo;
using Buyer.Application.Features.Commands.SubmitSilaCreditMemo;
using Buyer.Application.Features.Commands.SubmitSilaInvoice;
using Buyer.Application.Features.Commands.UpdateSilaCreditMemo;
using Buyer.Application.Features.Commands.PostSilaGoodsReceipt;
using Buyer.Application.Features.Commands.ReverseSilaGoodsReceipt;
using Buyer.Application.Features.Queries.GetSilaGoodsReceiptReversal;
using Buyer.Application.Features.Commands.UpdateSilaInvoice;
using Buyer.Application.Features.Commands.UploadSilaInvoice;
using Buyer.Application.Features.Queries.GetSilaCreditMemo;
using Buyer.Application.Features.Queries.GetSilaCreditMemoEligibleLines;
using Buyer.Application.Features.Queries.GetSilaCreditMemos;
using Buyer.Application.Features.Queries.GetSilaCreateInvoiceMasters;
using Buyer.Application.Features.Queries.LookupSilaCreditMemoInvoice;
using Buyer.Application.Features.Queries.GetSilaEligibleGoodsReceipts;
using Buyer.Application.Features.Queries.GetSilaEligiblePurchaseOrders;
using Buyer.Application.Features.Queries.GetSilaGoodsReceipt;
using Buyer.Application.Features.Queries.GetSilaGoodsReceipts;
using Buyer.Application.Features.Queries.GetSilaInvoice;
using Buyer.Application.Features.Queries.GetSilaInvoiceFile;
using Buyer.Application.Features.Queries.GetSilaInvoiceGrnFile;
using Buyer.Application.Features.Queries.GetSilaInvoices;
using Buyer.Application.Features.Queries.GetSilaOpenPurchaseOrders;
using Buyer.Application.Features.Queries.GetSilaReceivingDashboard;
using Buyer.Application.Features.Queries.GetSilaPurchaseOrder;
using Buyer.Application.Features.Queries.ValidateSilaGoodsReceipt;
using Buyer.Domain.Dtos;
using MediatR;
using System.Net.Http.Headers;
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
        [Route("api/v1/buyer/sila/receiving/dashboard")]
        [ApiAuthorization(AnyOf = "VIEW_SILA_RECEIVING,VIEW_SILA_INVOICE,VIEW_SILA_CREDIT_MEMO")]
        [SwaggerOperation("GetSilaReceivingDashboard")]
        [SwaggerResponse(200, type: typeof(SilaReceivingDashboardDto))]
        public async Task<IActionResult> GetReceivingDashboard(
            [FromQuery] Guid? locationId,
            [FromQuery] Guid? propertyId,
            [FromQuery] string? supplier)
        {
            SilaReceivingDashboardDto result = await _mediator.Send(new GetSilaReceivingDashboardQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                PropertyId = propertyId,
                Supplier = supplier,
                PermissionCodes = HttpContext.Items[ApiAuthorizationAttribute.PermissionItemsKey] as List<string>
                    ?? new List<string>()
            });
            return Ok(result);
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

        [HttpGet]
        [Route("api/v1/buyer/sila/grns/{goodsReceiptId}/reversal")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaGoodsReceiptReversal")]
        [SwaggerResponse(200, type: typeof(SilaReceivingGrnReversalPreviewDto))]
        public async Task<IActionResult> GetGoodsReceiptReversal([FromRoute] Guid goodsReceiptId)
        {
            return Ok(await _mediator.Send(new GetSilaGoodsReceiptReversalQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                GoodsReceiptId = goodsReceiptId
            }));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/grns/{goodsReceiptId}/reverse")]
        [ApiAuthorization(Name = "POST_SILA_GRN")]
        [SwaggerOperation("ReverseSilaGoodsReceipt")]
        [SwaggerResponse(200, type: typeof(SilaReceivingGrnReversalResultDto))]
        public async Task<IActionResult> ReverseGoodsReceipt([FromRoute] Guid goodsReceiptId, [FromBody] SilaReceivingGrnReversalWriteDto? request)
        {
            _logger.LogDebug($"Reversing goods receipt. GoodsReceiptId: {goodsReceiptId}");
            SilaReceivingGrnReversalResultDto result = await _mediator.Send(new ReverseSilaGoodsReceiptCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                GoodsReceiptId = goodsReceiptId,
                Request = request ?? new SilaReceivingGrnReversalWriteDto()
            });
            return Ok(result);
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
        [ApiAuthorization(Name = "VIEW_SILA_INVOICE")]
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

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/create/masters")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("GetSilaCreateInvoiceMasters")]
        [SwaggerResponse(200, type: typeof(SilaCreateInvoiceMastersDto))]
        public async Task<IActionResult> CreateMasters()
        {
            return Ok(await _mediator.Send(new GetSilaCreateInvoiceMastersQuery { OrganizationId = GetOrganizationId() }));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/create/purchase-orders")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("GetSilaEligiblePurchaseOrders")]
        [SwaggerResponse(200, type: typeof(List<SilaEligiblePurchaseOrderDto>))]
        public async Task<IActionResult> EligiblePurchaseOrders(
            [FromQuery] Guid? silaSupplierId,
            [FromQuery] Guid? supplierId,
            [FromQuery] string? companyCode,
            [FromQuery] Guid? propertyId,
            [FromQuery] string? search)
        {
            return Ok(await _mediator.Send(new GetSilaEligiblePurchaseOrdersQuery
            {
                OrganizationId = GetOrganizationId(),
                SilaSupplierId = silaSupplierId,
                SupplierId = supplierId,
                CompanyCode = companyCode,
                PropertyId = propertyId,
                Search = search
            }));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/create/purchase-orders/{purchaseOrderId}/goods-receipts")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("GetSilaEligibleGoodsReceipts")]
        [SwaggerResponse(200, type: typeof(List<SilaEligibleGoodsReceiptDto>))]
        public async Task<IActionResult> EligibleGoodsReceipts([FromRoute] Guid purchaseOrderId)
        {
            return Ok(await _mediator.Send(new GetSilaEligibleGoodsReceiptsQuery
            {
                OrganizationId = GetOrganizationId(),
                PurchaseOrderId = purchaseOrderId
            }));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/create")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("CreateSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateInvoice([FromBody] SilaCreateInvoiceRequestDto request)
        {
            Guid result = await _mediator.Send(new CreateSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Request = request
            });
            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Invoice draft created."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/prepare-create")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("PrepareSilaCreateInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> PrepareCreate([FromRoute] Guid invoiceId, [FromBody] SilaCreateInvoiceRequestDto request)
        {
            SilaInvoiceDetailDto result = await _mediator.Send(new PrepareSilaCreateInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Request = request
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/upload")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
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

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/copy")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("CopySilaInvoice")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CopyInvoice([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Copying invoice. InvoiceId: {invoiceId}");
            Guid result = await _mediator.Send(new CopySilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice copied. InvoiceId: {result}");
            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Invoice copied. The copy is not posted to SAP."
            });
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}")]
        [ApiAuthorization(Name = "VIEW_SILA_INVOICE")]
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
        [ApiAuthorization(Name = "VIEW_SILA_INVOICE")]
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
            ContentDispositionHeaderValue disposition = new ContentDispositionHeaderValue("inline")
            {
                FileNameStar = result.FileName
            };
            Response.Headers.ContentDisposition = disposition.ToString();
            return File(result.Content, result.ContentType);
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/attachment")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("RemoveSilaInvoiceAttachment")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> RemoveInvoiceAttachment([FromRoute] Guid invoiceId)
        {
            SilaInvoiceDetailDto result = await _mediator.Send(new RemoveSilaInvoiceAttachmentCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/extract")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
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
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
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
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
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

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/grn-pdf/{goodsReceiptId}")]
        [ApiAuthorization(Name = "VIEW_SILA_INVOICE")]
        [SwaggerOperation("GetSilaInvoiceGrnFile")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> GetInvoiceGrnFile([FromRoute] Guid invoiceId, [FromRoute] Guid goodsReceiptId)
        {
            _logger.LogDebug($"Fetching GRN PDF. InvoiceId: {invoiceId}, GoodsReceiptId: {goodsReceiptId}");
            SilaInvoiceFileDto result = await _mediator.Send(new GetSilaInvoiceGrnFileQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId,
                GoodsReceiptId = goodsReceiptId
            });
            ContentDispositionHeaderValue disposition = new ContentDispositionHeaderValue("inline")
            {
                FileNameStar = result.FileName
            };
            Response.Headers.ContentDisposition = disposition.ToString();
            return File(result.Content, result.ContentType);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/goods-receipts")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("LinkSilaInvoiceGoodsReceipts")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> LinkGoodsReceipts([FromRoute] Guid invoiceId, [FromBody] SilaInvoiceLinkGrnDto request)
        {
            _logger.LogDebug($"Linking goods receipts. InvoiceId: {invoiceId}, Count: {request.GoodsReceiptIds?.Count ?? 0}");
            SilaInvoiceDetailDto result = await _mediator.Send(new LinkSilaInvoiceGoodsReceiptsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId,
                Request = request
            });
            _logger.LogDebug($"Goods receipts linked. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/submit")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("SubmitSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> SubmitInvoice([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Submitting invoice. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new SubmitSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice submission finished. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/refresh-posting")]
        [ApiAuthorization(Name = "MANAGE_SILA_ERP_POSTING")]
        [SwaggerOperation("RefreshSilaInvoicePosting")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> RefreshPosting([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Refreshing invoice posting data. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new RefreshSilaInvoicePostingCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice posting data refreshed. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/attachment/reprocess")]
        [ApiAuthorization(Name = "PROCESS_SILA_INVOICE")]
        [SwaggerOperation("ReprocessSilaInvoiceAttachment")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> ReprocessAttachment([FromRoute] Guid invoiceId)
        {
            _logger.LogDebug($"Reprocessing invoice attachment. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new ReprocessSilaInvoiceAttachmentCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                InvoiceId = invoiceId
            });
            _logger.LogDebug($"Invoice attachment reprocess finished. InvoiceId: {invoiceId}, Status: {result.Attachment.Status}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/approval")]
        [ApiAuthorization(Name = "APPROVE_SILA_INVOICE")]
        [SwaggerOperation("DecideSilaInvoice")]
        [SwaggerResponse(200, type: typeof(SilaInvoiceDetailDto))]
        public async Task<IActionResult> DecideInvoice([FromRoute] Guid invoiceId, [FromBody] SilaInvoiceDecisionDto request)
        {
            _logger.LogDebug($"Deciding invoice approval. InvoiceId: {invoiceId}");
            SilaInvoiceDetailDto result = await _mediator.Send(new DecideSilaInvoiceCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                InvoiceId = invoiceId,
                Request = request ?? new SilaInvoiceDecisionDto()
            });
            _logger.LogDebug($"Invoice approval finished. InvoiceId: {invoiceId}, Status: {result.Status}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/credit-memos/reference-invoices")]
        [ApiAuthorization(AnyOf = "VIEW_SILA_CREDIT_MEMO,PROCESS_SILA_CREDIT_MEMO")]
        [SwaggerOperation("LookupSilaCreditMemoInvoice")]
        [SwaggerResponse(200, type: typeof(List<SilaCreditMemoReferenceInvoiceDto>))]
        public async Task<IActionResult> LookupCreditMemoInvoice([FromQuery] Guid? invoiceId, [FromQuery] string? invoiceNumber, [FromQuery] string? erpInvoiceId, [FromQuery] int limit = 20)
        {
            return Ok(await _mediator.Send(new LookupSilaCreditMemoInvoiceQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId,
                InvoiceNumber = invoiceNumber,
                ErpInvoiceId = erpInvoiceId,
                Limit = limit
            }));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/invoices/{invoiceId}/credit-memo-lines")]
        [ApiAuthorization(AnyOf = "VIEW_SILA_CREDIT_MEMO,PROCESS_SILA_CREDIT_MEMO")]
        [SwaggerOperation("GetSilaCreditMemoEligibleLines")]
        [SwaggerResponse(200, type: typeof(List<SilaCreditMemoEligibleLineDto>))]
        public async Task<IActionResult> CreditMemoLines([FromRoute] Guid invoiceId)
        {
            return Ok(await _mediator.Send(new GetSilaCreditMemoEligibleLinesQuery
            {
                OrganizationId = GetOrganizationId(),
                InvoiceId = invoiceId
            }));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/credit-memos")]
        [ApiAuthorization(Name = "VIEW_SILA_CREDIT_MEMO")]
        [SwaggerOperation("GetSilaCreditMemos")]
        [SwaggerResponse(200, type: typeof(List<SilaCreditMemoListItemDto>))]
        public async Task<IActionResult> ListCreditMemos([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching credit memos. Search: {search}, Status: {status}");
            List<SilaCreditMemoListItemDto> result = await _mediator.Send(new GetSilaCreditMemosQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Credit memos fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/credit-memos")]
        [ApiAuthorization(Name = "PROCESS_SILA_CREDIT_MEMO")]
        [SwaggerOperation("CreateSilaCreditMemo")]
        [SwaggerResponse(200, type: typeof(SilaCreditMemoDetailDto))]
        public async Task<IActionResult> CreateCreditMemo([FromBody] SilaCreditMemoWriteDto request)
        {
            return Ok(await _mediator.Send(new CreateSilaCreditMemoCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Request = request ?? new SilaCreditMemoWriteDto()
            }));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/credit-memos/{creditMemoId}")]
        [ApiAuthorization(Name = "VIEW_SILA_CREDIT_MEMO")]
        [SwaggerOperation("GetSilaCreditMemo")]
        [SwaggerResponse(200, type: typeof(SilaCreditMemoDetailDto))]
        public async Task<IActionResult> GetCreditMemo([FromRoute] Guid creditMemoId)
        {
            return Ok(await _mediator.Send(new GetSilaCreditMemoQuery
            {
                OrganizationId = GetOrganizationId(),
                CreditMemoId = creditMemoId
            }));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/credit-memos/{creditMemoId}")]
        [ApiAuthorization(Name = "PROCESS_SILA_CREDIT_MEMO")]
        [SwaggerOperation("UpdateSilaCreditMemo")]
        [SwaggerResponse(200, type: typeof(SilaCreditMemoDetailDto))]
        public async Task<IActionResult> UpdateCreditMemo([FromRoute] Guid creditMemoId, [FromBody] SilaCreditMemoWriteDto request)
        {
            return Ok(await _mediator.Send(new UpdateSilaCreditMemoCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                CreditMemoId = creditMemoId,
                Request = request ?? new SilaCreditMemoWriteDto()
            }));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/credit-memos/{creditMemoId}/submit")]
        [ApiAuthorization(Name = "PROCESS_SILA_CREDIT_MEMO")]
        [SwaggerOperation("SubmitSilaCreditMemo")]
        [SwaggerResponse(200, type: typeof(SilaCreditMemoDetailDto))]
        public async Task<IActionResult> SubmitCreditMemo([FromRoute] Guid creditMemoId)
        {
            return Ok(await _mediator.Send(new SubmitSilaCreditMemoCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                CreditMemoId = creditMemoId
            }));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/credit-memos/{creditMemoId}/retry")]
        [ApiAuthorization(Name = "PROCESS_SILA_CREDIT_MEMO")]
        [SwaggerOperation("RetrySilaCreditMemo")]
        [SwaggerResponse(200, type: typeof(SilaCreditMemoDetailDto))]
        public async Task<IActionResult> RetryCreditMemo([FromRoute] Guid creditMemoId)
        {
            return Ok(await _mediator.Send(new SubmitSilaCreditMemoCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                CreditMemoId = creditMemoId,
                Retry = true
            }));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/credit-memos/{creditMemoId}/approval")]
        [ApiAuthorization(Name = "APPROVE_SILA_CREDIT_MEMO")]
        [SwaggerOperation("DecideSilaCreditMemo")]
        [SwaggerResponse(200, type: typeof(SilaCreditMemoDetailDto))]
        public async Task<IActionResult> DecideCreditMemo([FromRoute] Guid creditMemoId, [FromBody] SilaInvoiceDecisionDto request)
        {
            return Ok(await _mediator.Send(new DecideSilaCreditMemoCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                CreditMemoId = creditMemoId,
                Request = request ?? new SilaInvoiceDecisionDto()
            }));
        }
    }
}
