using Buyer.Application.Features.Commands.DeleteSilaRecipeMaster;
using Buyer.Application.Features.Commands.ImportSilaRecipeMasters;
using Buyer.Application.Features.Commands.SaveSilaRecipeMaster;
using Buyer.Application.Features.Queries.ExportSilaRecipeMasters;
using Buyer.Application.Features.Queries.GetSilaRecipeMasters;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME recipe master data: recipe families and categories ({kind} = families | categories) with Excel template,
    /// export and import (preview, then confirm).
    /// </summary>
    [ApiController]
    public class SilaRecipeMasterController : BaseController
    {
        private const long MAX_FILE_BYTES = 5 * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaRecipeMasterController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeMasters")]
        [SwaggerResponse(200, type: typeof(List<SilaRecipeMasterDto>))]
        public async Task<IActionResult> List([FromRoute] string kind, [FromQuery] string? search, [FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 200)
        {
            _logger.LogDebug($"Fetching recipe masters. Kind: {kind}, Search: {search}, Index: {index}, Limit: {limit}");
            List<SilaRecipeMasterDto> result = await _mediator.Send(new GetSilaRecipeMastersQuery
            {
                OrganizationId = GetOrganizationId(),
                Kind = kind,
                Search = search,
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Recipe masters fetched. Kind: {kind}, Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("CreateSilaRecipeMaster")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Create([FromRoute] string kind, [FromBody] SilaRecipeMasterWriteDto request)
        {
            _logger.LogDebug($"Creating recipe master. Kind: {kind}, Code: {request?.Code}");
            Guid id = await _mediator.Send(new SaveSilaRecipeMasterCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Kind = kind,
                Request = request ?? new SilaRecipeMasterWriteDto()
            });
            _logger.LogDebug($"Recipe master created. Kind: {kind}, Id: {id}");
            return Ok(new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = "Saved." });
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}/{id}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("UpdateSilaRecipeMaster")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Update([FromRoute] string kind, [FromRoute] Guid id, [FromBody] SilaRecipeMasterWriteDto request)
        {
            _logger.LogDebug($"Updating recipe master. Kind: {kind}, Id: {id}");
            await _mediator.Send(new SaveSilaRecipeMasterCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Kind = kind,
                Id = id,
                Request = request ?? new SilaRecipeMasterWriteDto()
            });
            _logger.LogDebug($"Recipe master updated. Kind: {kind}, Id: {id}");
            return Ok(new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = "Saved." });
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}/{id}")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("DeleteSilaRecipeMaster")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Delete([FromRoute] string kind, [FromRoute] Guid id)
        {
            _logger.LogDebug($"Deleting recipe master. Kind: {kind}, Id: {id}");
            await _mediator.Send(new DeleteSilaRecipeMasterCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), Kind = kind, Id = id });
            _logger.LogDebug($"Recipe master deleted. Kind: {kind}, Id: {id}");
            return Ok(new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = "Deleted." });
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}/export")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("ExportSilaRecipeMasters")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Export([FromRoute] string kind)
        {
            _logger.LogDebug($"Exporting recipe masters. Kind: {kind}");
            SilaRecipeFileDto result = await _mediator.Send(new ExportSilaRecipeMastersQuery { OrganizationId = GetOrganizationId(), Kind = kind });
            _logger.LogDebug($"Recipe masters exported. Kind: {kind}, Bytes: {result.Content.Length}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}/template")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeMasterTemplate")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Template([FromRoute] string kind)
        {
            _logger.LogDebug($"Building recipe master template. Kind: {kind}");
            SilaRecipeFileDto result = await _mediator.Send(new ExportSilaRecipeMastersQuery { OrganizationId = GetOrganizationId(), Kind = kind, Template = true });
            _logger.LogDebug($"Recipe master template built. Kind: {kind}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}/import/preview")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MAX_FILE_BYTES + 64 * 1024)]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("PreviewSilaRecipeMasterImport")]
        [SwaggerResponse(200, type: typeof(SilaRecipeImportPreviewDto))]
        public Task<IActionResult> PreviewImport([FromRoute] string kind, IFormFile file)
        {
            return ImportAsync(kind, file, false);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipe-masters/{kind}/import")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MAX_FILE_BYTES + 64 * 1024)]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("ImportSilaRecipeMasters")]
        [SwaggerResponse(200, type: typeof(SilaRecipeImportPreviewDto))]
        public Task<IActionResult> Import([FromRoute] string kind, IFormFile file)
        {
            return ImportAsync(kind, file, true);
        }

        private async Task<IActionResult> ImportAsync(string kind, IFormFile? file, bool commit)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogError($"Recipe master import without a file. Kind: {kind}");
                throw new BadRequestCustomException("A file is required.", "Choose the workbook (.xlsx) to upload.");
            }

            if (file.Length > MAX_FILE_BYTES)
            {
                _logger.LogError($"Recipe master workbook too large. Kind: {kind}, Bytes: {file.Length}");
                throw new BadRequestCustomException("The file is too large.", "Upload a workbook of at most 5 MB.");
            }

            _logger.LogDebug($"Importing recipe masters. Kind: {kind}, Commit: {commit}, FileName: {file.FileName}, Bytes: {file.Length}");
            using MemoryStream stream = new MemoryStream();
            await file.CopyToAsync(stream);
            SilaRecipeImportPreviewDto result = await _mediator.Send(new ImportSilaRecipeMastersCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Kind = kind,
                FileName = file.FileName,
                Content = stream.ToArray(),
                Commit = commit
            });
            _logger.LogDebug($"Recipe master import done. Kind: {kind}, Commit: {commit}, Invalid: {result.InvalidRows}, Imported: {result.Imported}");
            return Ok(result);
        }
    }
}
