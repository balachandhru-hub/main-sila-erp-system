using Buyer.Application.Features.Commands.ImportSilaPurchaseOrders;
using Buyer.Application.Features.Commands.PullSilaPurchaseOrders;
using Buyer.Application.Features.Commands.SaveSilaOcrConfiguration;
using Buyer.Application.Features.Queries.GetSilaOcrConfiguration;
using Buyer.Application.Features.Queries.GetSilaPoImportTemplate;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME receiving data updates: ERP purchase orders from Excel or from the ERP (GET_PO), and the invoice reading (OCR)
    /// settings.
    /// </summary>
    [ApiController]
    public class SilaPoImportController : BaseController
    {
        private const long UPLOAD_LIMIT = 6L * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaPoImportController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/purchase-orders/import/template")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaPoImportTemplate")]
        public async Task<IActionResult> Template()
        {
            _logger.LogDebug("Downloading purchase order import template.");
            SilaReceivingFileDto file = await _mediator.Send(new GetSilaPoImportTemplateQuery { OrganizationId = GetOrganizationId() });
            _logger.LogDebug($"Purchase order import template built. Bytes: {file.Content.Length}");
            return File(file.Content, file.ContentType, file.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/purchase-orders/import/preview")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("PreviewSilaPoImport")]
        [SwaggerResponse(200, type: typeof(SilaMasterImportResultDto))]
        public Task<IActionResult> Preview(IFormFile file)
        {
            return ImportAsync(file, false);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/purchase-orders/import")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("ImportSilaPurchaseOrders")]
        [SwaggerResponse(200, type: typeof(SilaMasterImportResultDto))]
        public Task<IActionResult> Import(IFormFile file)
        {
            return ImportAsync(file, true);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/purchase-orders/pull")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("PullSilaPurchaseOrders")]
        [SwaggerResponse(200, type: typeof(SilaMasterPullResultDto))]
        public async Task<IActionResult> Pull()
        {
            _logger.LogDebug("Pulling purchase orders from the ERP.");
            SilaMasterPullResultDto result = await _mediator.Send(new PullSilaPurchaseOrdersCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId() });
            _logger.LogDebug($"Purchase orders pulled. Read: {result.Read}, Created: {result.Created}, Updated: {result.Updated}, Invalid: {result.Invalid}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/ocr-configuration")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaOcrConfiguration")]
        [SwaggerResponse(200, type: typeof(SilaOcrConfigurationDto))]
        public async Task<IActionResult> GetOcrConfiguration()
        {
            _logger.LogDebug("Fetching OCR configuration.");
            SilaOcrConfigurationDto result = await _mediator.Send(new GetSilaOcrConfigurationQuery { OrganizationId = GetOrganizationId() });
            _logger.LogDebug($"OCR configuration fetched. Provider: {result.Provider}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/ocr-configuration")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("SaveSilaOcrConfiguration")]
        [SwaggerResponse(200, type: typeof(SilaOcrConfigurationDto))]
        public async Task<IActionResult> SaveOcrConfiguration([FromBody] SilaOcrConfigurationWriteDto request)
        {
            _logger.LogDebug($"Saving OCR configuration. Provider: {request.Provider}");
            SilaOcrConfigurationDto result = await _mediator.Send(new SaveSilaOcrConfigurationCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), Request = request });
            _logger.LogDebug($"OCR configuration saved. Provider: {result.Provider}");
            return Ok(result);
        }

        private async Task<IActionResult> ImportAsync(IFormFile? file, bool commit)
        {
            _logger.LogDebug($"Importing purchase orders. FileName: {file?.FileName}, Bytes: {file?.Length}, Commit: {commit}");
            byte[] content = Array.Empty<byte>();
            if (file != null && file.Length > 0)
            {
                using MemoryStream stream = new MemoryStream();
                await file.CopyToAsync(stream);
                content = stream.ToArray();
            }

            SilaMasterImportResultDto result = await _mediator.Send(new ImportSilaPurchaseOrdersCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Commit = commit,
                FileName = file?.FileName ?? string.Empty,
                Content = content
            });
            _logger.LogDebug($"Purchase order file processed. Rows: {result.TotalRows}, Invalid: {result.InvalidRows}, Committed: {result.Committed}");
            return Ok(result);
        }
    }
}
