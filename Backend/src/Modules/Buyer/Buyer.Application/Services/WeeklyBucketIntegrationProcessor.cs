using Buyer.Application.Contracts;
using Buyer.Application.Features.Commands.CreatePurchaseOrder;
using Buyer.Application.Features.Shared;
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

namespace Buyer.Application.Services
{
    /// <summary>
    /// Creates the purchase orders of an approved weekly bucket: one purchase order per supplier. Each order is saved here first,
    /// then handed to the buyer's ERP (the S/4 number is kept as ErpPurchaseOrderId) and to the supplier's ERP (the sales order
    /// number is kept as SupplierErpSalesOrderNumber), the same way as an order created through the purchase order API
    /// (see <see cref="PurchaseOrderErpProcessor"/>). Called from the weekend automation, Quick Create and the retry request.
    /// An order that exists is never created again, and a hand-off that succeeded is never sent again.
    /// </summary>
    public class WeeklyBucketIntegrationProcessor
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IBuyerPurchaseDocumentGateway _buyerGateway;
        private readonly ISupplierSalesOrderClient _supplierClient;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public WeeklyBucketIntegrationProcessor(
            IRepositoryWrapper repository,
            IMediator mediator,
            IBuyerPurchaseDocumentGateway buyerGateway,
            ISupplierSalesOrderClient supplierClient,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _buyerGateway = buyerGateway;
            _supplierClient = supplierClient;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task SendPurchaseOrdersAsync(Guid weeklyBucketId, Guid actorUserId, CancellationToken cancellationToken)
        {
            _userContext.SetCurrentUserId(actorUserId);
            WeeklyBucket? bucket = await _repository.WeeklyBucket.GetTrackedByIdAsync(weeklyBucketId, cancellationToken);
            if (bucket == null)
            {
                _logger.LogError($"Weekly bucket not found while creating purchase orders. WeeklyBucketId: {weeklyBucketId}");
                return;
            }

            List<WeeklyBucketItem> lines = (await _repository.WeeklyBucket.GetItemsAsync(bucket.Id, cancellationToken))
                .Where(x => x.LineStatus != Common.LINE_EXCLUDED && x.ApprovedQuantity > 0)
                .ToList();
            if (lines.Count == 0)
            {
                bucket.Status = Common.WEEKLY_BUCKET_PO_FAILED;
                bucket.LastError = "The weekly bucket has no line to order.";
                AddAudit(bucket, Common.AUDIT_ERP_FAILED, bucket.LastError);
                await _repository.SaveAsync();
                _logger.LogError($"Weekly bucket has no line to order. WeeklyBucketId: {bucket.Id}");
                return;
            }

            PurchaseOrderErpProcessor erp = new PurchaseOrderErpProcessor(_repository, _buyerGateway, _supplierClient, _userContext, _logger);

            // One purchase order per supplier. A supplier that fails does not stop the others.
            List<string> errors = new List<string>();
            foreach (IGrouping<Guid, WeeklyBucketItem> supplierLines in lines.GroupBy(x => x.SupplierId))
            {
                string? error = await CreateOneAsync(bucket, supplierLines.Key, supplierLines.ToList(), erp, actorUserId, cancellationToken);
                if (error != null)
                {
                    errors.Add(error);
                }
            }

            if (errors.Count > 0)
            {
                bucket.Status = Common.WEEKLY_BUCKET_PO_FAILED;
                bucket.LastError = string.Join(" | ", errors);
                AddAudit(bucket, Common.AUDIT_ERP_FAILED, bucket.LastError);
                await _repository.SaveAsync();
                _logger.LogError($"Purchase order creation failed. WeeklyBucketId: {bucket.Id}, FailedSuppliers: {errors.Count}");
                return;
            }

            bucket.Status = Common.WEEKLY_BUCKET_PO_CREATED;
            bucket.LastError = null;
            await _repository.SaveAsync();
            _logger.LogInfo($"Purchase orders created. WeeklyBucketId: {bucket.Id}");
        }

        // Returns null when the supplier's purchase order went through every hand-off that is configured, otherwise the error to
        // show on the bucket. A new order is created by the same command as the purchase order API (CreatePurchaseOrderCommand:
        // saved here first, then handed to the buyer's ERP and the supplier's ERP). An order that exists is only handed on again.
        private async Task<string?> CreateOneAsync(
            WeeklyBucket bucket,
            Guid supplierId,
            List<WeeklyBucketItem> lines,
            PurchaseOrderErpProcessor erp,
            Guid actorUserId,
            CancellationToken cancellationToken)
        {
            string supplierLabel = lines[0].SupplierName ?? supplierId.ToString();
            try
            {
                PurchaseOrder? order = _repository.PurchaseOrder.FindFirstByCondition(
                    x => x.WeeklyBucketId == bucket.Id && x.SupplierId == supplierId
                        && x.SourceType == Common.PURCHASE_ORDER_SOURCE_WEEKLY_BUCKET && x.IsActive);

                PurchaseOrderProcessResultDto result;
                if (order == null)
                {
                    result = await _mediator.Send(new CreatePurchaseOrderCommand
                    {
                        OrganizationId = bucket.BuyerOrganizationId,
                        UserId = actorUserId,
                        WeeklyBucketId = bucket.Id,
                        BucketCode = bucket.BucketCode,
                        SupplierName = lines[0].SupplierName,
                        Request = await BuildRequestAsync(bucket, supplierId, lines, cancellationToken),
                        LineExtras = lines.Select(line => new CreatePurchaseOrderLineExtra
                        {
                            CatalogId = line.CatalogId,
                            OutletId = line.OutletId,
                            DiscountPercent = line.DiscountPercent
                        }).ToList()
                    }, cancellationToken);
                    AddAudit(bucket, Common.AUDIT_ERP_STARTED, $"Supplier={supplierLabel} PurchaseOrder={result.PoNumber}");
                }
                else
                {
                    await AdoptLegacyDocumentAsync(bucket, order, supplierId, cancellationToken);
                    result = await erp.ProcessAsync(order.Id, actorUserId, cancellationToken);
                }

                return DescribeFailure(bucket, supplierLabel, result);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                string detail = (exception as BaseCustomException)?.Description ?? exception.Message;
                _logger.LogError($"Weekly bucket purchase order failed. WeeklyBucketId: {bucket.Id}, SupplierId: {supplierId}, Error: {exception.Message} {detail}");
                return $"{supplierLabel}: {detail}";
            }
        }

        private string? DescribeFailure(WeeklyBucket bucket, string supplierLabel, PurchaseOrderProcessResultDto result)
        {
            List<string> problems = new List<string>();
            if (PurchaseOrderErpProcessor.NeedsAttention(result.BuyerErpStatus))
            {
                problems.Add($"buyer ERP {result.BuyerErpStatus}{(string.IsNullOrWhiteSpace(result.BuyerErpError) ? string.Empty : ": " + result.BuyerErpError)}");
            }

            if (PurchaseOrderErpProcessor.NeedsAttention(result.SupplierErpStatus) && !PurchaseOrderErpProcessor.NeedsAttention(result.BuyerErpStatus))
            {
                problems.Add($"supplier ERP {result.SupplierErpStatus}{(string.IsNullOrWhiteSpace(result.SupplierErpError) ? string.Empty : ": " + result.SupplierErpError)}");
            }

            if (problems.Count == 0)
            {
                AddAudit(bucket, Common.AUDIT_ERP_SUCCEEDED,
                    $"Supplier={supplierLabel} PurchaseOrder={result.PoNumber} ErpPurchaseOrderId={result.ErpPurchaseOrderId} SupplierErpSalesOrderNumber={result.SupplierErpSalesOrderNumber}");
                return null;
            }

            string detail = $"{supplierLabel} ({result.PoNumber}): {string.Join("; ", problems)}";
            AddAudit(bucket, Common.AUDIT_ERP_FAILED, detail);
            return detail;
        }

        // The request of the purchase order API for one supplier of the bucket. The ERP details come from what the buyer used on its
        // latest purchase order (purchasing organization and group), the supplier master (vendor number) and the bucket (company
        // code and plant).
        private async Task<CreatePurchaseOrderRequestDto> BuildRequestAsync(
            WeeklyBucket bucket, Guid supplierId, List<WeeklyBucketItem> lines, CancellationToken cancellationToken)
        {
            string? json = await _repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == bucket.BuyerId && x.ErpRequestOptions != null && x.IsActive)
                .OrderByDescending(x => x.OrderDate)
                .Select(x => x.ErpRequestOptions)
                .FirstOrDefaultAsync(cancellationToken);
            CreateContractPurchaseOrderRequestDto last = ContractPurchaseOrderPayload.ReadOptions(json);

            return new CreatePurchaseOrderRequestDto
            {
                SupplierId = supplierId,
                CompanyCode = bucket.CompanyCode,
                PlantCode = bucket.PlantCode,
                Currency = lines[0].Currency,
                OrderDate = DateTime.UtcNow,
                PurchaseOrderType = last.PurchaseOrderType,
                PurchasingOrganization = last.PurchasingOrganization,
                PurchasingGroup = last.PurchasingGroup,
                SupplierCode = await ContractPurchaseOrderDrafts.FindSupplierCodeAsync(_repository, bucket.BuyerId, supplierId, cancellationToken),
                StorageLocation = last.StorageLocation,
                Lines = lines.Select(line => new CreatePurchaseOrderLineDto
                {
                    MaterialCode = line.MaterialCode,
                    Sku = line.Sku,
                    Description = line.ProductName,
                    Quantity = line.ApprovedQuantity,
                    UnitOfMeasure = line.UnitOfMeasure,
                    UnitPrice = line.Price,
                    StorageLocation = line.StorageLocation
                }).ToList()
            };
        }

