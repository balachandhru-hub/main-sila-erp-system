using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Rules and read models shared by the SILA ME receiving use cases: open purchase order quantities,
    /// the goods receipt and invoice views, and the lookups they start with.
    /// </summary>
    public static class SilaReceivingRules
    {
        /// <summary>Status of a cancelled purchase order; it cannot be received.</summary>
        public const string PO_CANCELLED = "CANCELLED";

        /// <summary>Largest invoice file accepted, in bytes (20 MB).</summary>
        public const long MAX_INVOICE_BYTES = 20L * 1024 * 1024;

        private static readonly Dictionary<string, string> InvoiceContentTypes = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            [".pdf"] = "application/pdf",
            [".jpg"] = "image/jpeg",
            [".jpeg"] = "image/jpeg",
            [".png"] = "image/png"
        };

        public static decimal OpenQuantity(PurchaseOrderItem item)
        {
            return Math.Max(0, item.Quantity - item.ReceivedQuantity);
        }

        /// <summary>A received or cancelled purchase order takes no more goods receipts.</summary>
        public const string LINE_OPEN = "OPEN";
        public const string INVENTORY_SERVICE = "SERVICE";

        /// <summary>OPEN, PARTIALLY_RECEIVED or RECEIVED from the received and ordered quantities of a line.</summary>
        public static string LineStatus(PurchaseOrderItem item)
        {
            if (item.ReceivedQuantity <= 0)
            {
                return LINE_OPEN;
            }

            return OpenQuantity(item) > 0 ? Common.SILA_PO_PARTIALLY_RECEIVED : Common.SILA_PO_RECEIVED;
        }

        /// <summary>A goods receipt is expected unless the source says no or the material is a SERVICE item.</summary>
        public static bool GoodsReceiptExpected(PurchaseOrderItem item, ItemBuyerMaster? material)
        {
            if (item.GoodsReceiptExpected == false)
            {
                return false;
            }

            return !string.Equals(material?.InventoryType, INVENTORY_SERVICE, StringComparison.OrdinalIgnoreCase);
        }

        public const string INVOICE_MATERIAL = "MATERIAL";
        public const string INVOICE_SERVICE = "SERVICE";
        public const string INVOICE_MIXED = "MIXED";
        public const string MATCH_MATCHED = "MATCHED";
        public const string MATCH_SUGGESTED = "SUGGESTED";
        public const string MATCH_UNMATCHED = "UNMATCHED";
        public const int MAX_BATCH_LENGTH = 40;
        public const string SERVICE_GRN_MESSAGE = "Goods receipt not applicable for a service invoice.";

        /// <summary>A SERVICE invoice bills no goods, so no goods receipt can be posted for it.</summary>
        public static bool IsServiceInvoice(Invoice? invoice)
        {
            return string.Equals(invoice?.InvoiceType, INVOICE_SERVICE, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// The batch / expiry problem of a received line, or null: a batch-managed material needs a batch number, an
        /// expiry-managed material an expiry date that has not passed (only for an accepted quantity).
        /// </summary>
        public static string? BatchExpiryProblem(SilaReceivingGrnLineWriteDto line, PurchaseOrderItem poItem, ItemBuyerMaster? material, DateTime today)
        {
            string label = $"Line {poItem.LineNumber} ({poItem.ProductName})";
            if ((line.BatchNumber?.Trim().Length ?? 0) > MAX_BATCH_LENGTH)
            {
                return $"{label}: keep the batch number within {MAX_BATCH_LENGTH} characters.";
            }

            if (material == null || line.AcceptedQty <= 0)
            {
                return null;
            }

            if (material.BatchManaged && string.IsNullOrWhiteSpace(line.BatchNumber))
            {
                return $"{label}: the material is batch managed; enter the batch number.";
            }

            if (material.ExpiryManaged && line.ExpiryDate == null)
            {
                return $"{label}: the material is expiry managed; enter the expiry date.";
            }

            if (line.ExpiryDate != null && line.ExpiryDate.Value.Date < today.Date)
            {
                return $"{label}: the expiry date {line.ExpiryDate:yyyy-MM-dd} has passed; reject the goods instead of accepting them.";
            }

            return null;
        }

        /// <summary>Quantity billed per purchase order line by the invoice lines matched to it.</summary>
        public static async Task<Dictionary<Guid, decimal>> InvoiceQuantitiesAsync(IRepositoryWrapper repository, Guid invoiceId, CancellationToken cancellationToken)
        {
            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoiceId && x.IsActive && x.PurchaseOrderItemId != null && x.Quantity != null)
                .ToListAsync(cancellationToken);
            return items.GroupBy(x => x.PurchaseOrderItemId!.Value).ToDictionary(x => x.Key, x => x.Sum(y => y.Quantity!.Value));
        }

        /// <summary>ERP-style item number of a line: the line number on 5 digits (10 = 00010).</summary>
        public static string ItemNumber(PurchaseOrderItem item)
        {
            return item.LineNumber.ToString("D5", System.Globalization.CultureInfo.InvariantCulture);
        }

        public static bool IsClosed(PurchaseOrder purchaseOrder)
        {
            return purchaseOrder.Status == PO_CANCELLED || purchaseOrder.Status == Common.SILA_PO_RECEIVED;
        }

        /// <summary>The content type of an invoice file, or null when the file type is not accepted.</summary>
        public static string? InvoiceContentType(string fileName)
        {
            return InvoiceContentTypes.TryGetValue(Path.GetExtension(fileName ?? string.Empty), out string? type) ? type : null;
        }

        /// <summary>Whether the content really is the file type its name says (PDF, JPEG or PNG signature).</summary>
        public static bool HasInvoiceSignature(string fileName, byte[] content)
        {
            string extension = Path.GetExtension(fileName ?? string.Empty).ToLowerInvariant();
            return extension switch
            {
                ".pdf" => StartsWith(content, 0x25, 0x50, 0x44, 0x46),
                ".png" => StartsWith(content, 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A),
                ".jpg" or ".jpeg" => StartsWith(content, 0xFF, 0xD8, 0xFF),
                _ => false
            };
        }

        private static bool StartsWith(byte[] content, params byte[] signature)
        {
            return content.Length >= signature.Length && content.Take(signature.Length).SequenceEqual(signature);
        }

        /// <summary>Active Item Master materials of the buyer by material code (case-insensitive).</summary>
        public static async Task<Dictionary<string, ItemBuyerMaster>> GetMaterialsByCodeAsync(
            IRepositoryWrapper repository, Guid buyerId, IEnumerable<string?> materialCodes, CancellationToken cancellationToken)
        {
            List<string> codes = materialCodes
                .Where(code => !string.IsNullOrWhiteSpace(code))
                .Select(code => code!.Trim())
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            Dictionary<string, ItemBuyerMaster> result = new Dictionary<string, ItemBuyerMaster>(StringComparer.OrdinalIgnoreCase);
            if (codes.Count == 0)
            {
                return result;
            }

            List<ItemBuyerMaster> materials = await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && codes.Contains(x.MaterialCode))
                .ToListAsync(cancellationToken);
            foreach (ItemBuyerMaster material in materials)
            {
                result.TryAdd(material.MaterialCode.Trim(), material);
            }

            return result;
        }

        /// <summary>A purchase order of the buyer. Not found is a 404.</summary>
        public static async Task<PurchaseOrder> GetPurchaseOrderAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid purchaseOrderId)
        {
            PurchaseOrder? purchaseOrder = await repository.PurchaseOrder.FindFirstByConditionAsync(
                x => x.Id == purchaseOrderId && x.BuyerId == buyerId && x.IsActive);
            if (purchaseOrder == null)
            {
                logger.LogError($"Purchase order not found. PurchaseOrderId: {purchaseOrderId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Purchase order not found.", "Select a purchase order of this organization.");
            }

            return purchaseOrder;
        }

        /// <summary>An invoice of the buyer, tracked. Not found is a 404.</summary>
        public static async Task<Invoice> GetInvoiceAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid invoiceId)
        {
            Invoice? invoice = await repository.Invoice.FindFirstByConditionAsync(
                x => x.Id == invoiceId && x.BuyerId == buyerId && x.IsActive);
            if (invoice == null)
            {
                logger.LogError($"Invoice not found. InvoiceId: {invoiceId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Invoice not found.", "Select an invoice uploaded by this organization.");
            }

            return invoice;
        }

        public static SilaErpPostingListItemDto ToPostingDto(InventoryErpPosting posting, string? locationName)
        {
            return new SilaErpPostingListItemDto
            {
                Id = posting.Id,
                ReferenceType = posting.ReferenceType,
                ReferenceId = posting.ReferenceId,
                ReferenceNumber = posting.ReferenceNumber,
                LocationId = posting.LocationId,
                LocationName = locationName,
                MovementType = posting.MovementType,
                Status = posting.Status,
                Attempts = posting.Attempts,
                ErpReference = posting.ErpReference,
                ErrorMessage = posting.ErrorMessage,
                PostedOn = posting.PostedOn,
                CompanyCode = posting.CompanyCode,
                IntegrationSystem = posting.IntegrationSystem,
                CreatedOn = posting.DateCreated
            };
        }

        /// <summary>List rows of goods receipts with their location, supplier, invoice and ERP posting status.</summary>
        public static async Task<List<SilaReceivingGrnListItemDto>> ToGrnListAsync(
            IRepositoryWrapper repository, List<GoodsReceipt> receipts, CancellationToken cancellationToken)
        {
            List<Guid> receiptIds = receipts.Select(x => x.Id).ToList();
            List<Guid> locationIds = receipts.Select(x => x.LocationId).Distinct().ToList();
            List<Guid> purchaseOrderIds = receipts.Select(x => x.PurchaseOrderId).Distinct().ToList();
            List<Guid> invoiceIds = receipts.Where(x => x.InvoiceId != null).Select(x => x.InvoiceId!.Value).Distinct().ToList();
            List<Guid> postingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();

            Dictionary<Guid, string> locations = await repository.InventoryLocation
                .FindByCondition(x => locationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.LocationName, cancellationToken);
            Dictionary<Guid, string?> suppliers = await repository.PurchaseOrder
                .FindByCondition(x => purchaseOrderIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, x => x.SupplierName, cancellationToken);
            List<Invoice> invoiceRows = invoiceIds.Count == 0
                ? new List<Invoice>()
                : await repository.Invoice.FindByCondition(x => invoiceIds.Contains(x.Id)).ToListAsync(cancellationToken);
            Dictionary<Guid, Invoice> invoices = invoiceRows.ToDictionary(x => x.Id);
            List<Guid> invoicePostingIds = invoiceRows.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> invoicePostings = invoicePostingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => invoicePostingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, InventoryErpPosting> postings = await repository.InventoryErpPosting
                .FindByCondition(x => postingIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> lineReceiptIds = await repository.GoodsReceiptItem
                .FindByCondition(x => receiptIds.Contains(x.GoodsReceiptId) && x.IsActive)
                .Select(x => x.GoodsReceiptId)
                .ToListAsync(cancellationToken);

            return receipts.Select(receipt =>
            {
                InventoryErpPosting? posting = receipt.ErpPostingId != null && postings.TryGetValue(receipt.ErpPostingId.Value, out InventoryErpPosting? found) ? found : null;
                return new SilaReceivingGrnListItemDto
                {
                    Id = receipt.Id,
                    GrnNumber = receipt.GrnNumber,
                    PurchaseOrderId = receipt.PurchaseOrderId,
                    PoNumber = receipt.PoNumber,
                    SupplierName = suppliers.TryGetValue(receipt.PurchaseOrderId, out string? supplier) ? supplier : null,
                    LocationId = receipt.LocationId,
                    LocationName = locations.TryGetValue(receipt.LocationId, out string? location) ? location : null,
                    InvoiceId = receipt.InvoiceId,
                    InvoiceNumber = receipt.InvoiceId != null && invoices.TryGetValue(receipt.InvoiceId.Value, out Invoice? held) ? held.InvoiceNumber : null,
                    InvoiceStatus = receipt.InvoiceId != null && invoices.TryGetValue(receipt.InvoiceId.Value, out Invoice? heldStatus) ? heldStatus.Status : null,
                    InvoiceErpStatus = receipt.InvoiceId != null && invoices.TryGetValue(receipt.InvoiceId.Value, out Invoice? heldErp) && heldErp.ErpPostingId != null && invoicePostings.TryGetValue(heldErp.ErpPostingId.Value, out InventoryErpPosting? heldPosting) ? heldPosting.Status : null,
                    DeliveryNote = receipt.DeliveryNote,
                    Status = receipt.Status,
                    ReceivedOn = receipt.DateCreated,
                    LineCount = lineReceiptIds.Count(id => id == receipt.Id),
                    ErpPostingId = receipt.ErpPostingId,
                    ErpStatus = posting?.Status,
                    ErpReference = posting?.ErpReference ?? receipt.MaterialDocument,
                    ReversalGrnNumber = receipt.ReversalGrnNumber,
                    ParentGoodsReceiptId = receipt.ParentGoodsReceiptId
                };
            }).ToList();
        }

        /// <summary>The invoice with its active lines and the goods receipts posted from it.</summary>
        public static async Task<SilaInvoiceDetailDto> ToInvoiceDetailAsync(IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            bool failed = invoice.Status == Common.SILA_INVOICE_OCR_FAILED;
            SilaOcrConfiguration settings = await SilaOcrSettings.GetAsync(repository, invoice.BuyerId, cancellationToken);
            string? supplierCode = null;
            InventoryErpPosting? posting = invoice.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindByCondition(x => x.Id == invoice.ErpPostingId.Value).FirstOrDefaultAsync(cancellationToken);
            List<Guid> grnPostingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> grnPostings = grnPostingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => grnPostingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            bool service = IsServiceInvoice(invoice);
            bool GrnConfirmed(GoodsReceipt receipt)
            {
                if (receipt.ErpPostingId == null)
                {
                    return true;
                }

                return grnPostings.TryGetValue(receipt.ErpPostingId.Value, out InventoryErpPosting? row)
                    && (row.Status is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL
                        || !string.IsNullOrWhiteSpace(row.ErpReference));
            }

            bool grnConfirmed = receipts.Count > 0 && receipts.All(GrnConfirmed);
            bool postingOpen = posting != null && (posting.Status is Common.SILA_POSTING_PENDING or Common.SILA_POSTING_UNKNOWN
                or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_POSTED or Common.SILA_POSTING_FAILED_LOCAL
                || !string.IsNullOrWhiteSpace(posting.ErpReference));
            List<SilaInvoiceDocumentDto> documents = new List<SilaInvoiceDocumentDto>();
            if (!string.IsNullOrWhiteSpace(invoice.FileName))
            {
                documents.Add(new SilaInvoiceDocumentDto
                {
                    DocumentType = "Original Supplier Invoice",
                    PoNumber = invoice.PoNumber,
                    FileName = invoice.FileName,
                    GeneratedOn = invoice.DateCreated
                });
            }

            List<Guid> detailPoItemIds = items.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).Distinct().ToList();
            List<PurchaseOrderItem> detailPoItems = detailPoItemIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => detailPoItemIds.Contains(x.Id)).ToListAsync(cancellationToken);
            List<Guid> detailPoIds = detailPoItems.Select(x => x.PurchaseOrderId).ToList();
            if (invoice.PurchaseOrderId != null)
            {
                detailPoIds.Add(invoice.PurchaseOrderId.Value);
            }

            detailPoIds = detailPoIds.Distinct().ToList();
            List<PurchaseOrder> detailOrders = detailPoIds.Count == 0
                ? new List<PurchaseOrder>()
                : await repository.PurchaseOrder.FindByCondition(x => detailPoIds.Contains(x.Id)).ToListAsync(cancellationToken);
            Guid? poSupplierId = invoice.PurchaseOrderId == null
                ? null
                : detailOrders.FirstOrDefault(x => x.Id == invoice.PurchaseOrderId)?.SupplierId;
            supplierCode = await ErpSupplierCodeAsync(repository, poSupplierId, invoice.SupplierId, invoice.SilaSupplierId, cancellationToken);
            string? blocked = await SilaInvoicePosting.LatestBlockAsync(repository, invoice.Id, cancellationToken);
            string? erpMessage = invoice.Status == Common.SILA_INVOICE_GET_PO_FAILED
                ? blocked ?? posting?.ErrorMessage
                : posting?.ErrorMessage ?? blocked;
            if (grnConfirmed && SilaInvoiceGrnGate.IsGoodsReceiptNotPostedMessage(erpMessage))
            {
                erpMessage = null;
            }

            if (erpMessage != null
                && invoice.Status is Common.SILA_INVOICE_READY or Common.SILA_INVOICE_READY_TO_POST
                && erpMessage.Contains("GET PO", StringComparison.OrdinalIgnoreCase))
            {
                erpMessage = null;
            }
            string paymentIntegration = await SilaInvoicePosting.PaymentIntegrationAsync(repository, invoice.BuyerId, cancellationToken);
            bool supplierMatched = invoice.SilaSupplierId != null || invoice.SupplierId != null || !string.IsNullOrWhiteSpace(invoice.SupplierName);
            InventoryErpPosting? attachment = await repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == invoice.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_INVOICE_ATTACHMENT && x.ReferenceId == invoice.Id)
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
            string attachmentFile = SilaInvoiceAttachment.FileNameOf(invoice.FileName, invoice.InvoiceNumber);
            string? attachmentUrl = SilaInvoiceAttachment.DocumentUrl(
                SilaOcrPolicy.AttachmentStorage(settings),
                settings.SharePointSiteUrl,
                settings.SharePointLibrary,
                settings.SharePointFolder,
                settings.AttachmentPath,
                "https://sila-api.chervicaon.com",
                invoice.Id,
                attachmentFile);
            SilaInvoiceAttachmentDto attachmentScreen = SilaInvoiceAttachment.Describe(posting, attachment, invoice, attachmentUrl);

            return new SilaInvoiceDetailDto
            {
                Id = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                SupplierId = invoice.SupplierId,
                SupplierName = invoice.SupplierName,
                InvoiceDate = invoice.InvoiceDate,
                Currency = invoice.Currency,
                GrossAmount = invoice.GrossAmount,
                PurchaseOrderId = invoice.PurchaseOrderId,
                PoNumber = invoice.PoNumber,
                PurchaseOrders = detailOrders
                    .OrderBy(x => x.Id == invoice.PurchaseOrderId ? 0 : 1)
                    .ThenBy(x => x.PoNumber)
                    .Select(x => new SilaInvoicePurchaseOrderDto { Id = x.Id, PoNumber = x.PoNumber })
                    .ToList(),
                FileName = invoice.FileName,
                Status = invoice.Status,

                // A failed OCR keeps its reason in OcrText.
                OcrText = failed ? null : invoice.OcrText,
                OcrMessage = failed ? invoice.OcrText : null,
                OcrConfidence = invoice.OcrConfidence,
                UploadedBy = invoice.UploadedBy,
                UploadedOn = invoice.DateCreated,
                Items = items.Select(item => new SilaInvoiceItemDto
                {
                    Id = item.Id,
                    LineNumber = item.LineNumber,
                    Description = item.Description,
                    Quantity = item.Quantity,
                    UnitPrice = item.UnitPrice,
                    Amount = item.Amount,
                    PurchaseOrderItemId = item.PurchaseOrderItemId,
                    PurchaseOrderId = item.PurchaseOrderItemId == null ? null : detailPoItems.FirstOrDefault(x => x.Id == item.PurchaseOrderItemId)?.PurchaseOrderId,
                    PoNumber = item.PurchaseOrderItemId == null ? null : detailOrders.FirstOrDefault(x => x.Id == detailPoItems.FirstOrDefault(line => line.Id == item.PurchaseOrderItemId)?.PurchaseOrderId)?.PoNumber,
                    Uom = item.Uom,
                    SupplierMaterialCode = item.SupplierMaterialCode,
                    TaxRate = item.TaxRate,
                    MatchStatus = item.MatchStatus ?? (item.PurchaseOrderItemId == null ? MATCH_UNMATCHED : MATCH_MATCHED),
                    TaxCode = item.TaxCode,
                    GlAccount = item.GlAccount,
                    CostCenter = item.CostCenter,
                    ProfitCenter = item.ProfitCenter,
                    InternalOrder = item.InternalOrder,
                    WbsElement = item.WbsElement,
                    BusinessArea = item.BusinessArea,
                    AssignmentReference = item.AssignmentReference,
                    DebitCreditCode = item.DebitCreditCode,
                    LineText = item.LineText,
                    GoodsReceiptItemId = item.GoodsReceiptItemId
                }).ToList(),
                GoodsReceipts = await ToGrnListAsync(repository, receipts, cancellationToken),
                SilaSupplierId = invoice.SilaSupplierId,
                SupplierCode = supplierCode,
                ErpPostingId = invoice.ErpPostingId,
                ErpStatus = grnConfirmed && SilaInvoiceGrnGate.IsGoodsReceiptNotPostedMessage(posting?.ErrorMessage)
                    ? null
                    : posting?.Status,
                ErpReference = posting?.ErpReference,
                FiscalYear = SilaInvoicePosting.ReadFiscalYear(posting?.ErpResponsePayload),
                ErpMessage = erpMessage,
                Attachment = attachmentScreen,
                NeedsReview = invoice.Status == SilaOcrSettings.INVOICE_REVIEW_REQUIRED,
                InvoiceType = invoice.InvoiceType,
                CreationType = string.IsNullOrWhiteSpace(invoice.CreationType)
                    ? (invoice.PurchaseOrderId == null && !string.IsNullOrWhiteSpace(invoice.CompanyCode) ? Common.SILA_INVOICE_CREATION_NON_PO : Common.SILA_INVOICE_CREATION_PO)
                    : invoice.CreationType,
                CompanyCode = invoice.CompanyCode ?? posting?.CompanyCode,
                PropertyId = invoice.PropertyId,
                NetAmount = invoice.NetAmount,
                TaxAmount = invoice.TaxAmount,
                SupplierTaxNumber = invoice.SupplierTaxNumber,
                GoodsReceiptApplicable = !IsServiceInvoice(invoice),
                GoodsReceiptNote = IsServiceInvoice(invoice) ? SERVICE_GRN_MESSAGE : null,
                ReconciliationWarning = SilaOcrPolicy.FinancialReconciliation(settings)
                    ? SilaOcrPolicy.ReconciliationWarning(invoice.NetAmount, invoice.TaxAmount, invoice.GrossAmount, SilaOcrPolicy.AmountTolerance(settings))
                    : null,
                ContentHash = invoice.ContentHash,
                CanSubmitInvoice = SilaInvoiceLifecycle.CanSubmit(invoice.Status, service, grnConfirmed, postingOpen, SilaInvoiceLifecycle.AlreadyPosted(invoice.Status, posting?.ErpReference)),
                PaymentStatus = invoice.Status is Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_PARTIALLY_PAID or Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_OVERDUE
                    ? invoice.Status
                    : null,
                PaymentIntegration = paymentIntegration,
                OutstandingAmount = invoice.Status is Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_OVERDUE ? invoice.GrossAmount
                    : invoice.Status == Common.SILA_INVOICE_PAID ? 0 : null,
                Documents = documents,
                PostingData = SilaInvoicePostingData.ForScreen(invoice, items),
                Timeline = SilaInvoiceLifecycle.Timeline(
                    invoice.Status,
                    supplierMatched,
                    invoice.PurchaseOrderId != null,
                    !service,
                    receipts.Count > 0,
                    grnConfirmed,
                    posting?.Status,
                    attachment?.Status),
                DocumentTrack = await SilaDocumentTrack.ForInvoiceAsync(repository, invoice.BuyerId, invoice, cancellationToken)
            };
        }

        /// <summary>Soft-deletes the active lines of the invoice, before they are replaced.</summary>
        public static async Task DeactivateInvoiceItemsAsync(IRepositoryWrapper repository, Guid invoiceId, CancellationToken cancellationToken)
        {
            List<InvoiceItem> current = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoiceId && x.IsActive)
                .ToListAsync(cancellationToken);
            foreach (InvoiceItem item in current)
            {
                item.IsActive = false;
                repository.InvoiceItem.Update(item);
            }
        }

        /// <summary>An ERP supplier number. A system id is not a supplier number.</summary>
        public static string? ErpCode(string? code)
        {
            string? text = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
            return text != null && Guid.TryParse(text, out _) ? null : text;
        }

        /// <summary>The ERP supplier number, preferring the purchase order's supplier over a matched row whose code is a system id.</summary>
        public static async Task<string?> ErpSupplierCodeAsync(
            IRepositoryWrapper repository,
            Guid? purchaseOrderSupplierId,
            Guid? invoiceSupplierId,
            Guid? silaSupplierId,
            CancellationToken cancellationToken)
        {
            List<Guid> ids = new[] { purchaseOrderSupplierId, invoiceSupplierId, silaSupplierId }
                .Where(x => x != null && x != Guid.Empty)
                .Select(x => x!.Value)
                .Distinct()
                .ToList();
            if (ids.Count == 0)
            {
                return null;
            }

            List<SilaSupplier> suppliers = await repository.SilaSupplier
                .FindByCondition(x => ids.Contains(x.Id))
                .ToListAsync(cancellationToken);
            foreach (Guid? id in new[] { purchaseOrderSupplierId, invoiceSupplierId, silaSupplierId })
            {
                if (id == null)
                {
                    continue;
                }

                string? code = ErpCode(suppliers.FirstOrDefault(x => x.Id == id)?.SupplierCode);
                if (code != null)
                {
                    return code;
                }
            }

            return null;
        }
    }
}
