using Buyer.Application.Features.Commands.SaveSilaMenuEngineering;
using Buyer.Application.Features.Queries.GetSilaMenuEngineering;
using Buyer.Domain.Dtos;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using SharedKernel.Attributes;
using SharedKernel.Controllers;
using SharedKernel.LoggerServices;
using Swashbuckle.AspNetCore.Annotations;

namespace Buyer.API.Controllers
{
    [ApiController]
    public class SilaMenuEngineeringController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaMenuEngineeringController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/menu-engineering")]
        [ApiAuthorization(AnyOf = "VIEW_SILA_MENU_ENGINEERING|MANAGE_SILA_MENU_ENGINEERING")]
        [SwaggerOperation("GetSilaMenuEngineering")]
        [SwaggerResponse(200, type: typeof(SilaMenuEngineeringEnvelopeDto))]
        public async Task<IActionResult> Get(
            [FromQuery] string view = "dashboard",
            [FromQuery] Guid? propertyId = null,
            [FromQuery] Guid? outletLocationId = null,
            [FromQuery] DateTime? dateFrom = null,
            [FromQuery] DateTime? dateTo = null,
            [FromQuery] string? mealPeriod = null,
            [FromQuery] string? category = null,
            [FromQuery] string? search = null,
            [FromQuery] string? status = null,
            [FromQuery] Guid? menuItemId = null,
            [FromQuery] Guid? menuPlanId = null,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching Menu Engineering. View: {view}");
            SilaMenuEngineeringEnvelopeDto result = await _mediator.Send(new GetSilaMenuEngineeringQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                View = view,
                Filter = new SilaMenuEngineeringFilterDto
                {
                    PropertyId = propertyId,
                    OutletLocationId = outletLocationId,
                    DateFrom = dateFrom,
                    DateTo = dateTo,
                    MealPeriod = mealPeriod,
                    Category = category,
                    Search = search,
                    Status = status,
                    MenuItemId = menuItemId,
                    MenuPlanId = menuPlanId,
                    Index = index,
                    Limit = limit
                }
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/menu-engineering")]
        [ApiAuthorization(Name = "MANAGE_SILA_MENU_ENGINEERING")]
        [SwaggerOperation("SaveSilaMenuEngineering")]
        [SwaggerResponse(200, type: typeof(SilaMenuEngineeringEnvelopeDto))]
        public async Task<IActionResult> Save([FromBody] SilaMenuEngineeringSaveDto request)
        {
            _logger.LogDebug($"Saving Menu Engineering. Action: {request.Action}");
            SilaMenuEngineeringEnvelopeDto result = await _mediator.Send(new SaveSilaMenuEngineeringCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/menu-engineering/simulate")]
        [ApiAuthorization(Name = "VIEW_SILA_MENU_ENGINEERING")]
        [SwaggerOperation("SimulateSilaMenuEngineering")]
        [SwaggerResponse(200, type: typeof(SilaMenuEngineeringEnvelopeDto))]
        public async Task<IActionResult> Simulate([FromBody] SilaMenuWhatIfRequestDto request)
        {
            SilaMenuEngineeringEnvelopeDto result = await _mediator.Send(new GetSilaMenuEngineeringQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                View = "simulate",
                Simulation = request
            });
            return Ok(result);
        }
    }
}
