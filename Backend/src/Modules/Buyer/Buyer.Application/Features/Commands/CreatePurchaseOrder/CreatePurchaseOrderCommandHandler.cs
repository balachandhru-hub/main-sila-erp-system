using System.Text.Json;
using System.Text.RegularExpressions;
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
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreatePurchaseOrder
{
    /// <summary>
    /// Creates a purchase order in this system first, then hands it to the buyer's ERP and to the supplier's ERP when they have an
    /// API (see <see cref="PurchaseOrderErpProcessor"/>). The order is saved before any ERP is called: an ERP that is missing or
    /// fails never rolls it back, and the outcome of each hand-off is in the answer so it can be reprocessed.
    /// </summary>
    public class CreatePurchaseOrderCommandHandler : IRequestHandler<CreatePurchaseOrderCommand, PurchaseOrderProcessResultDto>
    {
        private const int MAX_LINES = 500;
        private const decimal MAX_VALUE = 1_000_000_000m;
        private static readonly Regex CurrencyPattern = new Regex("^[A-Za-z]{3}$", RegexOptions.Compiled);

        private readonly IRepositoryWrapper _repository;
        private readonly ISupplierApiClient _supplierApiClient;
        private readonly ISupplierSalesOrderClient _supplierSalesOrderClient;
        private readonly IBuyerPurchaseDocumentGateway _buyerGateway;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public CreatePurchaseOrderCommandHandler(
            IRepositoryWrapper repository,
            ISupplierApiClient supplierApiClient,
            ISupplierSalesOrderClient supplierSalesOrderClient,
            IBuyerPurchaseDocumentGateway buyerGateway,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _supplierApiClient = supplierApiClient;
            _supplierSalesOrderClient = supplierSalesOrderClient;
            _buyerGateway = buyerGateway;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task<PurchaseOrderProcessResultDto> Handle(CreatePurchaseOrderCommand request, CancellationToken cancellationToken)
        {
            CreatePurchaseOrderRequestDto order = request.Request;
            _logger.LogInfo($"Creating purchase order. SupplierId: {order.SupplierId}, Lines: {order.Lines?.Count ?? 0}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            _userContext.SetCurrentUserId(request.UserId);

            BuyerBusinessProfile buyer = GetBuyer(request.OrganizationId);
            Validate(order);
            string? supplierName = string.IsNullOrWhiteSpace(request.SupplierName)
                ? await GetSupplierNameAsync(order.SupplierId, cancellationToken)
                : request.SupplierName;
            CreateContractPurchaseOrderRequestDto? erpOptions = await BuildErpOptionsAsync(buyer, order, cancellationToken);

            // The order is saved first. The number sequence and the order are written together.
            Guid purchaseOrderId = await SilaRetry.RunAsync(_repository, _logger, "Create purchase order", () =>
                SilaTransaction.RunAsync(() => SaveOrderAsync(buyer, order, supplierName, erpOptions, request, cancellationToken)));
            _logger.LogInfo($"Purchase order created. PurchaseOrderId: {purchaseOrderId}, BuyerId: {buyer.Id}");

            // The order exists now. The hand-offs never undo it.
            PurchaseOrderErpProcessor processor = new PurchaseOrderErpProcessor(
                _repository,
                _buyerGateway,
                _supplierSalesOrderClient,
                _userContext,
                _logger);
            return await processor.ProcessAsync(purchaseOrderId, request.UserId, cancellationToken);
        }

        private void Validate(CreatePurchaseOrderRequestDto order)
        {
            if (order.SupplierId == Guid.Empty)
            {
                throw new BadRequestCustomException("Supplier is required.", "Choose the supplier the purchase order is for.");
            }

            if (order.Lines == null || order.Lines.Count == 0)
            {
                throw new BadRequestCustomException("Lines are required.", "A purchase order needs at least one line.");
            }

            if (order.Lines.Count > MAX_LINES)
            {
                throw new BadRequestCustomException("Too many lines.", $"A purchase order can have at most {MAX_LINES} lines.");
            }

            if (!string.IsNullOrWhiteSpace(order.Currency) && !CurrencyPattern.IsMatch(order.Currency.Trim()))
            {
                throw new BadRequestCustomException("Currency is not valid.", "Currency must be a 3 letter ISO code, for example AED.");
            }

            for (int index = 0; index < order.Lines.Count; index++)
            {
                CreatePurchaseOrderLineDto line = order.Lines[index];
                string where = $"Line {index + 1}";
                if (string.IsNullOrWhiteSpace(line.MaterialCode) && string.IsNullOrWhiteSpace(line.Description))
                {
                    throw new BadRequestCustomException("Line is not valid.", $"{where} needs a material code or a description.");
                }

                if (line.Quantity <= 0 || line.Quantity > MAX_VALUE)
                {
                    throw new BadRequestCustomException("Line is not valid.", $"{where}: the quantity must be above 0 and at most {MAX_VALUE:0}.");
                }

                if (line.UnitPrice != null && (line.UnitPrice < 0 || line.UnitPrice > MAX_VALUE))
                {
                    throw new BadRequestCustomException("Line is not valid.", $"{where}: the unit price must be between 0 and {MAX_VALUE:0}.");
                }
            }
        }

        // The ERP details of a buyer ERP of the SAP S/4 kind. They are kept on the order, so a retry sends the same order. An order
        // with none of them is sent in the standard shape. With some of them, and a buyer ERP configured, the rest must come too.
        private async Task<CreateContractPurchaseOrderRequestDto?> BuildErpOptionsAsync(
            BuyerBusinessProfile buyer, CreatePurchaseOrderRequestDto request, CancellationToken cancellationToken)
        {
            bool given = !string.IsNullOrWhiteSpace(request.PurchasingOrganization)
                || !string.IsNullOrWhiteSpace(request.PurchasingGroup)
                || !string.IsNullOrWhiteSpace(request.SupplierCode)
                || !string.IsNullOrWhiteSpace(request.PurchaseOrderType)
                || !string.IsNullOrWhiteSpace(request.AccountAssignmentCategory)
                || !string.IsNullOrWhiteSpace(request.GlAccount);
            if (!given)
            {
                return null;
            }

            CreateContractPurchaseOrderRequestDto options = new CreateContractPurchaseOrderRequestDto
            {
                PurchaseOrderType = Clean(request.PurchaseOrderType) ?? ContractPurchaseOrderPayload.DEFAULT_ORDER_TYPE,
                PurchasingOrganization = Clean(request.PurchasingOrganization),
                PurchasingGroup = Clean(request.PurchasingGroup),
                CompanyCode = Clean(request.CompanyCode),
                SupplierCode = Clean(request.SupplierCode),
                PurchaseOrderDate = request.OrderDate ?? DateTime.UtcNow.Date,
                Plant = Clean(request.PlantCode),
                StorageLocation = Clean(request.StorageLocation),
                // Not sent unless asked for: a normal stock item has no account assignment category (an empty text means none).
                AccountAssignmentCategory = Clean(request.AccountAssignmentCategory) ?? string.Empty,
                GlAccount = Clean(request.GlAccount)
            };
            options.SupplierCode ??= await ContractPurchaseOrderDrafts.FindSupplierCodeAsync(_repository, buyer.Id, request.SupplierId, cancellationToken);

            IntegrationApiDto? api = await _buyerGateway.FindPurchaseOrderApiAsync(buyer.OrganizationId, options.CompanyCode, cancellationToken);
            if (api != null)
            {
                List<string> missing = ContractPurchaseOrderDrafts.MissingRequired(options);
                if (missing.Count > 0)
                {
                    _logger.LogError($"ERP details are missing for the purchase order. SupplierId: {request.SupplierId}, Missing: {string.Join(", ", missing)}");
                    throw new BadRequestCustomException(
                        "ERP details are required.",
                        $"The purchase order is sent to the ERP, which needs: {string.Join(", ", missing)}.");
                }
            }

            return options;
        }

        private async Task<Guid> SaveOrderAsync(
            BuyerBusinessProfile buyer,
            CreatePurchaseOrderRequestDto request,
            string? supplierName,
            CreateContractPurchaseOrderRequestDto? erpOptions,
            CreatePurchaseOrderCommand command,
            CancellationToken cancellationToken)
        {
            string poNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.PURCHASE_ORDER, 6, cancellationToken);
            string? currency = string.IsNullOrWhiteSpace(request.Currency) ? null : request.Currency.Trim().ToUpperInvariant();
            PurchaseOrder order = new PurchaseOrder
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                BuyerOrganizationId = buyer.OrganizationId,
                PoNumber = poNumber,
                SupplierId = request.SupplierId,
                SupplierName = supplierName,
                SourceType = command.WeeklyBucketId == null ? Common.PURCHASE_ORDER_SOURCE_MANUAL : Common.PURCHASE_ORDER_SOURCE_WEEKLY_BUCKET,
                WeeklyBucketId = command.WeeklyBucketId,
                BucketCode = command.BucketCode,
                CompanyCode = Clean(request.CompanyCode),
                PlantCode = Clean(request.PlantCode),
                Currency = currency,
                Status = Common.PURCHASE_ORDER_CREATED,
                OrderDate = request.OrderDate ?? DateTime.UtcNow,
                DeliveryDate = request.DeliveryDate,
                ErpRequestOptions = erpOptions == null ? null : JsonSerializer.Serialize(erpOptions)
            };

            int lineNumber = 0;
            foreach (CreatePurchaseOrderLineDto line in request.Lines)
            {
                lineNumber += 1;
                CreatePurchaseOrderLineExtra? extra = command.LineExtras != null && command.LineExtras.Count >= lineNumber ? command.LineExtras[lineNumber - 1] : null;
                decimal unitPrice = line.UnitPrice ?? 0;
                decimal lineAmount = Math.Round(line.Quantity * unitPrice * (100 - (extra?.DiscountPercent ?? 0)) / 100, 4);
                _repository.PurchaseOrderItem.Create(new PurchaseOrderItem
                {
                    Id = Guid.NewGuid(),
                    PurchaseOrderId = order.Id,
                    LineNumber = lineNumber,
                    CatalogId = extra?.CatalogId ?? Guid.Empty,
                    Sku = Clean(line.Sku),
                    MaterialCode = Clean(line.MaterialCode),
                    ProductName = Clean(line.Description) ?? Clean(line.MaterialCode) ?? string.Empty,
                    Quantity = line.Quantity,
                    UnitOfMeasure = Clean(line.UnitOfMeasure),
                    UnitPrice = line.UnitPrice,
                    DiscountPercent = extra?.DiscountPercent,
                    OutletId = extra?.OutletId,
                    LineAmount = lineAmount,
                    Currency = currency,
                    StorageLocation = Clean(line.StorageLocation)
                });
                order.TotalAmount += lineAmount;
            }

            _repository.PurchaseOrder.Create(order);
            _userContext.SetCurrentUserId(command.UserId);
            await _repository.SaveAsync();
            return order.Id;
        }

        // The supplier must exist. When the Supplier service cannot be asked, the order is still created (the name is for
        // display); the hand-off to the supplier then reports the problem and can be reprocessed.
        private async Task<string?> GetSupplierNameAsync(Guid supplierId, CancellationToken cancellationToken)
        {
            List<SupplierNameDto> names;
            try
            {
                names = await _supplierApiClient.GetSupplierNamesByIds(new List<Guid> { supplierId }, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                _logger.LogError($"The supplier name could not be read. SupplierId: {supplierId}, Error: {exception.Message}");
                return null;
            }

            SupplierNameDto? found = names.FirstOrDefault(x => x.SupplierId == supplierId);
            if (found == null)
            {
                _logger.LogError($"Supplier not found for the purchase order. SupplierId: {supplierId}");
                throw new BadRequestCustomException("Supplier not found.", "The supplier of the purchase order does not exist.");
            }

            return found.SupplierName;
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
