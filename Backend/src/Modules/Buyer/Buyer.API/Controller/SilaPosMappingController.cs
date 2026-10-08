using Buyer.Application.Features.Commands.DeleteSilaPosItemMapping;
using Buyer.Application.Features.Commands.ImportSilaPosItemMappings;
using Buyer.Application.Features.Commands.ImportSilaPosOutletMappings;
using Buyer.Application.Features.Commands.SaveSilaPosItemMapping;
using Buyer.Application.Features.Queries.GetSilaPosItemMappings;
using Buyer.Application.Features.Queries.GetSilaPosOutletMenuItems;
using Buyer.Application.Features.Queries.GetSilaPosTemplate;
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
    /// <summary>SILA ME POS item → recipe mapping, the Excel imports of both mappings, and the POS Excel templates.</summary>
    [ApiController]
    public class SilaPosMappingController : BaseController
    {
        private const string FEATURE = "MANAGE_SILA_POS";
        private const long MAX_FILE_BYTES = 10 * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaPosMappingController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/items")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("GetSilaPosItemMappings")]
        [SwaggerResponse(200, type: typeof(SilaPosPageDto<SilaPosItemMappingDto>))]
        public async Task<IActionResult> ItemMappings([FromRoute] Guid sourceId, [FromQuery] string? search, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching POS item mappings. SourceId: {sourceId}, Search: {search}");
            SilaPosPageDto<SilaPosItemMappingDto> result = await _mediator.Send(new GetSilaPosItemMappingsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                SourceId = sourceId,
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"POS item mappings fetched. Total: {result.Total}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/outlets/{outletMappingId}/menu-items")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("GetSilaPosOutletMenuItems")]
        [SwaggerResponse(200, type: typeof(SilaPosPageDto<SilaPosOutletMenuItemDto>))]
        public async Task<IActionResult> OutletMenuItems(
            [FromRoute] Guid sourceId, [FromRoute] Guid outletMappingId, [FromQuery] string? search, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching POS outlet menu items. SourceId: {sourceId}, OutletMappingId: {outletMappingId}");
            SilaPosPageDto<SilaPosOutletMenuItemDto> result = await _mediator.Send(new GetSilaPosOutletMenuItemsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                SourceId = sourceId,
                OutletMappingId = outletMappingId,
                Search = search,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"POS outlet menu items fetched. Total: {result.Total}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/items")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("CreateSilaPosItemMapping")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateItemMapping([FromRoute] Guid sourceId, [FromBody] SilaPosItemMappingWriteDto request)
        {
            _logger.LogDebug($"Creating POS item mapping. SourceId: {sourceId}");
            Guid id = await _mediator.Send(new SaveSilaPosItemMappingCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, Request = request });
            _logger.LogDebug($"POS item mapping created. MappingId: {id}");
            return Ok(Success(id, "Item mapping created."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/items/{mappingId}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("UpdateSilaPosItemMapping")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpdateItemMapping([FromRoute] Guid sourceId, [FromRoute] Guid mappingId, [FromBody] SilaPosItemMappingWriteDto request)
        {
            _logger.LogDebug($"Updating POS item mapping. SourceId: {sourceId}, MappingId: {mappingId}");
            Guid id = await _mediator.Send(new SaveSilaPosItemMappingCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, MappingId = mappingId, Request = request });
            _logger.LogDebug($"POS item mapping updated. MappingId: {id}");
            return Ok(Success(id, "Item mapping updated."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/items/{mappingId}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("DeleteSilaPosItemMapping")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeleteItemMapping([FromRoute] Guid sourceId, [FromRoute] Guid mappingId)
        {
            _logger.LogDebug($"Deleting POS item mapping. SourceId: {sourceId}, MappingId: {mappingId}");
            await _mediator.Send(new DeleteSilaPosItemMappingCommand { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), SourceId = sourceId, MappingId = mappingId });
            _logger.LogDebug($"POS item mapping deleted. MappingId: {mappingId}");
            return Ok(Success(mappingId, "Item mapping deleted."));
        }

        /// <summary>confirm=false previews the file; confirm=true imports every row, or nothing while a row is invalid.</summary>
        [HttpPost]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/outlets/import")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("ImportSilaPosOutletMappings")]
        [SwaggerResponse(200, type: typeof(SilaPosMappingImportDto))]
        public async Task<IActionResult> ImportOutletMappings([FromRoute] Guid sourceId, IFormFile file, [FromQuery] bool confirm = false)
        {
            byte[] content = await ReadAsync(file);
            _logger.LogDebug($"Importing POS outlet mappings. SourceId: {sourceId}, FileName: {file.FileName}, Confirm: {confirm}");
            SilaPosMappingImportDto result = await _mediator.Send(new ImportSilaPosOutletMappingsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                SourceId = sourceId,
                FileName = file.FileName,
                Content = content,
                Confirm = confirm
            });
            _logger.LogDebug($"POS outlet mappings import done. Rows: {result.TotalRows}, Invalid: {result.InvalidRows}, Imported: {result.Imported}");
            return Ok(result);
        }

        /// <summary>confirm=false previews the file; confirm=true imports every row, or nothing while a row is invalid.</summary>
        [HttpPost]
        [Route("api/v1/buyer/sila/pos/sources/{sourceId}/items/import")]
        [Consumes("multipart/form-data")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("ImportSilaPosItemMappings")]
        [SwaggerResponse(200, type: typeof(SilaPosMappingImportDto))]
        public async Task<IActionResult> ImportItemMappings([FromRoute] Guid sourceId, IFormFile file, [FromQuery] bool confirm = false)
        {
            byte[] content = await ReadAsync(file);
            _logger.LogDebug($"Importing POS item mappings. SourceId: {sourceId}, FileName: {file.FileName}, Confirm: {confirm}");
            SilaPosMappingImportDto result = await _mediator.Send(new ImportSilaPosItemMappingsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                SourceId = sourceId,
                FileName = file.FileName,
                Content = content,
                Confirm = confirm
            });
            _logger.LogDebug($"POS item mappings import done. Rows: {result.TotalRows}, Invalid: {result.InvalidRows}, Imported: {result.Imported}");
            return Ok(result);
        }

        /// <summary>kind: SALES (sales upload), OUTLETS (outlet mapping import) or ITEMS (item mapping import).</summary>
        [HttpGet]
        [Route("api/v1/buyer/sila/pos/templates/{kind}")]
        [ApiAuthorization(Name = FEATURE)]
        [SwaggerOperation("GetSilaPosTemplate")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Template([FromRoute] string kind)
        {
            _logger.LogDebug($"Fetching POS template. Kind: {kind}");
            SilaPosFileDto result = await _mediator.Send(new GetSilaPosTemplateQuery { OrganizationId = GetOrganizationId(), UserId = GetUserId(), RoleId = GetRoleId(), Kind = kind });
            _logger.LogDebug($"POS template fetched. Kind: {kind}, Bytes: {result.Content.Length}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        private async Task<byte[]> ReadAsync(IFormFile? file)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogError("POS mapping import without a file.");
                throw new BadRequestCustomException("A file is required.", "Choose the filled-in .xlsx template to upload.");
            }

            if (file.Length > MAX_FILE_BYTES)
            {
                _logger.LogError($"POS mapping file too large. Bytes: {file.Length}");
                throw new BadRequestCustomException("The file is too large.", "Upload a file of at most 10 MB.");
            }

            using MemoryStream stream = new MemoryStream();
            await file.CopyToAsync(stream);
            return stream.ToArray();
        }

        private static SuccessResponseDto Success(Guid id, string description)
        {
            return new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = description };
        }
    }
}
