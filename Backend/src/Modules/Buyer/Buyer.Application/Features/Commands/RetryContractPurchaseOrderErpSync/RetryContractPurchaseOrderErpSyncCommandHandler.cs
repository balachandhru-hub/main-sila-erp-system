using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RetryContractPurchaseOrderErpSync
{
    /// <summary>
    /// Sends a contract purchase order to the ERP again after an earlier attempt failed, or when the buyer set up the
    /// purchase order API after the order was created. An order the ERP already accepted is not sent again.
    /// </summary>
    public class RetryContractPurchaseOrderErpSyncCommandHandler : IRequestHandler<RetryContractPurchaseOrderErpSyncCommand, ContractPurchaseOrderDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public RetryContractPurchaseOrderErpSyncCommandHandler(
            IRepositoryWrapper repository,
            IMediator mediator,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task<ContractPurchaseOrderDto> Handle(RetryContractPurchaseOrderErpSyncCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Retrying ERP sync of contract purchase order. PurchaseOrderId: {request.PurchaseOrderId}, UserId: {request.UserId}");

            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                x => x.OrganizationId == request.OrganizationId && x.IsActive);
            if (buyer == null)
            {
                _logger.LogError($"Buyer not found. OrganizationId: {request.OrganizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            PurchaseOrder? order = await _repository.PurchaseOrder
                .FindByCondition(x => x.Id == request.PurchaseOrderId && x.BuyerId == buyer.Id && x.ContractId != null && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (order == null)
            {
                _logger.LogError($"Contract purchase order not found. PurchaseOrderId: {request.PurchaseOrderId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Purchase order not found.", "No purchase order created from a contract exists for this buyer organization.");
            }

            if (!string.IsNullOrWhiteSpace(order.ErpPurchaseOrderId))
            {
                throw new BadRequestCustomException("Purchase order is already in the ERP.", $"The ERP already holds this purchase order as {order.ErpPurchaseOrderId}.");
            }

            PredefinedContract? contract = await _repository.PredefinedContract
                .FindByCondition(x => x.Id == order.ContractId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);

            ContractPurchaseOrderIntegrationProcessor processor = new ContractPurchaseOrderIntegrationProcessor(
                _repository,
                new BuyerPurchaseDocumentGateway(_mediator, _logger),
                _userContext,
                _logger);
            PurchaseDocumentIntegration? integration = await processor.SendAsync(order.Id, contract?.ContractNumber, request.UserId, cancellationToken);
            if (integration == null)
            {
                throw new PreConditionFailedCustomException(
                    "No purchase order API is configured.",
                    "Add a Purchase order API under Integrations, test it and activate it, then retry.");
            }

            PurchaseOrder refreshed = _repository.PurchaseOrder.FindFirstByCondition(x => x.Id == order.Id);
            int itemCount = await _repository.PurchaseOrderItem
                .FindByCondition(x => x.PurchaseOrderId == order.Id && x.IsActive)
                .CountAsync(cancellationToken);
            return ContractPurchaseOrderRules.ToDto(refreshed, contract?.ContractNumber, integration, itemCount);
        }
    }
}
