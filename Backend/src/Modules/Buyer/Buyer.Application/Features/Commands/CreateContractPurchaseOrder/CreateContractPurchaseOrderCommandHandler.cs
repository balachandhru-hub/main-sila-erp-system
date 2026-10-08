using System.Text.Json;
using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateContractPurchaseOrder
{
    /// <summary>
    /// Creates a purchase order from an approved contract and hands it to the buyer ERP when one is configured.
    /// The order lines come from the RFQ award of the contract supplier (one line per awarded item, priced from the
    /// supplier quotation), or, for a lot-wise award, one lump-sum line for what is left of the contract amount.
    /// The order is saved first: an ERP that is missing or fails never rolls it back.
    /// When the buyer has a purchase order API the ERP details the contract does not hold (purchasing organization,
    /// purchasing group, company code, supplier code, plant ...) must come with the request.
    /// </summary>
    public class CreateContractPurchaseOrderCommandHandler : IRequestHandler<CreateContractPurchaseOrderCommand, ContractPurchaseOrderDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ISupplierApiClient _supplierApiClient;
        private readonly IMediator _mediator;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public CreateContractPurchaseOrderCommandHandler(
            IRepositoryWrapper repository,
            ISupplierApiClient supplierApiClient,
            IMediator mediator,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _supplierApiClient = supplierApiClient;
            _mediator = mediator;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task<ContractPurchaseOrderDto> Handle(CreateContractPurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating purchase order from contract. ContractId: {request.ContractId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            _userContext.SetCurrentUserId(request.UserId);

            BuyerBusinessProfile buyer = GetBuyer(request.OrganizationId);
            PredefinedContract contract = await GetContractAsync(request.ContractId, buyer.Id, cancellationToken);

            // Cheap checks first, before the Supplier service is called. They are checked again under the lock.
            decimal ordered = await OrderedAmountAsync(contract.Id, cancellationToken);
            ThrowWhenBlocked(contract, ordered);

            CreateContractPurchaseOrderRequestDto options = await CompleteOptionsAsync(request.Options, buyer, contract, cancellationToken);

            ContractAwardLineBuilder lineBuilder = new ContractAwardLineBuilder(_repository, _supplierApiClient, _logger);
            List<ContractItemDto>? lines = await lineBuilder.BuildForPurchaseOrderAsync(contract, cancellationToken);
            string? supplierName = await GetSupplierNameAsync(contract.SupplierId, cancellationToken);

            // The lock serializes parallel requests for the contract, so the amount cap holds and a double click
            // cannot create the same order twice beyond what the cap allows.
            Guid purchaseOrderId = await SilaRetry.RunAsync(_repository, _logger, "Create contract purchase order", () =>
                SilaTransaction.RunAsync(() => SaveOrderAsync(buyer, contract, lines, options, supplierName, request.UserId, cancellationToken)));

            _logger.LogInfo($"Purchase order created from contract. PurchaseOrderId: {purchaseOrderId}, ContractId: {contract.Id}");

            // The order exists now. The ERP hand-off never undoes it.
            ContractPurchaseOrderIntegrationProcessor processor = new ContractPurchaseOrderIntegrationProcessor(
                _repository,
                new BuyerPurchaseDocumentGateway(_mediator, _logger),
                _userContext,
                _logger);
            await processor.SendAsync(purchaseOrderId, contract.ContractNumber, request.UserId, cancellationToken);

            List<ContractPurchaseOrderDto> orders = (await ContractPurchaseOrderRules.ListByContractAsync(
                _repository, new List<PredefinedContract> { contract }, cancellationToken))
                .GetValueOrDefault(contract.Id) ?? new List<ContractPurchaseOrderDto>();
            return orders.First(x => x.Id == purchaseOrderId);
        }

        // Fills the defaults and, when the buyer has a purchase order API, refuses a request missing the ERP details.
        private async Task<CreateContractPurchaseOrderRequestDto> CompleteOptionsAsync(
            CreateContractPurchaseOrderRequestDto given,
            BuyerBusinessProfile buyer,
            PredefinedContract contract,
            CancellationToken cancellationToken)
        {
            CreateContractPurchaseOrderRequestDto options = new CreateContractPurchaseOrderRequestDto
            {
                PurchaseOrderType = Clean(given.PurchaseOrderType) ?? ContractPurchaseOrderPayload.DEFAULT_ORDER_TYPE,
                PurchasingOrganization = Clean(given.PurchasingOrganization),
                PurchasingGroup = Clean(given.PurchasingGroup),
                CompanyCode = Clean(given.CompanyCode),
                SupplierCode = Clean(given.SupplierCode),
                PurchaseOrderDate = given.PurchaseOrderDate ?? DateTime.UtcNow.Date,
                Plant = Clean(given.Plant),
                StorageLocation = Clean(given.StorageLocation),
                AccountAssignmentCategory = Clean(given.AccountAssignmentCategory) ?? ContractPurchaseOrderPayload.DEFAULT_ACCOUNT_ASSIGNMENT_CATEGORY,
                GlAccount = Clean(given.GlAccount)
            };

            options.SupplierCode ??= await ContractPurchaseOrderDrafts.FindSupplierCodeAsync(_repository, buyer.Id, contract.SupplierId, cancellationToken);

            IntegrationApiDto? api = await new BuyerPurchaseDocumentGateway(_mediator, _logger)
                .FindPurchaseOrderApiAsync(buyer.OrganizationId, options.CompanyCode, cancellationToken);
            if (api != null)
            {
                List<string> missing = ContractPurchaseOrderDrafts.MissingRequired(options);
                if (missing.Count > 0)
                {
                    _logger.LogError($"ERP details are missing for the purchase order. ContractId: {contract.Id}, Missing: {string.Join(", ", missing)}");
                    throw new BadRequestCustomException(
                        "ERP details are required.",
                        $"The purchase order is sent to the ERP, which needs: {string.Join(", ", missing)}.");
                }
            }

            return options;
        }

        // Lot-wise award: the contract only holds an amount. Every RFQ item becomes a line with its own quantity, unit and
        // material; the amount left is spread over the items by quantity (same unit price for each).
        private async Task<List<ContractItemDto>> LotLinesAsync(PredefinedContract current, decimal remaining, CancellationToken cancellationToken)
        {
            List<RFQItem> rfqItems = await _repository.RFQItem
                .FindByCondition(x => x.RFQId == current.RFQId && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);

            decimal totalQuantity = rfqItems.Sum(x => x.Quantity);
            if (rfqItems.Count == 0 || totalQuantity <= 0)
            {
                _logger.LogError($"The RFQ of the contract has no item quantity. ContractId: {current.Id}");
                throw new BadRequestCustomException("No items to order.", "The RFQ of this contract has no item with a quantity, so there is nothing to order.");
            }

            decimal unitPrice = remaining / totalQuantity;
            return rfqItems.Select(item => new ContractItemDto
            {
                LineNumber = item.LineNumber,
                MaterialCode = item.MaterialCode,
                MaterialGroup = item.MaterialGroup,
                CostCenter = item.CostCenter,
                Description = item.Description,
                Quantity = item.Quantity,
                UnitOfMeasure = item.UOM,
                UnitPrice = unitPrice,
                LineAmount = unitPrice * item.Quantity
            }).ToList();
        }

        private async Task<Guid> SaveOrderAsync(
            BuyerBusinessProfile buyer,
            PredefinedContract contract,
            List<ContractItemDto>? awardLines,
            CreateContractPurchaseOrderRequestDto options,
            string? supplierName,
            Guid userId,
            CancellationToken cancellationToken)
        {
            await _repository.PurchaseOrder.LockContractAsync(contract.Id, cancellationToken);

            // Read again under the lock: another request may have used the amount, or the contract may have changed.
            PredefinedContract current = await GetContractAsync(contract.Id, buyer.Id, cancellationToken);
            decimal ordered = await OrderedAmountAsync(current.Id, cancellationToken);
            ThrowWhenBlocked(current, ordered);
            decimal remaining = current.Amount - ordered;

            List<ContractItemDto> lines = awardLines ?? await LotLinesAsync(current, remaining, cancellationToken);

            decimal total = lines.Sum(x => x.LineAmount ?? 0);
            if (total > remaining)
            {
                _logger.LogError($"Purchase order is over the contract amount. ContractId: {current.Id}, Total: {total}, Remaining: {remaining}");
                throw new BadRequestCustomException(
                    "Contract amount exceeded.",
                    $"The purchase order total {total:0.####} is more than the amount left on the contract: {remaining:0.####}.");
            }

            string poNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.PURCHASE_ORDER, 6, cancellationToken);
            string? currency = current.RFQ?.Currency;
            PurchaseOrder order = new PurchaseOrder
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                BuyerOrganizationId = buyer.OrganizationId,
                PoNumber = poNumber,
                SupplierId = current.SupplierId,
                SupplierName = supplierName,
                SourceType = Common.PURCHASE_ORDER_SOURCE_CONTRACT,
                ContractId = current.Id,
                CompanyCode = options.CompanyCode,
                PlantCode = options.Plant,
                Currency = currency,
                TotalAmount = total,
                Status = Common.PURCHASE_ORDER_CREATED,
                OrderDate = DateTime.UtcNow,
                ErpRequestOptions = JsonSerializer.Serialize(options)
            };
            _repository.PurchaseOrder.Create(order);

            int lineNumber = 0;
            foreach (ContractItemDto line in lines)
            {
                lineNumber += 1;
                _repository.PurchaseOrderItem.Create(new PurchaseOrderItem
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = order.Id,
                    LineNumber = lineNumber,
                    CatalogId = Guid.Empty,
                    MaterialCode = line.MaterialCode,
                    MaterialGroup = line.MaterialGroup,
                    CostCenter = line.CostCenter,
                    ProductName = line.Description,
                    Quantity = line.Quantity,
                    UnitOfMeasure = line.UnitOfMeasure,
                    UnitPrice = line.UnitPrice,
                    LineAmount = line.LineAmount ?? 0,
                    StorageLocation = options.StorageLocation,
                    Currency = currency
                });
            }

            _userContext.SetCurrentUserId(userId);
            await _repository.SaveAsync();
            return order.Id;
        }

        private async Task<string?> GetSupplierNameAsync(Guid supplierId, CancellationToken cancellationToken)
        {
            try
            {
                List<SupplierNameDto> names = await _supplierApiClient.GetSupplierNamesByIds(new List<Guid> { supplierId }, cancellationToken);
                return names.FirstOrDefault(x => x.SupplierId == supplierId)?.SupplierName;
            }
            catch (Exception exception)
            {
                // The name is only for display: the order does not wait on it.
                _logger.LogError($"The supplier name could not be read. SupplierId: {supplierId}, Error: {exception.Message}");
                return null;
            }
        }

        private async Task<decimal> OrderedAmountAsync(Guid contractId, CancellationToken cancellationToken)
        {
            return await _repository.PurchaseOrder
                .FindByCondition(x => x.ContractId == contractId && x.IsActive)
                .SumAsync(x => (decimal?)x.TotalAmount, cancellationToken) ?? 0;
        }

        private void ThrowWhenBlocked(PredefinedContract contract, decimal ordered)
        {
            string? blocked = ContractPurchaseOrderRules.BlockedReason(contract, ordered, DateTime.UtcNow);
            if (blocked != null)
            {
                _logger.LogError($"Purchase order is not allowed for the contract. ContractId: {contract.Id}, Reason: {blocked}");
                throw new BadRequestCustomException("Purchase order cannot be created.", blocked);
            }
        }

        private async Task<PredefinedContract> GetContractAsync(Guid contractId, Guid buyerId, CancellationToken cancellationToken)
        {
            PredefinedContract? contract = await _repository.PredefinedContract
                .FindByCondition(x => x.Id == contractId && x.BuyerId == buyerId && x.IsActive)
                .Include(x => x.RFQ)
                .FirstOrDefaultAsync(cancellationToken);
            if (contract == null)
            {
                // Another organization contract looks the same as a missing one.
                _logger.LogError($"Contract not found. ContractId: {contractId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Contract not found.", "No contract exists for this buyer organization.");
            }

            return contract;
        }

        private BuyerBusinessProfile GetBuyer(Guid organizationId)
        {
            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                x => x.OrganizationId == organizationId && x.IsActive);
            if (buyer == null)
            {
                _logger.LogError($"Buyer not found. OrganizationId: {organizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            return buyer;
        }

        private static string? Clean(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
