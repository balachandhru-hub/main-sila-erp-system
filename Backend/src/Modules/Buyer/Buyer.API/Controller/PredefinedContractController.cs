using Buyer.Application.Features.Commands.ApproveRejectPredefinedContract;
using Buyer.Application.Features.Commands.CreateContractPurchaseOrder;
using Buyer.Application.Features.Commands.CreatePredefinedContract;
using Buyer.Application.Features.Commands.SyncContractErp;
using Buyer.Application.Features.Commands.InviteSupplierForPredefinedContract;
using Buyer.Application.Features.Profile.Queries.GetBuyerId;
using Buyer.Application.Features.Queries.GetAllPredefinedContracts;
using Buyer.Application.Features.Queries.GetContractPurchaseOrderDraft;
using Buyer.Application.Features.Queries.GetContractPurchaseOrders;
using Buyer.Application.Features.Queries.GetPredefinedContract;
using Buyer.Application.Features.Queries.GetSupplierPredefinedContractStatus;
using Buyer.Domain.Dto;
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
    [ApiController]
    public class PredefinedContractController : BaseController
    {
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public PredefinedContractController(
            IMediator mediator,
            ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        [HttpPost]
        [Route("api/v1/buyer/predefined-contract")]
        [ValidateModelState]
        [ApiAuthorization(Name = "CREATE_CONTRACT")]
        [SwaggerOperation("CreateContract")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto), description: "Contract created successfully")]
        [SwaggerResponse(400, type: typeof(ErrorResponseDto), description: "Bad Request")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "RFQ Not Found")]
        [SwaggerResponse(500, type: typeof(ErrorResponseDto), description: "Internal Server Error")]
        public async Task<IActionResult> CreateContract(
            [FromBody] CreatePredefinedContractDto request)
        {
            _logger.LogDebug($"Creating contract for RFQ Id: {request.RFQId}");

            // The login token carries no BuyerId claim, so resolve the buyer from the
            // caller's organization. The supplier is resolved from the RFQ award.
            Guid buyerId = await _mediator.Send(
                new GetBuyerIdQuery(GetOrganizationId()));

            Guid contractId = await _mediator.Send(
                new CreatePredefinedContractCommand(request, buyerId));

            return Ok(new SuccessResponseDto
            {
                Id = contractId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Contract created successfully."
            });
        }

        [HttpPost]
        [Route("api/v1/buyer/predefined-contract/{contractId}/purchase-orders")]
        [ApiAuthorization(Name = "CREATE_PURCHASE_ORDER")]
        [SwaggerOperation("CreateContractPurchaseOrder")]
        [SwaggerResponse(200, type: typeof(ContractPurchaseOrderDto), description: "Purchase order created")]
        [SwaggerResponse(400, type: typeof(ErrorResponseDto), description: "The contract is not eligible")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "Contract Not Found")]
        public async Task<IActionResult> CreateContractPurchaseOrder(
            [FromRoute] Guid contractId,
            [FromBody(EmptyBodyBehavior = Microsoft.AspNetCore.Mvc.ModelBinding.EmptyBodyBehavior.Allow)] CreateContractPurchaseOrderRequestDto? request)
        {
            _logger.LogDebug($"Creating purchase order from contract. ContractId: {contractId}");
            ContractPurchaseOrderDto result = await _mediator.Send(new CreateContractPurchaseOrderCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ContractId = contractId,
                Options = request ?? new CreateContractPurchaseOrderRequestDto()
            });
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/predefined-contract/{contractId}/purchase-order-draft")]
        [ApiAuthorization(Name = "CREATE_PURCHASE_ORDER")]
        [SwaggerOperation("GetContractPurchaseOrderDraft")]
        [SwaggerResponse(200, type: typeof(ContractPurchaseOrderDraftDto), description: "Success")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "Contract Not Found")]
        public async Task<IActionResult> GetContractPurchaseOrderDraft(
            [FromRoute] Guid contractId)
        {
            ContractPurchaseOrderDraftDto result = await _mediator.Send(new GetContractPurchaseOrderDraftQuery
            {
                OrganizationId = GetOrganizationId(),
                ContractId = contractId
            });
            return Ok(result);
        }

        [HttpPost]
        [Route("api/v1/buyer/predefined-contract/{contractId}/erp-sync")]
        [ApiAuthorization(Name = "CREATE_CONTRACT")]
        [SwaggerOperation("SyncContractErp")]
        [SwaggerResponse(200, type: typeof(ContractErpSyncDto), description: "Hand-off result")]
        [SwaggerResponse(400, type: typeof(ErrorResponseDto), description: "The contract is not approved")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "Contract Not Found")]
        public async Task<IActionResult> SyncContractErp(
            [FromRoute] Guid contractId)
        {
            _logger.LogDebug($"Sending contract to the ERP. ContractId: {contractId}");
            ContractErpSyncDto result = await _mediator.Send(new SyncContractErpCommand
            {
                OrganizationId = GetOrganizationId(),
                UserId = GetUserId(),
                ContractId = contractId
            });
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/predefined-contract/{contractId}/purchase-orders")]
        [ApiAuthorization(Name = "GET_CONTRACT")]
        [SwaggerOperation("GetContractPurchaseOrders")]
        [SwaggerResponse(200, type: typeof(List<ContractPurchaseOrderDto>), description: "Success")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "Contract Not Found")]
        public async Task<IActionResult> GetContractPurchaseOrders(
            [FromRoute] Guid contractId)
        {
            List<ContractPurchaseOrderDto> result = await _mediator.Send(new GetContractPurchaseOrdersQuery
            {
                OrganizationId = GetOrganizationId(),
                ContractId = contractId
            });
            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/predefined-contract/{contractId}")]
        [ApiAuthorization(Name = "GET_CONTRACT")]
        [SwaggerOperation("GetContract")]
        [SwaggerResponse(200, type: typeof(PredefinedContractResponseDto), description: "Success")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "Contract Not Found")]
        public async Task<IActionResult> GetContract(
            [FromRoute] Guid contractId)
        {
            var result = await _mediator.Send(new GetPredefinedContractQuery(contractId));

            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/predefined-contract")]
        [ApiAuthorization(Name = "GET_CONTRACT")]
        [SwaggerOperation("GetAllContracts")]
        [SwaggerResponse(200, type: typeof(List<PredefinedContractResponseDto>), description: "Success")]
        public async Task<IActionResult> GetAllContracts(
            [FromQuery] int index = 0,
            [FromQuery] int limit = 10)
        {
            Guid buyerId = await _mediator.Send(
                new GetBuyerIdQuery(GetOrganizationId()));

            var result = await _mediator.Send(new GetAllPredefinedContractsQuery
            {
                Index = index,
                Limit = limit,
                BuyerId = buyerId,
                UserId = GetUserId(),
                RoleId = GetRoleId()
            });

            return Ok(result);
        }

        /// <summary>
        /// Marks a supplier as invited for contract on an awarded RFQ. Relays the
        /// call internally to the Supplier service, which flags its own copy of
        /// the RFQ (SupplierRFQ.IsSupplierInvitedForContract).
        /// </summary>
        [HttpPut]
        [Route("api/v1/buyer/rfq/invite-for-contract")]
        [ValidateModelState]
        [ApiAuthorization(Name = "UPDATE_RFQ_CONTRACT")]
        [SwaggerOperation("InviteSupplierForContract")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto), description: "Supplier invited for contract successfully")]
        [SwaggerResponse(400, type: typeof(ErrorResponseDto), description: "Bad Request")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "RFQ Not Found")]
        [SwaggerResponse(500, type: typeof(ErrorResponseDto), description: "Internal Server Error")]
        public async Task<IActionResult> InviteSupplierForContract(
            [FromBody] InviteSupplierForPredefinedContractCommand command)
        {
            Guid rfqId = await _mediator.Send(command);

            return Ok(new SuccessResponseDto
            {
                Id = rfqId.ToString(),
                StatusCode = 200,
                Message = "Success",
                Description = "Supplier invited for contract successfully."
            });
        }

        /// <summary>
        /// Approve or Reject Contract
        /// </summary>
        [HttpPut]
        [Route("api/v1/buyer/predefined-contract/approval/{contractId}")]
        [ValidateModelState]
        [ApiAuthorization(Name = "APPROVE_CONTRACT")]
        [SwaggerOperation("ApproveOrRejectContract")]
        [SwaggerResponse(200, type: typeof(SuccessResponseDto),
            description: "Contract approval status updated successfully")]
        [SwaggerResponse(400, type: typeof(ErrorResponseDto), description: "Bad Request")]
        [SwaggerResponse(404, type: typeof(ErrorResponseDto), description: "Not Found")]
        [SwaggerResponse(500, type: typeof(ErrorResponseDto), description: "Internal Server Error")]
        public async Task<IActionResult> ApproveOrRejectContract(
            Guid contractId,
            [FromBody] ApproveRejectPredefinedContractDto dto)
        {
            Guid userId = GetUserId();

            _logger.LogDebug(
                $"Processing contract approval for ContractId: {contractId}, UserId: {userId}");

            Guid result = await _mediator.Send(
                new ApproveRejectPredefinedContractCommand(
                    contractId,
                    userId,
                    dto));

            return Ok(new SuccessResponseDto
            {
                Id = result.ToString(),
                Message = "Contract approval status updated successfully",
                Description = "Contract approval status updated successfully",
                StatusCode = 200
            });
        }

        // ---- Internal routes called by the Supplier service ----

        [HttpGet]
        [Route("api/v1/buyer/internal-contract-status")]
        [ApiAuthorization(Name = "GET_CONTRACT")]
        [SwaggerOperation("InternalGetSupplierContractStatus")]
        [SwaggerResponse(200, type: typeof(SupplierPredefinedContractStatusDto), description: "Success")]
        public async Task<IActionResult> InternalGetSupplierContractStatus(
            [FromQuery] Guid rfqId,
            [FromQuery] Guid supplierId)
        {
            var result = await _mediator.Send(new GetSupplierPredefinedContractStatusQuery
            {
                RFQId = rfqId,
                SupplierId = supplierId
            });

            return Ok(result);
        }

        [HttpGet]
        [Route("api/v1/buyer/internal-contract/{contractId}")]
        [ApiAuthorization(Name = "GET_CONTRACT")]
        [SwaggerOperation("InternalGetContract")]
        [SwaggerResponse(200, type: typeof(PredefinedContractResponseDto), description: "Success")]
        public async Task<IActionResult> InternalGetContract(
            [FromRoute] Guid contractId)
        {
            var result = await _mediator.Send(new GetPredefinedContractQuery(contractId));

            return Ok(result);
        }
    }
}
