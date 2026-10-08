using Buyer.Application.Features.Commands.CreateSilaRecipe;
using Buyer.Application.Features.Commands.DeactivateSilaRecipe;
using Buyer.Application.Features.Commands.DecideSilaRecipe;
using Buyer.Application.Features.Commands.SubmitSilaRecipe;
using Buyer.Application.Features.Commands.UpdateSilaRecipe;
using Buyer.Application.Features.Queries.GetSilaRecipe;
using Buyer.Application.Features.Queries.GetSilaRecipeApprovals;
using Buyer.Application.Features.Queries.GetSilaRecipes;
using Buyer.Application.Features.Queries.GetSilaRecipeWorkflows;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.Dto;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    /// <summary>
    /// SILA ME recipes (menu items with versions, ingredients, outlet prices and costs) and their approval through the SILA approval engine.
    /// </summary>
    [ApiController]
    public class SilaRecipeController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaRecipeController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipes")]
        [SwaggerResponse(200, type: typeof(SilaRecipePageDto))]
        public async Task<IActionResult> Recipes(
            [FromQuery] string? status,
            [FromQuery] string? itemMode,
            [FromQuery] string? search,
            [FromQuery] Guid? familyId,
            [FromQuery] Guid? categoryId,
            [FromQuery] bool? active,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching recipes. Status: {status}, ItemMode: {itemMode}, Search: {search}, Index: {index}, Limit: {limit}");
            SilaRecipePageDto result = await _mediator.Send(new GetSilaRecipesQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                ItemMode = itemMode,
                Search = search,
                FamilyId = familyId,
                CategoryId = categoryId,
                Active = active,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Recipes fetched. Count: {result.Items.Count}, Total: {result.Total}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipes/{recipeId}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SilaRecipeDetailDto))]
        public async Task<IActionResult> Recipe([FromRoute] Guid recipeId, [FromQuery] int? version)
        {
            _logger.LogDebug($"Fetching recipe. RecipeId: {recipeId}, Version: {version}");
            SilaRecipeDetailDto result = await _mediator.Send(new GetSilaRecipeQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RecipeId = recipeId,
                Version = version
            });
            _logger.LogDebug($"Recipe fetched. RecipeId: {recipeId}, Status: {result.Status}, Version: {result.ViewVersion}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("CreateSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateRecipe([FromBody] SilaRecipeWriteDto request)
        {
            _logger.LogDebug($"Creating recipe. Name: {request.Name}");
            Guid id = await _mediator.Send(new CreateSilaRecipeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Recipe created. RecipeId: {id}");
            return Ok(new SuccessResponseDto { Id = id.ToString(), StatusCode = 200, Message = "Success", Description = "Recipe created." });
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/recipes/{recipeId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("UpdateSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpdateRecipe([FromRoute] Guid recipeId, [FromBody] SilaRecipeWriteDto request)
        {
            _logger.LogDebug($"Updating recipe. RecipeId: {recipeId}");
            await _mediator.Send(new UpdateSilaRecipeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RecipeId = recipeId,
                Request = request
            });
            _logger.LogDebug($"Recipe updated. RecipeId: {recipeId}");
            return Ok(new SuccessResponseDto { Id = recipeId.ToString(), StatusCode = 200, Message = "Success", Description = "Recipe saved." });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes/{recipeId}/submit")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("SubmitSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> SubmitRecipe([FromRoute] Guid recipeId)
        {
            _logger.LogDebug($"Submitting recipe. RecipeId: {recipeId}");
            await _mediator.Send(new SubmitSilaRecipeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RecipeId = recipeId
            });
            _logger.LogDebug($"Recipe submitted. RecipeId: {recipeId}");
            return Ok(new SuccessResponseDto { Id = recipeId.ToString(), StatusCode = 200, Message = "Success", Description = "Recipe sent for approval." });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes/{recipeId}/approve")]
        [ApiAuthorization(Name = "APPROVE_SILA_RECIPE")]
        [SwaggerOperation("ApproveSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> ApproveRecipe([FromRoute] Guid recipeId, [FromBody] SilaRecipeDecisionDto request)
        {
            _logger.LogDebug($"Approving recipe. RecipeId: {recipeId}");
            await _mediator.Send(new DecideSilaRecipeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RecipeId = recipeId,
                Approve = true,
                Request = request ?? new SilaRecipeDecisionDto()
            });
            _logger.LogDebug($"Recipe approval recorded. RecipeId: {recipeId}");
            return Ok(new SuccessResponseDto { Id = recipeId.ToString(), StatusCode = 200, Message = "Success", Description = "Approval recorded." });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes/{recipeId}/reject")]
        [ApiAuthorization(Name = "APPROVE_SILA_RECIPE")]
        [SwaggerOperation("RejectSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> RejectRecipe([FromRoute] Guid recipeId, [FromBody] SilaRecipeDecisionDto request)
        {
            _logger.LogDebug($"Rejecting recipe. RecipeId: {recipeId}");
            await _mediator.Send(new DecideSilaRecipeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RecipeId = recipeId,
                Approve = false,
                Request = request ?? new SilaRecipeDecisionDto()
            });
            _logger.LogDebug($"Recipe rejection recorded. RecipeId: {recipeId}");
            return Ok(new SuccessResponseDto { Id = recipeId.ToString(), StatusCode = 200, Message = "Success", Description = "Recipe rejected." });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/recipes/{recipeId}/deactivate")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("DeactivateSilaRecipe")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeactivateRecipe([FromRoute] Guid recipeId)
        {
            _logger.LogDebug($"Deactivating recipe. RecipeId: {recipeId}");
            await _mediator.Send(new DeactivateSilaRecipeCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                RecipeId = recipeId
            });
            _logger.LogDebug($"Recipe deactivated. RecipeId: {recipeId}");
            return Ok(new SuccessResponseDto { Id = recipeId.ToString(), StatusCode = 200, Message = "Success", Description = "Recipe deactivated." });
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipe-approvals")]
        [ApiAuthorization(Name = "APPROVE_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeApprovals")]
        [SwaggerResponse(200, type: typeof(List<SilaRecipeListItemDto>))]
        public async Task<IActionResult> RecipeApprovals([FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching recipes pending my approval. Index: {index}, Limit: {limit}");
            List<SilaRecipeListItemDto> result = await _mediator.Send(new GetSilaRecipeApprovalsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Recipes pending my approval fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/recipe-approvals/workflows")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaRecipeWorkflows")]
        [SwaggerResponse(200, type: typeof(List<SilaApprovalWorkflowDto>))]
        public async Task<IActionResult> RecipeWorkflows()
        {
            _logger.LogDebug("Fetching recipe approval workflows.");
            List<SilaApprovalWorkflowDto> result = await _mediator.Send(new GetSilaRecipeWorkflowsQuery { OrganizationId = GetOrganizationId() });
            _logger.LogDebug($"Recipe approval workflows fetched. Count: {result.Count}");
            return Ok(result);
        }
    }
}
