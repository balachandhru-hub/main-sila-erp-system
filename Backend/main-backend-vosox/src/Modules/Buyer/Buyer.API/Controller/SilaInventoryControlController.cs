using Buyer.Application.Features.Commands.AddSilaPurchaseRequestToBucket;
using Buyer.Application.Features.Commands.CancelSilaPurchaseRequest;
using Buyer.Application.Features.Commands.CreateSilaPurchaseRequest;
using Buyer.Application.Features.Commands.CreateSilaReplenishmentTransfers;
using Buyer.Application.Features.Commands.UpdateSilaQuickTransferPolicy;
using Buyer.Application.Features.Queries.GetSilaInventoryDashboard;
using Buyer.Application.Features.Queries.GetSilaPurchaseRequests;
using Buyer.Application.Features.Queries.GetSilaQuickTransferPolicy;
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
    /// SILA ME inventory control: the inventory dashboard, replenishment transfers, internal purchase requests and the
    /// quick-transfer policy.
    /// </summary>
    [ApiController]
    public class SilaInventoryControlController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public SilaInventoryControlController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/inventory/dashboard")]
        [ApiAuthorization(Name = "VIEW_SILA_INVENTORY")]
        [SwaggerOperation("GetSilaInventoryDashboard")]
        [SwaggerResponse(200, type: typeof(SilaInventoryDashboardDto))]
        public async Task<IActionResult> Dashboard(
            [FromQuery] Guid? propertyId, [FromQuery] Guid? locationId, [FromQuery] string? locationType, [FromQuery] string? materialGroup,
            [FromQuery] DateTime? businessDate = null)
        {
            _logger.LogDebug($"Fetching inventory dashboard. PropertyId: {propertyId}, LocationId: {locationId}, LocationType: {locationType}");
            SilaInventoryDashboardDto result = await _mediator.Send(new GetSilaInventoryDashboardQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                PropertyId = propertyId,
                LocationId = locationId,
                LocationType = locationType,
                MaterialGroup = materialGroup,
                BusinessDate = businessDate
            });
            _logger.LogDebug($"Inventory dashboard fetched. Replenishment: {result.Replenishment.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/inventory/replenishment")]
        [ApiAuthorization(Name = "MANAGE_SILA_TRANSFER")]
        [SwaggerOperation("CreateSilaReplenishmentTransfers")]
        [SwaggerResponse(200, type: typeof(SilaReplenishmentResultDto))]
        public async Task<IActionResult> Replenish([FromBody] SilaReplenishmentWriteDto request)
        {
            _logger.LogDebug($"Creating replenishment transfers. Lines: {request.Lines?.Count}");
            SilaReplenishmentResultDto result = await _mediator.Send(new CreateSilaReplenishmentTransfersCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Replenishment transfers created. Transfers: {result.Transfers.Count}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/purchase-requests")]
        [ApiAuthorization(Name = "REQUEST_SILA_PURCHASE")]
        [SwaggerOperation("GetSilaPurchaseRequests")]
        [SwaggerResponse(200, type: typeof(List<SilaPurchaseRequestDto>))]
        public async Task<IActionResult> PurchaseRequests(
            [FromQuery] string? status, [FromQuery] Guid? locationId, [FromQuery] int index = 0, [FromQuery] int limit = 50)
        {
            _logger.LogDebug($"Fetching purchase requests. Status: {status}, LocationId: {locationId}, Index: {index}");
            List<SilaPurchaseRequestDto> result = await _mediator.Send(new GetSilaPurchaseRequestsQuery
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Status = status,
                LocationId = locationId,
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Purchase requests fetched. Count: {result.Count}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/purchase-requests")]
        [ApiAuthorization(Name = "REQUEST_SILA_PURCHASE")]
        [SwaggerOperation("CreateSilaPurchaseRequest")]
        [SwaggerResponse(200, type: typeof(SilaPurchaseRequestDto))]
        public async Task<IActionResult> CreatePurchaseRequest([FromBody] SilaPurchaseRequestWriteDto request)
        {
            _logger.LogDebug($"Creating purchase request. LocationId: {request.LocationId}, MaterialId: {request.MaterialId}");
            SilaPurchaseRequestDto result = await _mediator.Send(new CreateSilaPurchaseRequestCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Purchase request created. RequestNumber: {result.RequestNumber}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/purchase-requests/{requestId}/cancel")]
        [ApiAuthorization(Name = "REQUEST_SILA_PURCHASE")]
        [SwaggerOperation("CancelSilaPurchaseRequest")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto))]
        public async Task<IActionResult> CancelPurchaseRequest([FromRoute] Guid requestId)
        {
            _logger.LogDebug($"Cancelling purchase request. RequestId: {requestId}");
            await _mediator.Send(new CancelSilaPurchaseRequestCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                PurchaseRequestId = requestId
            });
            _logger.LogDebug($"Purchase request cancelled. RequestId: {requestId}");
            return Ok(new SuccessResponseDto
            {
                Id = requestId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Purchase request cancelled."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/sila/purchase-requests/{requestId}/add-to-bucket")]
        [ApiAuthorization(Name = "REQUEST_SILA_PURCHASE")]
        [SwaggerOperation("AddSilaPurchaseRequestToBucket")]
        [SwaggerResponse(200, type: typeof(SilaPurchaseRequestBucketResultDto))]
        public async Task<IActionResult> AddToBucket([FromRoute] Guid requestId, [FromBody] SilaPurchaseRequestBucketWriteDto? request)
        {
            _logger.LogDebug($"Adding purchase request to the weekly bucket. RequestId: {requestId}");
            SilaPurchaseRequestBucketResultDto result = await _mediator.Send(new AddSilaPurchaseRequestToBucketCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                PurchaseRequestId = requestId,
                Request = request ?? new SilaPurchaseRequestBucketWriteDto()
            });
            _logger.LogDebug($"Purchase request added to the weekly bucket. BucketCode: {result.BucketCode}");
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/sila/quick-transfer-policy")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("GetSilaQuickTransferPolicy")]
        [SwaggerResponse(200, type: typeof(SilaQuickTransferPolicyDto))]
        public async Task<IActionResult> QuickTransferPolicy()
        {
            _logger.LogDebug("Fetching quick-transfer policy.");
            SilaQuickTransferPolicyDto result = await _mediator.Send(new GetSilaQuickTransferPolicyQuery
            {
                OrganizationId = GetOrganizationId()
            });
            _logger.LogDebug($"Quick-transfer policy fetched. Enabled: {result.Enabled}");
            return Ok(result);
        }

        [HttpPut]
        [Route("api/v1/buyer/sila/quick-transfer-policy")]
        [ApiAuthorization(Name = "MANAGE_SILA_MASTER_DATA")]
        [SwaggerOperation("UpdateSilaQuickTransferPolicy")]
        [SwaggerResponse(200, type: typeof(SilaQuickTransferPolicyDto))]
        public async Task<IActionResult> SaveQuickTransferPolicy([FromBody] SilaQuickTransferPolicyDto request)
        {
            _logger.LogDebug("Saving quick-transfer policy.");
            SilaQuickTransferPolicyDto result = await _mediator.Send(new UpdateSilaQuickTransferPolicyCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                RoleId = GetRoleId(),
                Request = request
            });
            _logger.LogDebug($"Quick-transfer policy saved. Enabled: {result.Enabled}");
            return Ok(result);
        }
    }
}
