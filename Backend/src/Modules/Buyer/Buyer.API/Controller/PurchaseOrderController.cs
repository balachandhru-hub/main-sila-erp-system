using Buyer.Application.Features.Commands.CreatePurchaseOrder;
using Buyer.Application.Features.Commands.ReprocessPurchaseOrder;
using Buyer.Application.Features.Commands.RetryContractPurchaseOrderErpSync;
using Buyer.Application.Features.Queries.GetPurchaseOrders;
using Buyer.Application.Features.Queries.GetSupplierPurchaseOrders;
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
    public class PurchaseOrderController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public PurchaseOrderController(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpGet]
        [Route("api/v1/buyer/purchase-orders")]
        [ApiAuthorization(Name = "GET_PURCHASE_ORDER")]
        [SwaggerOperation("GetPurchaseOrders")]
        [SwaggerResponse(200, type: typeof(List<PurchaseOrderListItemDto>))]
        public async Task<IActionResult> List([FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching purchase orders. Index: {index}, Limit: {limit}");
            List<PurchaseOrderListItemDto> result = await _mediator.Send(new GetPurchaseOrdersQuery
            {
                OrganizationId = GetOrganizationId(),
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Purchase orders fetched. Count: {result.Count}");
            return Ok(result);
        }

        /// <summary>
        /// Creates a purchase order in this system, then hands it to the buyer's ERP and the supplier's ERP when they have an API.
        /// The order is kept whatever the ERPs answer; the answer shows where each hand-off stands.
        /// </summary>
        [HttpPost]
        [Route("api/v1/buyer/purchase-orders")]
        [ApiAuthorization(Name = "CREATE_PURCHASE_ORDER")]
        [SwaggerOperation("CreatePurchaseOrder")]
        [SwaggerResponse(200, type: typeof(PurchaseOrderProcessResultDto))]
        public async Task<IActionResult> Create([FromBody] CreatePurchaseOrderRequestDto request)
        {
            _logger.LogDebug($"Creating purchase order. SupplierId: {request.SupplierId}");
            PurchaseOrderProcessResultDto result = await _mediator.Send(new CreatePurchaseOrderCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                Request = request
            });
            _logger.LogDebug($"Purchase order created. PurchaseOrderId: {result.Id}, BuyerErp: {result.BuyerErpStatus}, SupplierErp: {result.SupplierErpStatus}");
            return Ok(result);
        }

        /// <summary>
        /// Hands the purchase order to the ERP that did not take it: only the hand-offs that are not done are sent again.
        /// </summary>
        [HttpPost]
        [Route("api/v1/buyer/purchase-orders/{purchaseOrderId}/reprocess")]
        [ApiAuthorization(Name = "CREATE_REPROCESS_PURCHASE_ORDER")]
        [SwaggerOperation("ReprocessPurchaseOrder")]
        [SwaggerResponse(200, type: typeof(PurchaseOrderProcessResultDto))]
        public async Task<IActionResult> Reprocess([FromRoute] Guid purchaseOrderId)
        {
            _logger.LogDebug($"Reprocessing purchase order. PurchaseOrderId: {purchaseOrderId}");
            PurchaseOrderProcessResultDto result = await _mediator.Send(new ReprocessPurchaseOrderCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                PurchaseOrderId = purchaseOrderId
            });
            _logger.LogDebug($"Purchase order reprocessed. PurchaseOrderId: {purchaseOrderId}, BuyerErp: {result.BuyerErpStatus}, SupplierErp: {result.SupplierErpStatus}");
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/purchase-orders/{purchaseOrderId}/retry-erp-sync")]
        [ApiAuthorization(Name = "CREATE_PURCHASE_ORDER")]
        [SwaggerOperation("RetryContractPurchaseOrderErpSync")]
        [SwaggerResponse(200, type: typeof(ContractPurchaseOrderDto))]
        public async Task<IActionResult> RetryErpSync([FromRoute] Guid purchaseOrderId)
        {
            _logger.LogDebug($"Retrying ERP sync of purchase order. PurchaseOrderId: {purchaseOrderId}");
            ContractPurchaseOrderDto result = await _mediator.Send(new RetryContractPurchaseOrderErpSyncCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                PurchaseOrderId = purchaseOrderId
            });
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/purchase-orders/supplier")]
        [ApiAuthorization(Name = "GET_SUPPLIER_PURCHASE_ORDER")]
        [SwaggerOperation("GetSupplierPurchaseOrders")]
        [SwaggerResponse(200, type: typeof(List<PurchaseOrderListItemDto>))]
        public async Task<IActionResult> ListForSupplier([FromQuery] int index = 0, [FromQuery] int limit = 20)
        {
            _logger.LogDebug($"Fetching purchase orders of the supplier. Index: {index}, Limit: {limit}");
            List<PurchaseOrderListItemDto> result = await _mediator.Send(new GetSupplierPurchaseOrdersQuery
            {
                Index = index,
                Limit = limit
            });
            _logger.LogDebug($"Purchase orders of the supplier fetched. Count: {result.Count}");
            return Ok(result);
        }
    }
}