        // An order made before purchase orders were handed to the ERPs this way has its ERP number as the PO number and a
        // succeeded row on the bucket. Its number is kept, so the ERP is not asked to create it a second time.
        private async Task AdoptLegacyDocumentAsync(WeeklyBucket bucket, PurchaseOrder order, Guid supplierId, CancellationToken cancellationToken)
        {
            if (!string.IsNullOrWhiteSpace(order.ErpPurchaseOrderId))
            {
                return;
            }

            string? documentNumber = await _repository.PurchaseDocumentIntegration
                .FindByCondition(x => x.WeeklyBucketId == bucket.Id && x.PurchaseOrderId == null && x.SupplierOrganizationId == supplierId
                    && x.IntegrationType == Common.ERP_OPERATION_PO_CREATE && x.Status == Common.INTEGRATION_SUCCEEDED && x.IsActive)
                .Select(x => x.ExternalDocumentNumber)
                .FirstOrDefaultAsync(cancellationToken);
            if (!string.IsNullOrWhiteSpace(documentNumber))
            {
                order.ErpPurchaseOrderId = documentNumber;
                await _repository.SaveAsync();
            }
        }

        private void AddAudit(WeeklyBucket bucket, string action, string? detail)
        {
            _repository.WeeklyBucketAudit.Create(new WeeklyBucketAudit
            {
                Id = Guid.NewGuid(),
                WeeklyBucketId = bucket.Id,
                Action = action,
                Detail = detail,
                ActorUserId = _userContext.GetCurrentUserId()
            });
        }
    }
}
