using Buyer.Application.Features.Commands.CreateSilaSupplier;
using Buyer.Application.Features.Commands.DeleteSilaSupplier;
using Buyer.Application.Features.Commands.ImportSilaSuppliers;
using Buyer.Application.Features.Commands.PullSilaSuppliers;
using Buyer.Application.Features.Commands.UpdateSilaSupplier;
using Buyer.Application.Features.Queries.GetSilaSupplier;
using Buyer.Application.Features.Queries.GetSilaSupplierFile;
using Buyer.Application.Features.Queries.GetSilaSuppliers;
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
    /// SILA ME Supplier Master: suppliers invoices are matched to and ERP purchase orders belong to.
    /// </summary>
    [ApiController]
    public class SilaSupplierController : BaseController
    {
        // 5 MB workbook plus the multipart envelope.
        private const long UPLOAD_LIMIT = 6L * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaSupplierController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/suppliers")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaSuppliers")]
        [SwaggerResponse(200, type: typeof(List<SilaSupplierDto>))]
        public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching suppliers. Search: {search}, Status: {status}, Index: {index}, Limit: {limit}");
            List<SilaSupplierDto> result = await _mediator.Send(new GetSilaSuppliersQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Suppliers fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/suppliers/{supplierId:guid}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaSupplier")]
        [SwaggerResponse(200, type: typeof(SilaSupplierDto))]
        public async Task<IActionResult> Get([FromRoute] Guid supplierId)
        {
            _logger.LogDebug($"Fetching supplier. SupplierId: {supplierId}");
            SilaSupplierDto result = await _mediator.Send(new GetSilaSupplierQuery { OrganizationId = GetOrganizationId(), SupplierId = supplierId });
            _logger.LogDebug($"Supplier fetched. SupplierId: {supplierId}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/suppliers")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("CreateSilaSupplier")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromBody] SilaSupplierWriteDto request)
        {
            _logger.LogDebug($"Creating supplier. SupplierCode: {request.SupplierCode}");
            Guid result = await _mediator.Send(new CreateSilaSupplierCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), Request = request });
            _logger.LogDebug($"Supplier created. SupplierId: {result}");
            return Ok(Success(result, "Supplier saved."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/suppliers/{supplierId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("UpdateSilaSupplier")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Update([FromRoute] Guid supplierId, [FromBody] SilaSupplierWriteDto request)
        {
            _logger.LogDebug($"Updating supplier. SupplierId: {supplierId}");
            Guid result = await _mediator.Send(new UpdateSilaSupplierCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), SupplierId = supplierId, Request = request });
            _logger.LogDebug($"Supplier updated. SupplierId: {result}");
            return Ok(Success(result, "Supplier saved."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/suppliers/{supplierId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("DeleteSilaSupplier")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Delete([FromRoute] Guid supplierId)
        {
            _logger.LogDebug($"Deleting supplier. SupplierId: {supplierId}");
            Guid result = await _mediator.Send(new DeleteSilaSupplierCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), SupplierId = supplierId });
            _logger.LogDebug($"Supplier deleted. SupplierId: {result}");
            return Ok(Success(result, "Supplier deleted."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/suppliers/template")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaSupplierTemplate")]
        public async Task<IActionResult> Template()
        {
            _logger.LogDebug("Downloading supplier template.");
            SilaReceivingFileDto file = await _mediator.Send(new GetSilaSupplierFileQuery { OrganizationId = GetOrganizationId(), Template = true });
            _logger.LogDebug($"Supplier template built. Bytes: {file.Content.Length}");
            return File(file.Content, file.ContentType, file.FileName);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/suppliers/export")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("ExportSilaSuppliers")]
        public async Task<IActionResult> Export()
        {
            _logger.LogDebug("Exporting suppliers.");
            SilaReceivingFileDto file = await _mediator.Send(new GetSilaSupplierFileQuery { OrganizationId = GetOrganizationId(), Template = false });
            _logger.LogDebug($"Suppliers exported. Bytes: {file.Content.Length}");
            return File(file.Content, file.ContentType, file.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/suppliers/import/preview")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("PreviewSilaSupplierImport")]
        [SwaggerResponse(200, type: typeof(SilaMasterImportResultDto))]
        public Task<IActionResult> Preview(IFormFile file)
        {
            return ImportAsync(file, false);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/suppliers/import")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("ImportSilaSuppliers")]
        [SwaggerResponse(200, type: typeof(SilaMasterImportResultDto))]
        public Task<IActionResult> Import(IFormFile file)
        {
            return ImportAsync(file, true);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/suppliers/pull")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("PullSilaSuppliers")]
        [SwaggerResponse(200, type: typeof(SilaMasterPullResultDto))]
        public async Task<IActionResult> Pull()
        {
            _logger.LogDebug("Pulling suppliers from the ERP.");
            SilaMasterPullResultDto result = await _mediator.Send(new PullSilaSuppliersCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId() });
            _logger.LogDebug($"Suppliers pulled. Read: {result.Read}, Created: {result.Created}, Updated: {result.Updated}");
            return Ok(result);
        }

        private async Task<IActionResult> ImportAsync(IFormFile? file, bool commit)
        {
            _logger.LogDebug($"Importing suppliers. FileName: {file?.FileName}, Bytes: {file?.Length}, Commit: {commit}");
            byte[] content = Array.Empty<byte>();
            if (file != null && file.Length > 0)
            {
                using MemoryStream stream = new MemoryStream();
                await file.CopyToAsync(stream);
                content = stream.ToArray();
            }

            SilaMasterImportResultDto result = await _mediator.Send(new ImportSilaSuppliersCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Commit = commit,
                FileName = file?.FileName ?? string.Empty,
                Content = content
            });
            _logger.LogDebug($"Supplier file processed. Rows: {result.TotalRows}, Invalid: {result.InvalidRows}, Committed: {result.Committed}");
            return Ok(result);
        }

        private static SuccessResponseDto Success(Guid id, string description)
        {
            return new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = description };
        }
    }
}
