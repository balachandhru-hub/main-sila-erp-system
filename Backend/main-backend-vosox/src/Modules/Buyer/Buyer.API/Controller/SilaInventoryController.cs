using Buyer.Application.Features.Commands.CreateSilaLocation;
using Buyer.Application.Features.Commands.DeactivateSilaLocation;
using Buyer.Application.Features.Commands.DeleteSilaMaterialConversion;
using Buyer.Application.Features.Commands.SetSilaLocationMaterials;
using Buyer.Application.Features.Commands.SetSilaLocationUsers;
using Buyer.Application.Features.Commands.UpdateSilaLocation;
using Buyer.Application.Features.Commands.UpdateSilaMaterialInventory;
using Buyer.Application.Features.Commands.UpsertSilaMaterialConversion;
using Buyer.Application.Features.Queries.GetMySilaLocations;
using Buyer.Application.Features.Queries.GetSilaInventoryHome;
using Buyer.Application.Features.Queries.GetSilaInventoryTransactions;
using Buyer.Application.Features.Queries.GetSilaLiveInventory;
using Buyer.Application.Features.Queries.GetSilaLiveInventoryDetail;
using Buyer.Application.Features.Queries.GetSilaLocationMaterials;
using Buyer.Application.Features.Queries.GetSilaLocations;
using Buyer.Application.Features.Queries.GetSilaLocationUsers;
using Buyer.Application.Features.Queries.GetSilaMaterials;
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
    /// SILA ME: inventory locations (stores and outlets of a property), their users and stocking levels, the inventory
    /// fields and UOM conversions of Item Master materials, live stock, the inventory ledger and the inventory home.
    /// </summary>
    [ApiController]
    public class SilaInventoryController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaInventoryController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/locations")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaLocations")]
        [SwaggerResponse(200, type: typeof(List<SilaLocationResponseDto>))]
        public async Task<IActionResult> Locations(
            [FromQuery] string? type, [FromQuery] Guid? propertyId, [FromQuery] int index = 0, [FromQuery] int limit = 200,
            [FromQuery] string? status = null)
        {
            _logger.LogDebug($"Fetching inventory locations. Type: {type}, PropertyId: {propertyId}, Index: {index}, Limit: {limit}");
            List<SilaLocationResponseDto> result = await _mediator.Send(new GetSilaLocationsQuery
            {
                OrganizationId = GetOrganizationId(),
                LocationType = type,
                PropertyId = propertyId,
                Index = index,
                Limit = limit,
                Status = status
            });
            _logger.LogDebug($"Inventory locations fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/locations/mine")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetMySilaLocations")]
        [SwaggerResponse(200, type: typeof(List<SilaLocationResponseDto>))]
        public async Task<IActionResult> MyLocations()
        {
            _logger.LogDebug("Fetching the caller's inventory locations.");
            List<SilaLocationResponseDto> result = await _mediator.Send(new GetMySilaLocationsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId()
            });
            _logger.LogDebug($"Caller's inventory locations fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/locations")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("CreateSilaLocation")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CreateLocation([FromBody] SilaLocationWriteDto request)
        {
            _logger.LogDebug($"Creating inventory location. LocationCode: {request.LocationCode}");
            Guid id = await _mediator.Send(new CreateSilaLocationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Inventory location created. LocationId: {id}");
            return Ok(Success(id, "Location created."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/locations/{locationId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("UpdateSilaLocation")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpdateLocation([FromRoute] Guid locationId, [FromBody] SilaLocationWriteDto request)
        {
            _logger.LogDebug($"Updating inventory location. LocationId: {locationId}");
            await _mediator.Send(new UpdateSilaLocationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                Request = request
            });
            _logger.LogDebug($"Inventory location updated. LocationId: {locationId}");
            return Ok(Success(locationId, "Location updated."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/locations/{locationId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("DeactivateSilaLocation")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeactivateLocation([FromRoute] Guid locationId)
        {
            _logger.LogDebug($"Deactivating inventory location. LocationId: {locationId}");
            await _mediator.Send(new DeactivateSilaLocationCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId
            });
            _logger.LogDebug($"Inventory location deactivated. LocationId: {locationId}");
            return Ok(Success(locationId, "Location deactivated."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/locations/{locationId}/users")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("GetSilaLocationUsers")]
        [SwaggerResponse(200, type: typeof(SilaLocationUsersDto))]
        public async Task<IActionResult> LocationUsers([FromRoute] Guid locationId)
        {
            _logger.LogDebug($"Fetching location users. LocationId: {locationId}");
            SilaLocationUsersDto result = await _mediator.Send(new GetSilaLocationUsersQuery
            {
                OrganizationId = GetOrganizationId(),
                LocationId = locationId
            });
            _logger.LogDebug($"Location users fetched. Count: {result.UserIds.Count}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/locations/{locationId}/users")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("SetSilaLocationUsers")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> SetLocationUsers([FromRoute] Guid locationId, [FromBody] SilaLocationUsersWriteDto request)
        {
            _logger.LogDebug($"Assigning users to location. LocationId: {locationId}");
            await _mediator.Send(new SetSilaLocationUsersCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                Request = request
            });
            _logger.LogDebug($"Users assigned to location. LocationId: {locationId}");
            return Ok(Success(locationId, "Users assigned."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/locations/{locationId}/materials")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("GetSilaLocationMaterials")]
        [SwaggerResponse(200, type: typeof(List<SilaLocationMaterialDto>))]
        public async Task<IActionResult> LocationMaterials([FromRoute] Guid locationId)
        {
            _logger.LogDebug($"Fetching location stocking rows. LocationId: {locationId}");
            List<SilaLocationMaterialDto> result = await _mediator.Send(new GetSilaLocationMaterialsQuery
            {
                OrganizationId = GetOrganizationId(),
                LocationId = locationId
            });
            _logger.LogDebug($"Location stocking rows fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/locations/{locationId}/materials")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("SetSilaLocationMaterials")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> SetLocationMaterials([FromRoute] Guid locationId, [FromBody] SilaLocationMaterialsWriteDto request)
        {
            _logger.LogDebug($"Saving location stocking rows. LocationId: {locationId}, Count: {request.Items?.Count}");
            await _mediator.Send(new SetSilaLocationMaterialsCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                Request = request
            });
            _logger.LogDebug($"Location stocking rows saved. LocationId: {locationId}");
            return Ok(Success(locationId, "Stocking levels saved."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/materials")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaMaterials")]
        [SwaggerResponse(200, type: typeof(List<SilaMaterialDto>))]
        public async Task<IActionResult> Materials(
            [FromQuery] string? search,
            [FromQuery] bool inventoryOnly = false,
            [FromQuery] string? priceStatus = null,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching inventory materials. Search: {search}, PriceStatus: {priceStatus}, Index: {index}, Limit: {limit}");
            List<SilaMaterialDto> result = await _mediator.Send(new GetSilaMaterialsQuery
            {
                OrganizationId = GetOrganizationId(),
                Search = search,
                InventoryOnly = inventoryOnly,
                PriceStatus = priceStatus,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Inventory materials fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/materials/{materialId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("UpdateSilaMaterialInventory")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpdateMaterial([FromRoute] Guid materialId, [FromBody] SilaMaterialInventoryWriteDto request)
        {
            _logger.LogDebug($"Updating material inventory fields. MaterialId: {materialId}");
            await _mediator.Send(new UpdateSilaMaterialInventoryCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                MaterialId = materialId,
                Request = request
            });
            _logger.LogDebug($"Material inventory fields updated. MaterialId: {materialId}");
            return Ok(Success(materialId, "Material updated."));
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/materials/{materialId}/conversions")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("UpsertSilaMaterialConversion")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> UpsertConversion([FromRoute] Guid materialId, [FromBody] SilaUomConversionWriteDto request)
        {
            _logger.LogDebug($"Saving UOM conversion. MaterialId: {materialId}, From: {request.FromUom}, To: {request.ToUom}");
            Guid id = await _mediator.Send(new UpsertSilaMaterialConversionCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                MaterialId = materialId,
                Request = request
            });
            _logger.LogDebug($"UOM conversion saved. ConversionId: {id}");
            return Ok(Success(id, "Conversion saved."));
        }

        [HttpDelete]
        [Route("api/v1/buyer/sila/materials/{materialId}/conversions/{conversionId}")]
        [ApiAuthorization(Name = "MANAGE_SILA_LOCATION")]
        [SwaggerOperation("DeleteSilaMaterialConversion")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> DeleteConversion([FromRoute] Guid materialId, [FromRoute] Guid conversionId)
        {
            _logger.LogDebug($"Deleting UOM conversion. MaterialId: {materialId}, ConversionId: {conversionId}");
            await _mediator.Send(new DeleteSilaMaterialConversionCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                MaterialId = materialId,
                ConversionId = conversionId
            });
            _logger.LogDebug($"UOM conversion deleted. ConversionId: {conversionId}");
            return Ok(Success(conversionId, "Conversion deleted."));
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/inventory/live")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaLiveInventory")]
        [SwaggerResponse(200, type: typeof(List<SilaLiveInventoryRowDto>))]
        public async Task<IActionResult> LiveInventory(
            [FromQuery] string? search, [FromQuery] Guid? locationId, [FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Searching live inventory. Search: {search}, LocationId: {locationId}, Index: {index}");
            List<SilaLiveInventoryRowDto> result = await _mediator.Send(new GetSilaLiveInventoryQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Search = search,
                LocationId = locationId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Live inventory searched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/inventory/live/{materialId}")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaLiveInventoryDetail")]
        [SwaggerResponse(200, type: typeof(SilaLiveInventoryDetailDto))]
        public async Task<IActionResult> LiveInventoryDetail(
            [FromRoute] Guid materialId, [FromQuery] decimal? requiredQty, [FromQuery] Guid? currentLocationId)
        {
            _logger.LogDebug($"Fetching live inventory of a material. MaterialId: {materialId}");
            SilaLiveInventoryDetailDto result = await _mediator.Send(new GetSilaLiveInventoryDetailQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                MaterialId = materialId,
                RequiredQty = requiredQty,
                CurrentLocationId = currentLocationId
            });
            _logger.LogDebug($"Live inventory of a material fetched. Locations: {result.Locations.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/inventory/transactions")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaInventoryTransactions")]
        [SwaggerResponse(200, type: typeof(List<SilaInventoryTransactionDto>))]
        public async Task<IActionResult> Transactions(
            [FromQuery] Guid? locationId,
            [FromQuery] Guid? materialId,
            [FromQuery] string? type,
            [FromQuery] DateTime? from,
            [FromQuery] DateTime? to,
            [FromQuery] int index = 0,
            [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching inventory transactions. LocationId: {locationId}, MaterialId: {materialId}, Type: {type}");
            List<SilaInventoryTransactionDto> result = await _mediator.Send(new GetSilaInventoryTransactionsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId,
                MaterialId = materialId,
                TransactionType = type,
                FromDate = from,
                ToDate = to,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Inventory transactions fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/inventory/home")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaInventoryHome")]
        [SwaggerResponse(200, type: typeof(SilaInventoryHomeDto))]
        public async Task<IActionResult> Home([FromQuery] Guid? locationId)
        {
            _logger.LogDebug($"Fetching inventory home. LocationId: {locationId}");
            SilaInventoryHomeDto result = await _mediator.Send(new GetSilaInventoryHomeQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                LocationId = locationId
            });
            _logger.LogDebug($"Inventory home fetched. LocationId: {result.LocationId}");
            return Ok(result);
        }

        private static SuccessResponseDto Success(Guid id, string description)
        {
            return new SuccessResponseDto
            {
                Id = id.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = description
            };
        }
    }
}
