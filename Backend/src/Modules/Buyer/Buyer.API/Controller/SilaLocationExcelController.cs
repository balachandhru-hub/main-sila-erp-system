using Buyer.Application.Features.Commands.ImportSilaLocations;
using Buyer.Application.Features.Commands.PreviewSilaLocationImport;
using Buyer.Application.Features.Queries.GetSilaLocationExcel;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME location master in Excel: template, export, and the import (preview first, then confirm with the same file;
    /// the import is all or nothing).
    /// </summary>
    [ApiController]
    public class SilaLocationExcelController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaLocationExcelController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/locations/excel/template")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("GetSilaLocationTemplate")]
        public async Task<IActionResult> Template()
        {
            _logger.LogDebug("Downloading the location template.");
            byte[] file = await _mediator.Send(new GetSilaLocationExcelQuery { OrganizationId = GetOrganizationId(), Template = true });
            _logger.LogDebug($"Location template built. Bytes: {file.Length}");
            return File(file, SilaLocationExcel.CONTENT_TYPE, "location-template.xlsx");
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/locations/excel/export")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("ExportSilaLocations")]
        public async Task<IActionResult> Export()
        {
            _logger.LogDebug("Exporting the locations.");
            byte[] file = await _mediator.Send(new GetSilaLocationExcelQuery { OrganizationId = GetOrganizationId(), Template = false });
            _logger.LogDebug($"Locations exported. Bytes: {file.Length}");
            return File(file, SilaLocationExcel.CONTENT_TYPE, $"locations-{DateTime.UtcNow:yyyyMMdd}.xlsx");
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/locations/excel/preview")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("PreviewSilaLocationImport")]
        [SwaggerResponse(200, type: typeof(SilaLocationImportPreviewDto))]
        public async Task<IActionResult> Preview(IFormFile file)
        {
            (string fileName, byte[] content) = await ReadFileAsync(file);
            _logger.LogDebug($"Previewing location import. FileName: {fileName}, Bytes: {content.Length}");
            SilaLocationImportPreviewDto result = await _mediator.Send(new PreviewSilaLocationImportCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                FileName = fileName,
                Content = content
            });
            _logger.LogDebug($"Location import previewed. Rows: {result.TotalRows}, Invalid: {result.InvalidRows}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/locations/excel/import")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("ImportSilaLocations")]
        [SwaggerResponse(200, type: typeof(SilaLocationImportPreviewDto))]
        public async Task<IActionResult> Import(IFormFile file)
        {
            (string fileName, byte[] content) = await ReadFileAsync(file);
            _logger.LogDebug($"Importing locations. FileName: {fileName}, Bytes: {content.Length}");
            SilaLocationImportPreviewDto result = await _mediator.Send(new ImportSilaLocationsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                FileName = fileName,
                Content = content
            });
            _logger.LogDebug($"Locations imported. New: {result.NewRows}, Updated: {result.UpdateRows}");
            return Ok(result);
        }

        private async Task<(string FileName, byte[] Content)> ReadFileAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogError("Location import without a file.");
                throw new BadRequestCustomException("A file is required.", "Choose the .xlsx location file to upload.");
            }

            if (file.Length > SilaLocationExcel.MAX_FILE_BYTES)
            {
                _logger.LogError($"Location import file too large. Bytes: {file.Length}");
                throw new BadRequestCustomException("The file is too large.", "Upload a location file of at most 5 MB.");
            }

            string fileName = Path.GetFileName(file.FileName ?? string.Empty);
            if (!string.Equals(Path.GetExtension(fileName), ".xlsx", StringComparison.OrdinalIgnoreCase))
            {
                _logger.LogError($"Location import file type not supported. FileName: {fileName}");
                throw new BadRequestCustomException("File type is not supported.", "Upload the location file as .xlsx.");
            }

            using MemoryStream stream = new MemoryStream();
            await file.CopyToAsync(stream);
            return (fileName, stream.ToArray());
        }
    }
}
