using Buyer.Application.Features.Commands.ImportSilaRecipes;
using Buyer.Application.Features.Queries.ExportSilaRecipes;
using Buyer.Application.Features.Queries.GetSilaRecipeDashboard;
using Buyer.Application.Features.Queries.GetSilaRecipeIngredientFacets;
using Buyer.Application.Features.Queries.SearchSilaRecipeIngredients;
using Buyer.Application.Features.Queries.GetSilaUoms;
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
    /// SILA ME recipe management tools: the recipe dashboard, the ingredient search with its facets, and the recipe Excel
    /// template, export and import (preview, then confirm).
    /// </summary>
    [ApiController]
    public class SilaRecipeCatalogController : BaseController
    {
        private const long MAX_FILE_BYTES = 5 * 1024 * 1024;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaRecipeCatalogController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/dashboard")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeDashboard")]
        [SwaggerResponse(200, type: typeof(SilaRecipeDashboardDto))]
        public async Task<IActionResult> Dashboard()
        {
            _logger.LogDebug("Fetching recipe dashboard.");
            SilaRecipeDashboardDto result = await _mediator.Send(new GetSilaRecipeDashboardQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId()
            });
            _logger.LogDebug($"Recipe dashboard fetched. NextActions: {result.NextActions.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/ingredient-search")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("SearchSilaRecipeIngredients")]
        [SwaggerResponse(200, type: typeof(SilaRecipeIngredientPageDto))]
        public async Task<IActionResult> IngredientSearch(
            [FromQuery] string? search,
            [FromQuery] string? materialGroup,
            [FromQuery] string? category,
            [FromQuery] string? supplier,
            [FromQuery] string? materialType,
            [FromQuery] Guid? supplierId,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Searching recipe ingredients. Search: {search}, Group: {materialGroup}, Category: {category}, Supplier: {supplier}");
            SilaRecipeIngredientPageDto result = await _mediator.Send(new SearchSilaRecipeIngredientsQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                MaterialGroup = materialGroup,
                Category = category,
                Supplier = supplier,
                MaterialType = materialType,
                SupplierId = supplierId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Recipe ingredients found. Count: {result.Items.Count}, Total: {result.Total}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/ingredient-facets")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeIngredientFacets")]
        [SwaggerResponse(200, type: typeof(SilaRecipeIngredientFacetsDto))]
        public async Task<IActionResult> IngredientFacets()
        {
            _logger.LogDebug("Fetching recipe ingredient facets.");
            SilaRecipeIngredientFacetsDto result = await _mediator.Send(new GetSilaRecipeIngredientFacetsQuery { OrganizationId = GetOrganizationId() });
            _logger.LogDebug($"Recipe ingredient facets fetched. Suppliers: {result.Suppliers.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/uoms")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaUoms")]
        [SwaggerResponse(200, type: typeof(List<string>))]
        public async Task<IActionResult> Uoms()
        {
            _logger.LogDebug("Fetching units of measure.");
            List<string> result = await _mediator.Send(new GetSilaUomsQuery { OrganizationId = GetOrganizationId() });
            _logger.LogDebug($"Units of measure fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/export")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("ExportSilaRecipes")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Export()
        {
            _logger.LogDebug("Exporting recipes.");
            SilaRecipeFileDto result = await _mediator.Send(new ExportSilaRecipesQuery { OrganizationId = GetOrganizationId() });
            _logger.LogDebug($"Recipes exported. Bytes: {result.Content.Length}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/template")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeTemplate")]
        [SwaggerResponse(200, type: typeof(FileContentResult))]
        public async Task<IActionResult> Template()
        {
            _logger.LogDebug("Building recipe template.");
            SilaRecipeFileDto result = await _mediator.Send(new ExportSilaRecipesQuery { OrganizationId = GetOrganizationId(), Template = true });
            _logger.LogDebug($"Recipe template built. Bytes: {result.Content.Length}");
            return File(result.Content, result.ContentType, result.FileName);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes/import/preview")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MAX_FILE_BYTES + 64 * 1024)]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("PreviewSilaRecipeImport")]
        [SwaggerResponse(200, type: typeof(SilaRecipeImportPreviewDto))]
        public Task<IActionResult> PreviewImport(IFormFile file)
        {
            return ImportAsync(file, false);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes/import")]
        [Consumes("multipart/form-data")]
        [RequestSizeLimit(MAX_FILE_BYTES + 64 * 1024)]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("ImportSilaRecipes")]
        [SwaggerResponse(200, type: typeof(SilaRecipeImportPreviewDto))]
        public Task<IActionResult> Import(IFormFile file)
        {
            return ImportAsync(file, true);
        }

        private async Task<IActionResult> ImportAsync(IFormFile? file, bool commit)
        {
            if (file == null || file.Length == 0)
            {
                _logger.LogError("Recipe import without a file.");
                throw new BadRequestCustomException("A file is required.", "Choose the recipe workbook (.xlsx) to upload.");
            }

            if (file.Length > MAX_FILE_BYTES)
            {
                _logger.LogError($"Recipe workbook too large. Bytes: {file.Length}");
                throw new BadRequestCustomException("The file is too large.", "Upload a workbook of at most 5 MB.");
            }

            _logger.LogDebug($"Importing recipes. Commit: {commit}, FileName: {file.FileName}, Bytes: {file.Length}");
            using MemoryStream stream = new MemoryStream();
            await file.CopyToAsync(stream);
            SilaRecipeImportPreviewDto result = await _mediator.Send(new ImportSilaRecipesCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                FileName = file.FileName,
                Content = stream.ToArray(),
                Commit = commit
            });
            _logger.LogDebug($"Recipe import done. Commit: {commit}, Valid: {result.ValidRows}, Invalid: {result.InvalidRows}, Imported: {result.Imported}");
            return Ok(result);
        }
    }
}
