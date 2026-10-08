using System.Security.Cryptography;
using System.Text;
using Identity.Application.Features.Queries.GetInternalOrganizationUsers;
using Identity.Domain.Dto;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Controllers;
using SharedKernel.LoggerServices;
using SharedKernel.Tenancy;
using Swashbuckle.AspNetCore.Annotations;

namespace Identity.API.Controllers
{
    /// <summary>
    /// Endpoints for calls between services that have no signed-in user (scheduler jobs). They are not reachable with a
    /// sign-in cookie: the caller must send the internal key, which is derived from the shared token signing key.
    /// </summary>
    [ApiController]
    public class InternalUsersController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;
        private readonly IConfiguration _configuration;

        public InternalUsersController(IMediator mediator, ILoggerManager logger, IConfiguration configuration)
        {
            _mediator = mediator;
            _logger = logger;
            _configuration = configuration;
        }

        [HttpGet]
        [Route("api/v1/identity/internal/users-by-role")]
        [SwaggerOperation("GetInternalUsersByRole")]
        [SwaggerResponse(200, type: typeof(List<UserListDto>))]
        public async Task<IActionResult> GetUsersByRole([FromQuery] Guid organizationId, [FromQuery] string role)
        {
            string sent = Request.Headers[HttpTenantRegistry.INTERNAL_KEY_HEADER].ToString();
            string expected = HttpTenantRegistry.InternalKey(_configuration);
            if (!CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(sent), Encoding.UTF8.GetBytes(expected)))
            {
                _logger.LogError("Internal users call refused: the internal key is missing or wrong.");
                return Unauthorized();
            }

            if (organizationId == Guid.Empty || string.IsNullOrWhiteSpace(role))
            {
                return BadRequest("organizationId and role are required.");
            }

            List<UserListDto> result = await _mediator.Send(new GetInternalOrganizationUsersQuery
            {
                OrganizationId = organizationId,
                Role = role.Trim()
            });
            return Ok(result);
        }
    }
}
