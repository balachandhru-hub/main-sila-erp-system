using Buyer.Application.Contracts;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReprocessPurchaseOrder
{
    public class ReprocessPurchaseOrderCommandHandler : IRequestHandler<ReprocessPurchaseOrderCommand, PurchaseOrderProcessResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ISupplierSalesOrderClient _supplierSalesOrderClient;
        private readonly IBuyerPurchaseDocumentGateway _buyerGateway;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public ReprocessPurchaseOrderCommandHandler(
            IRepositoryWrapper repository,
            ISupplierSalesOrderClient supplierSalesOrderClient,
            IBuyerPurchaseDocumentGateway buyerGateway,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _supplierSalesOrderClient = supplierSalesOrderClient;
            _buyerGateway = buyerGateway;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task<PurchaseOrderProcessResultDto> Handle(ReprocessPurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reprocessing purchase order. PurchaseOrderId: {request.PurchaseOrderId}, UserId: {request.UserId}");

            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                x => x.OrganizationId == request.OrganizationId && x.IsActive);
            if (buyer == null)
            {
                _logger.LogError($"Buyer not found. OrganizationId: {request.OrganizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            // Another organization's order looks the same as a missing one.
            PurchaseOrder? order = _repository.PurchaseOrder.FindFirstByCondition(
                x => x.Id == request.PurchaseOrderId && x.BuyerId == buyer.Id && x.IsActive);
            if (order == null)
            {
                _logger.LogError($"Purchase order not found. PurchaseOrderId: {request.PurchaseOrderId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Purchase order not found.", "No purchase order exists for this buyer organization.");
            }

            // Orders read from an ERP come from the buyer ERP: they are never sent to it again.
            if (order.SourceType != Common.PURCHASE_ORDER_SOURCE_MANUAL && order.SourceType != Common.PURCHASE_ORDER_SOURCE_CONTRACT && order.SourceType != Common.PURCHASE_ORDER_SOURCE_WEEKLY_BUCKET)
            {
                _logger.LogError($"Purchase order cannot be reprocessed. PurchaseOrderId: {order.Id}, SourceType: {order.SourceType}");
                throw new BadRequestCustomException(
                    "Purchase order cannot be reprocessed.",
                    "Only a purchase order created here (by a user, from a contract or from a weekly bucket) can be handed to the ERPs again.");
            }

            PurchaseOrderProcessResultDto current = PurchaseOrderErpProcessor.Describe(
                order,
                FindRow(order.Id, Common.ERP_OPERATION_PO_CREATE),
                FindRow(order.Id, Common.ERP_OPERATION_SUPPLIER_SALES_ORDER_CREATE));
            if (current.BuyerErpStatus == Common.PURCHASE_ORDER_ERP_SYNCED && current.SupplierErpStatus == Common.PURCHASE_ORDER_ERP_SYNCED)
            {
                throw new BadRequestCustomException(
                    "Nothing to reprocess.",
                    $"Both ERPs already hold this purchase order (buyer ERP: {order.ErpPurchaseOrderId}, supplier ERP: {order.SupplierErpSalesOrderNumber}).");
            }

            PurchaseOrderErpProcessor processor = new PurchaseOrderErpProcessor(
                _repository,
                _buyerGateway,
                _supplierSalesOrderClient,
                _userContext,
                _logger);
            return await processor.ProcessAsync(order.Id, request.UserId, cancellationToken);
        }

        private PurchaseDocumentIntegration? FindRow(Guid purchaseOrderId, string integrationType)
        {
            return _repository.PurchaseDocumentIntegration.FindFirstByCondition(
                x => x.PurchaseOrderId == purchaseOrderId && x.IntegrationType == integrationType && x.IsActive);
        }
    }
}
