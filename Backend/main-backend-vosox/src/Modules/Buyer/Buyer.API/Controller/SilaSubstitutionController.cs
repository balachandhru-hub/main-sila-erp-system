using Buyer.Application.Features.Commands.AcceptSilaSubstitution;
using Buyer.Application.Features.Commands.DismissSilaSubstitution;
using Buyer.Application.Features.Commands.GenerateSilaSubstitutionProposals;
using Buyer.Application.Features.Queries.GetSilaSubstitution;
using Buyer.Application.Features.Queries.GetSilaSubstitutions;
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
    /// SILA ME recipe substitution: the system proposes an in-stock substitute for an ingredient that is short across the
    /// property; the outlet manager or chef reviews it and the changed recipe goes through recipe approval.
    /// </summary>
    [ApiController]
    public class SilaSubstitutionController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaSubstitutionController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/substitutions")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaSubstitutions")]
        [SwaggerResponse(200, type: typeof(SilaSubstitutionPageDto))]
        public async Task<IActionResult> Substitutions([FromQuery] string? status, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching substitution proposals. Status: {status}, Index: {index}, Limit: {limit}");
            SilaSubstitutionPageDto result = await _mediator.Send(new GetSilaSubstitutionsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Substitution proposals fetched. Count: {result.Items.Count}, Total: {result.Total}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/substitutions/{proposalId}")]
        [ApiAuthorization(Name = "VIEW_SILA_RECIPE")]
        [SwaggerOperation("GetSilaSubstitution")]
        [SwaggerResponse(200, type: typeof(SilaSubstitutionDetailDto))]
        public async Task<IActionResult> Substitution([FromRoute] Guid proposalId)
        {
            _logger.LogDebug($"Fetching substitution proposal. ProposalId: {proposalId}");
            SilaSubstitutionDetailDto result = await _mediator.Send(new GetSilaSubstitutionQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                ProposalId = proposalId
            });
            _logger.LogDebug($"Substitution proposal fetched. ProposalId: {proposalId}, Suggestions: {result.Suggestions.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/substitutions/{proposalId}/accept")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("AcceptSilaSubstitution")]
        [SwaggerResponse(200, type: typeof(SilaSubstitutionAcceptResultDto))]
        public async Task<IActionResult> Accept([FromRoute] Guid proposalId, [FromBody] SilaSubstitutionAcceptDto request)
        {
            _logger.LogDebug($"Accepting substitution proposal. ProposalId: {proposalId}, Replacements: {request?.Replacements?.Count ?? 0}");
            SilaSubstitutionAcceptResultDto result = await _mediator.Send(new AcceptSilaSubstitutionCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                ProposalId = proposalId,
                Request = request ?? new SilaSubstitutionAcceptDto()
            });
            _logger.LogDebug($"Substitution proposal accepted. ProposalId: {proposalId}, RecipeId: {result.RecipeId}, Version: {result.Version}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/substitutions/{proposalId}/dismiss")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("DismissSilaSubstitution")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> Dismiss([FromRoute] Guid proposalId, [FromBody] SilaSubstitutionDismissDto request)
        {
            _logger.LogDebug($"Dismissing substitution proposal. ProposalId: {proposalId}");
            await _mediator.Send(new DismissSilaSubstitutionCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                ProposalId = proposalId,
                Request = request ?? new SilaSubstitutionDismissDto()
            });
            _logger.LogDebug($"Substitution proposal dismissed. ProposalId: {proposalId}");
            return Ok(new SuccessResponseDto { Id = proposalId.ToString(), StatusCode = 200, Message = "Success", Description = "Suggestion dismissed." });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/substitutions/generate")]
        [ApiAuthorization(Name = "MANAGE_SILA_RECIPE")]
        [SwaggerOperation("GenerateSilaSubstitutions")]
        [SwaggerResponse(200, type: typeof(SilaSubstitutionRunResultDto))]
        public async Task<IActionResult> Generate()
        {
            _logger.LogDebug("Running the substitution check for the organization.");
            SilaSubstitutionRunResultDto result = await _mediator.Send(new GenerateSilaSubstitutionProposalsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId()
            });
            _logger.LogDebug($"Substitution check done. Created: {result.Created}, AutoDismissed: {result.AutoDismissed}");
            return Ok(result);
        }
    }
}
