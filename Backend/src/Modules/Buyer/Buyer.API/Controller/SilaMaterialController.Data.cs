using Buyer.Application.Features.Commands.ImportSilaMaterials;
using Buyer.Application.Features.Commands.PullSilaMaterialsFromErp;
using Buyer.Application.Features.Queries.ExportSilaMaterials;
using Buyer.Application.Features.Queries.GetSilaMaterialErpRoute;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.ExceptionHandler;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>Material Excel template / export / import (preview, then confirm) and the ERP material pull.</summary>
    public partial class SilaMaterialController
    {
        [HttpGet]
        [Route("api/v1/buyer/sila/materials/excel/template")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaMaterialTemplate")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Template()
        {
            _logger.LogDebug("Building the material Excel template.");
            byte[] file = await _mediator.Send(new ExportSilaMaterialsQuery { OrganizationId = GetOrganizationId(), TemplateOnly = true });
            _logger.LogDebug($"Material Excel template built. Bytes: {file.Length}");
            return File(file, SilaMaterialExcel.CONTENT_TYPE, "material-template.xlsx");
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/materials/excel/export")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("ExportSilaMaterials")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Export([FromQuery] string? search, [FromQuery] string? priceStatus, [FromQuery] bool inventoryOnly = false)
        {
            _logger.LogDebug($"Exporting materials. Search: {search}, PriceStatus: {priceStatus}");
            byte[] file = await _mediator.Send(new ExportSilaMaterialsQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                PriceStatus = priceStatus,
                InventoryOnly = inventoryOnly
            });
            _logger.LogDebug($"Materials exported. Bytes: {file.Length}");
            return File(file, SilaMaterialExcel.CONTENT_TYPE, $"materials-{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/materials/excel/preview")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("PreviewSilaMaterialImport")]
        [SwaggerResponse(200, type: typeof(SilaMaterialImportResultDto))]
        public Task<IActionResult> PreviewImport(IFormFile file)
        {
            return Import(file, false);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/materials/excel/import")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("ImportSilaMaterials")]
        [SwaggerResponse(200, type: typeof(SilaMaterialImportResultDto))]
        public Task<IActionResult> ConfirmImport(IFormFile file)
        {
            return Import(file, true);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/materials/erp-pull")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("PullSilaMaterialsFromErp")]
        [SwaggerResponse(200, type: typeof(SilaMaterialErpPullResultDto))]
        public async Task<IActionResult> ErpPull([FromBody] SilaMaterialErpPullWriteDto request)
        {
            _logger.LogDebug($"Pulling materials from the ERP. CompanyCode: {request?.CompanyCode}");
            SilaMaterialErpPullResultDto result = await _mediator.Send(new PullSilaMaterialsFromErpCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request ?? new SilaMaterialErpPullWriteDto()
            });
            _logger.LogDebug($"Materials pulled from the ERP. Read: {result.Read}, New: {result.New}, Changed: {result.Changed}, Failed: {result.Failed}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/materials/erp-route")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaMaterialErpRoute")]
        [SwaggerResponse(200, type: typeof(SilaMaterialErpRouteDto))]
        public async Task<IActionResult> ErpRoute([FromQuery] string? companyCode)
        {
            _logger.LogDebug($"Resolving the ERP material route. CompanyCode: {companyCode}");
            SilaMaterialErpRouteDto result = await _mediator.Send(new GetSilaMaterialErpRouteQuery
            {
                OrganizationId = GetOrganizationId(),
                CompanyCode = companyCode
            });
            _logger.LogDebug($"ERP material route resolved. Configured: {result.Configured}");
            return Ok(result);
        }

        private async Task<IActionResult> Import(IFormFile file, bool confirm)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogError("Material import without a file.");
                throw new BadRequestCustomException("A file is required.", "Choose the material .xlsx file to upload.");
            }

            if (file.Length > SilaMaterialExcel.MAX_FILE_BYTES)
            {
                _logger.LogError($"Material import file too large. Bytes: {file.Length}");
                throw new BadRequestCustomException("The file is too large.", "Upload a material file of at most 5 MB.");
            }

            _logger.LogDebug($"Importing materials. FileName: {file.FileName}, Bytes: {file.Length}, Confirm: {confirm}");
            using MemoryStream stream = new MemoryStream();
            await file.CopyToAsync(stream);
            SilaMaterialImportResultDto result = await _mediator.Send(new ImportSilaMaterialsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                FileName = file.FileName,
                Content = stream.ToArray(),
                Confirm = confirm
            });
            _logger.LogDebug($"Material import done. Applied: {result.Applied}, Rows: {result.TotalRows}, Invalid: {result.InvalidRows}");
            return Ok(result);
        }
    }
}
