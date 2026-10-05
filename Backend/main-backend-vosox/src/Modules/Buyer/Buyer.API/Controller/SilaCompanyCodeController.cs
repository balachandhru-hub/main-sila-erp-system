using Buyer.Application.Features.Commands.CreateSilaCompanyCode;
using Buyer.Application.Features.Commands.DeleteSilaCompanyCode;
using Buyer.Application.Features.Commands.ImportSilaCompanyCodes;
using Buyer.Application.Features.Commands.SetSilaCompanyCodeStatus;
using Buyer.Application.Features.Commands.UpdateSilaCompanyCode;
using Buyer.Application.Features.Queries.GetSilaCompanyCodeFile;
using Buyer.Application.Features.Queries.GetSilaCompanyCodes;
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
    /// SILA ME Company Code Master: the company codes ERP APIs (SAP, Ariba) are configured per.
    /// </summary>
    [ApiController]
    public class SilaCompanyCodeController : BaseController
    {
        private const long UPLOAD_LIMIT = 6L * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaCompanyCodeController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/company-codes")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("GetSilaCompanyCodes")]
        [SwaggerResponse(200, type: typeof(List<SilaCompanyCodeDto>))]
        public async Task<IActionResult> List([FromQuery] string? search, [FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching company codes. Search: {search}, Status: {status}, Index: {index}, Limit: {limit}");
            List<SilaCompanyCodeDto> result = await _mediator.Send(new GetSilaCompanyCodesQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Company codes fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/company-codes")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("CreateSilaCompanyCode")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromBody] SilaCompanyCodeWriteDto request)
        {
            _logger.LogDebug($"Creating company code. Code: {request.Code}");
            Guid result = await _mediator.Send(new CreateSilaCompanyCodeCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), Request = request });
            _logger.LogDebug($"Company code created. CompanyCodeId: {result}");
            return Ok(Success(result, "Company code saved."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/company-codes/{companyCodeId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("UpdateSilaCompanyCode")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Update([FromRoute] Guid companyCodeId, [FromBody] SilaCompanyCodeWriteDto request)
        {
            _logger.LogDebug($"Updating company code. CompanyCodeId: {companyCodeId}");
            Guid result = await _mediator.Send(new UpdateSilaCompanyCodeCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), CompanyCodeId = companyCodeId, Request = request });
            _logger.LogDebug($"Company code updated. CompanyCodeId: {result}");
            return Ok(Success(result, "Company code saved."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/company-codes/{companyCodeId:guid}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("DeleteSilaCompanyCode")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Delete([FromRoute] Guid companyCodeId)
        {
            _logger.LogDebug($"Deleting company code. CompanyCodeId: {companyCodeId}");
            Guid result = await _mediator.Send(new DeleteSilaCompanyCodeCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), CompanyCodeId = companyCodeId });
            _logger.LogDebug($"Company code deleted. CompanyCodeId: {result}");
            return Ok(Success(result, "Company code deleted."));
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/company-codes/{companyCodeId:guid}/suspend")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("SuspendSilaCompanyCode")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public Task<IActionResult> Suspend([FromRoute] Guid companyCodeId)
        {
            return SetStatusAsync(companyCodeId, "INACTIVE", "Company code suspended.");
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/company-codes/{companyCodeId:guid}/activate")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("ActivateSilaCompanyCode")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public Task<IActionResult> Activate([FromRoute] Guid companyCodeId)
        {
            return SetStatusAsync(companyCodeId, "ACTIVE", "Company code activated.");
        }

        private async Task<IActionResult> SetStatusAsync(Guid companyCodeId, string status, string message)
        {
            _logger.LogDebug($"Setting company code status. CompanyCodeId: {companyCodeId}, Status: {status}");
            Guid result = await _mediator.Send(new SetSilaCompanyCodeStatusCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                CompanyCodeId = companyCodeId,
                Status = status
            });
            _logger.LogDebug($"Company code status set. CompanyCodeId: {result}, Status: {status}");
            return Ok(Success(result, message));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/company-codes/template")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaCompanyCodeTemplate")]
        public async Task<IActionResult> Template()
        {
            _logger.LogDebug("Downloading company code template.");
            SilaReceivingFileDto file = await _mediator.Send(new GetSilaCompanyCodeFileQuery { OrganizationId = GetOrganizationId(), Template = true });
            _logger.LogDebug($"Company code template built. Bytes: {file.Content.Length}");
            return File(file.Content, file.ContentType, file.FileName);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/company-codes/export")]
        [ApiAuthorization(Name = "VIEW_SILA_RECEIVING")]
        [SwaggerOperation("ExportSilaCompanyCodes")]
        public async Task<IActionResult> Export()
        {
            _logger.LogDebug("Exporting company codes.");
            SilaReceivingFileDto file = await _mediator.Send(new GetSilaCompanyCodeFileQuery { OrganizationId = GetOrganizationId(), Template = false });
            _logger.LogDebug($"Company codes exported. Bytes: {file.Content.Length}");
            return File(file.Content, file.ContentType, file.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/company-codes/import/preview")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("PreviewSilaCompanyCodeImport")]
        [SwaggerResponse(200, type: typeof(SilaMasterImportResultDto))]
        public Task<IActionResult> Preview(IFormFile file)
        {
            return ImportAsync(file, false);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/company-codes/import")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(UPLOAD_LIMIT)]
        [SwaggerOperation("ImportSilaCompanyCodes")]
        [SwaggerResponse(200, type: typeof(SilaMasterImportResultDto))]
        public Task<IActionResult> Import(IFormFile file)
        {
            return ImportAsync(file, true);
        }

        private async Task<IActionResult> ImportAsync(IFormFile? file, bool commit)
        {
            _logger.LogDebug($"Importing company codes. FileName: {file?.FileName}, Bytes: {file?.Length}, Commit: {commit}");
            byte[] content = Array.Empty<byte>();
            if (file != null && file.Length > 0)
            {
                using MemoryStream stream = new MemoryStream();
                await file.CopyToAsync(stream);
                content = stream.ToArray();
            }

            SilaMasterImportResultDto result = await _mediator.Send(new ImportSilaCompanyCodesCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Commit = commit,
                FileName = file?.FileName ?? string.Empty,
                Content = content
            });
            _logger.LogDebug($"Company code file processed. Rows: {result.TotalRows}, Invalid: {result.InvalidRows}, Committed: {result.Committed}");
            return Ok(result);
        }

        private static SuccessResponseDto Success(Guid id, string description)
        {
            return new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = description };
        }
    }
}
