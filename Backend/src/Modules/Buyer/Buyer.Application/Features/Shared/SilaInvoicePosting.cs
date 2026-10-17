using System.Globalization;
using System.Text.Json;
using Buyer.Application.Features.Commands.PostPendingErpPostings;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Continues one invoice after its goods receipt: the GRN PDF, the submit gate, the S/4 purchase order read,
    /// and the field sources for FIVE S4-INVOICE POSTING. Supplier invoice values stay on the invoice.
    /// </summary>
    public static class SilaInvoicePosting
    {
        public const string ACTION_PO = "S4_PO";
        public const string ACTION_BLOCKED = "INVOICE_BLOCKED";
        public const string ACTION_SAP = "SAP_INVOICE";

        private static readonly string[] InvoiceReferenceNames =
        {
            "SupplierInvoice", "supplierInvoice", "SupplierInvoiceID", "supplierInvoiceId", "SupplierInvoiceNumber"
        };

        private static readonly string[] FiscalYearNames = { "FiscalYear", "fiscalYear", "Fiscalyear" };
        private static readonly string[] AccountingDocumentNames = { "AccountingDocument", "accountingDocument", "AccountingDocumentNumber" };

        public sealed class Document
        {
            public string? CompanyCode { get; set; }
            public List<(string Name, object? Value)> Header { get; } = new();
            public List<List<(string Name, object? Value)>> Items { get; } = new();
        }

        /// <summary>The goods-receipt posting reached a final ERP state. Confirmed success stores the PDF and opens invoice submission.</summary>
        public static async Task OnFinishedAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            string? basePath,
            InventoryErpPosting posting,
            string status,
            CancellationToken cancellationToken)
        {
            if (posting.ReferenceType == Common.SILA_REF_GRN)
            {
                await OnGrnAsync(repository, logger, basePath, posting, status, cancellationToken);
            }
            else if (posting.ReferenceType == Common.SILA_REF_INVOICE)
            {
                await OnInvoiceAsync(repository, posting, status, cancellationToken);
            }
        }

        public static async Task<string?> RefreshPurchaseOrderAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor,
            Guid organizationId,
            Invoice invoice,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (invoice.PurchaseOrderId == null)
            {
                return "Matched purchase order, from the SILA invoice";
            }

            PurchaseOrder? order = await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId && x.BuyerId == invoice.BuyerId);
            if (order == null || string.IsNullOrWhiteSpace(order.PoNumber))
            {
                return "Matched purchase order, from the SILA invoice";
            }

            if (string.IsNullOrWhiteSpace(order.CompanyCode))
            {
                return "Company code, from the purchase order";
            }

            if (order.OrderDate == default)
            {
                return "Purchase order date, from the purchase order";
            }

            string company = order.CompanyCode.Trim();
            List<ApiIntegrationConfiguration> configurations = await SilaErpPull.ActiveConfigurationsAsync(
                repository, organizationId, IntegrationProcessType.GET_PO, cancellationToken);
            ApiIntegrationConfiguration? configuration = configurations.FirstOrDefault(x =>
                x.Name.Equals(SilaInvoiceLifecycle.API_GET_PO, StringComparison.OrdinalIgnoreCase)
                && (x.EntityCode.Equals(company, StringComparison.OrdinalIgnoreCase)
                    || x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)));
            if (configuration == null)
            {
                return SilaInvoiceLifecycle.API_GET_PO + " is not configured for company code " + company;
            }

            List<ApiFieldMapping> mappings = await repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == configuration.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            if (mappings.Count == 0)
            {
                return "Purchase order field mappings are missing on " + configuration.Name;
            }

            string companyFilter = company.Replace("'", "''", StringComparison.Ordinal);
            string day = order.OrderDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
            string filter = $"CompanyCode eq '{companyFilter}' and PurchaseOrderDate ge datetime'{day}T00:00:00' and PurchaseOrderDate le datetime'{day}T23:59:59'";
            List<JsonElement> records;
            try
            {
                records = await SilaErpPull.ReadAsync(executor, logger, configuration, "purchase order", filter, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError($"GET PO for invoice posting failed. InvoiceId: {invoice.Id}, Error: {SilaLogText.Short(exception.Message)}");
                return SilaInvoiceLifecycle.API_GET_PO + " could not be read. " + exception.Message;
            }

            int rowNumber = 0;
            List<SilaPoImportRowDto> rows = new List<SilaPoImportRowDto>();
            foreach (JsonElement record in records)
            {
                rows.AddRange(SilaPurchaseOrderRows.FromRecord(mappings, record, company, ref rowNumber));
            }

            List<SilaPoImportRowDto> matched = rows
                .Where(x => string.Equals(x.PoNumber?.Trim(), order.PoNumber.Trim(), StringComparison.OrdinalIgnoreCase))
                .ToList();
            if (matched.Count == 0)
            {
                return "Purchase order " + order.PoNumber + " was not returned by " + SilaInvoiceLifecycle.API_GET_PO;
            }

            SilaPoImportRowDto header = matched[0];
            string? taxCode = null;
            foreach (JsonElement record in records)
            {
                string? number = IntegrationRecordReader.Read(mappings, "Po.Number", record);
                if (!string.Equals(number?.Trim(), order.PoNumber.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                taxCode = IntegrationRecordReader.Read(mappings, "Po.TaxCode", record);
                break;
            }

            if (!string.IsNullOrWhiteSpace(header.CompanyCode))
            {
                order.CompanyCode = header.CompanyCode.Trim();
            }

            if (!string.IsNullOrWhiteSpace(header.Plant))
            {
                order.PlantCode = header.Plant.Trim();
            }

            repository.PurchaseOrder.Update(order);
            string snapshot = JsonSerializer.Serialize(new Snapshot
            {
                CompanyCode = order.CompanyCode,
                Plant = order.PlantCode,
                SupplierCode = header.SupplierCode,
                TaxCode = taxCode,
                Lines = matched.Take(40).Select(x => new SnapshotLine { Line = x.LineNumber, Material = x.MaterialCode, Uom = x.Uom }).ToList()
            });
            if (snapshot.Length > 1000)
            {
                snapshot = snapshot[..1000];
            }

            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = invoice.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = invoice.Id,
                Action = ACTION_PO,
                Comment = snapshot,
                ActorUserId = userId,
                IsActive = true
            });
            return null;
        }

        /// <summary>Reads the S/4 purchase order, maps the invoice, then posts through the existing invoice API. Approval has already finished.</summary>
        public static async Task ContinueAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IMediator mediator,
            IIntegrationHttpExecutor executor,
            BuyerBusinessProfile buyer,
            Invoice invoice,
            Guid userId,
            CancellationToken cancellationToken)
        {
            string? readError = await RefreshPurchaseOrderAsync(repository, logger, executor, buyer.OrganizationId, invoice, userId, cancellationToken);
            if (readError != null)
            {
                invoice.Status = Common.SILA_INVOICE_GET_PO_FAILED;
                Block(repository, invoice, userId, readError);
                repository.Invoice.Update(invoice);
                await repository.SaveAsync();
                throw new BadRequestCustomException("Purchase order could not be read.", readError);
            }

            await repository.SaveAsync();
            PurchaseOrder? order = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId);
            Document? described = await DescribeAsync(repository, invoice.BuyerId, invoice.Id, order?.CompanyCode, cancellationToken);
            ApiIntegrationConfiguration? api = await FindInvoiceApiAsync(repository, buyer.OrganizationId, order?.CompanyCode, cancellationToken);
            List<string> missing = api == null
                ? new List<string>()
                : SilaInvoiceLifecycle.MissingContract(api.RequestBody, described == null ? new Dictionary<string, string?>() : TextOf(described.Header));
            if (described == null || missing.Count > 0)
            {
                string message = described == null
                    ? SilaInvoiceLifecycle.MISSING + ". Invoice lines, from the SILA invoice"
                    : SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missing);
                invoice.Status = Common.SILA_INVOICE_READY_TO_POST;
                Block(repository, invoice, userId, message);
                repository.Invoice.Update(invoice);
                await repository.SaveAsync();
                throw new BadRequestCustomException("Invoice cannot be posted.", message);
            }

            InventoryErpPosting? posting = invoice.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == invoice.BuyerId);
            if (posting != null && (posting.Status == Common.SILA_POSTING_UNKNOWN || SilaTrackerRules.ErpAlreadyAccepted(posting) || posting.Status == Common.SILA_POSTING_POSTED))
            {
                throw new BadRequestCustomException(
                    posting.Status == Common.SILA_POSTING_UNKNOWN ? "Reconcile this invoice." : "Invoice is already posted.",
                    posting.Status == Common.SILA_POSTING_UNKNOWN
                        ? "SAP did not confirm whether the invoice was created. Reconcile it. SAP will not be called again until that is settled."
                        : "This invoice already has a SAP reference.");
            }

            GoodsReceipt? receipt = await repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == invoice.BuyerId && x.IsActive)
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
            if (posting == null)
            {
                InventoryLedger ledger = new InventoryLedger(repository, invoice.BuyerId, userId);
                posting = ledger.QueueErpPosting(Common.SILA_REF_INVOICE, invoice.Id, invoice.InvoiceNumber ?? invoice.FileName, receipt?.LocationId, Common.SILA_MOVEMENT_INVOICE);
                invoice.ErpPostingId = posting.Id;
            }
            else if (posting.Status is Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED)
            {
                string? previous = posting.ErrorMessage;
                posting.Status = Common.SILA_POSTING_PENDING;
                posting.ErrorMessage = null;
                SilaPostingRecovery.Record(repository, posting, userId, SilaTrackerRules.FROM_ERP, previous, true, false, "ERP processing queued again. Receive is not repeated.");
            }

            posting.CompanyCode = described.CompanyCode ?? order?.CompanyCode;
            posting.IntegrationSystem = SilaInvoiceLifecycle.API_INVOICE;
            invoice.Status = Common.SILA_INVOICE_POSTING;
            repository.Invoice.Update(invoice);
            await repository.SaveAsync();
            await mediator.Send(new PostPendingErpPostingsCommand { BuyerId = invoice.BuyerId, PostingId = posting.Id }, cancellationToken);
        }

        public static async Task<ApiIntegrationConfiguration?> FindInvoiceApiAsync(
            IRepositoryWrapper repository, Guid organizationId, string? companyCode, CancellationToken cancellationToken)
        {
            List<ApiIntegrationConfiguration> configurations = await SilaErpPull.ActiveConfigurationsAsync(
                repository, organizationId, IntegrationProcessType.POST_INVOICE, cancellationToken);
            bool named(ApiIntegrationConfiguration configuration) => configuration.Name.Equals(SilaInvoiceLifecycle.API_INVOICE, StringComparison.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(companyCode))
            {
                return configurations.FirstOrDefault(x => named(x) && x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase));
            }

            return configurations.FirstOrDefault(x => named(x)
                && (x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase)
                    || x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)));
        }

        public static async Task<Document?> DescribeAsync(
            IRepositoryWrapper repository, Guid buyerId, Guid invoiceId, string? companyCode, CancellationToken cancellationToken)
        {
            Invoice? invoice = await repository.Invoice
                .FindByCondition(x => x.Id == invoiceId && x.BuyerId == buyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (invoice == null)
            {
                return null;
            }

            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            if (items.Count == 0)
            {
                return null;
            }

            List<Guid> poItemIds = items.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).ToList();
            Dictionary<Guid, PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new Dictionary<Guid, PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => poItemIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            PurchaseOrder? order = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId);
            string? supplierCode = invoice.SilaSupplierId == null
                ? null
                : await repository.SilaSupplier.FindByCondition(x => x.Id == invoice.SilaSupplierId.Value).Select(x => x.SupplierCode).FirstOrDefaultAsync(cancellationToken);
            List<GoodsReceipt> receipts = await repository.GoodsReceipt
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.BuyerId == buyerId && x.IsActive)
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            List<Guid> grnPostingIds = receipts.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            List<string> sapReferences = grnPostingIds.Count == 0
                ? new List<string>()
                : await repository.InventoryErpPosting
                    .FindByCondition(x => grnPostingIds.Contains(x.Id) && x.ErpReference != null && x.ErpReference != string.Empty)
                    .Select(x => x.ErpReference!)
                    .ToListAsync(cancellationToken);
            Snapshot? snapshot = await LatestSnapshotAsync(repository, invoice, cancellationToken);
            string? company = First(snapshot?.CompanyCode, companyCode, order?.CompanyCode);
            string? plant = First(snapshot?.Plant, order?.PlantCode);
            string? supplier = First(snapshot?.SupplierCode, supplierCode);

            Document document = new Document { CompanyCode = company };
            Add(document, "InvoiceNumber", invoice.InvoiceNumber);
            Add(document, "SupplierInvoiceID", invoice.InvoiceNumber);
            Add(document, "InvoiceDate", invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Add(document, "DocumentDate", invoice.InvoiceDate?.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture));
            Add(document, "SupplierCode", supplier);
            Add(document, "SupplierName", invoice.SupplierName);
            Add(document, "PoNumber", invoice.PoNumber ?? order?.PoNumber);
            Add(document, "PurchaseOrder", invoice.PoNumber ?? order?.PoNumber);
            Add(document, "GrnNumber", receipts.Count == 0 ? null : string.Join(",", receipts.Select(x => x.GrnNumber)));
            Add(document, "GrnSapReference", sapReferences.Count == 0 ? null : string.Join(",", sapReferences.Distinct()));
            Add(document, "CompanyCode", company);
            Add(document, "Plant", plant);
            Add(document, "Currency", invoice.Currency);
            Add(document, "GrossAmount", invoice.GrossAmount);
            Add(document, "NetAmount", invoice.NetAmount);
            Add(document, "TaxAmount", invoice.TaxAmount);
            Add(document, "TaxCode", snapshot?.TaxCode);
            foreach (InvoiceItem item in items)
            {
                PurchaseOrderItem? poItem = item.PurchaseOrderItemId != null ? poItems.GetValueOrDefault(item.PurchaseOrderItemId.Value) : null;
                SnapshotLine? line = MatchLine(snapshot, poItem);
                string? lineNumber = line?.Line ?? poItem?.LineNumber.ToString(CultureInfo.InvariantCulture);
                document.Items.Add(new List<(string, object?)>
                {
                    ("LineNumber", item.LineNumber),
                    ("PoLineNumber", lineNumber),
                    ("PurchaseOrderItem", FormatItem(lineNumber)),
                    ("MaterialCode", line?.Material ?? poItem?.MaterialCode),
                    ("Description", item.Description),
                    ("Quantity", item.Quantity),
                    ("Uom", item.Uom ?? line?.Uom ?? poItem?.UnitOfMeasure),
                    ("UnitPrice", item.UnitPrice),
                    ("Amount", item.Amount),
                    ("PurchaseOrder", invoice.PoNumber ?? order?.PoNumber)
                });
            }

            return document;
        }

        public static Dictionary<string, string?> TextOf(IEnumerable<(string Name, object? Value)> header)
        {
            Dictionary<string, string?> values = new Dictionary<string, string?>(StringComparer.OrdinalIgnoreCase);
            foreach ((string name, object? value) in header)
            {
                values[Camel(name)] = Text(value);
            }

            return values;
        }

        public static async Task<string?> DuplicateMessageAsync(IRepositoryWrapper repository, Invoice invoice, string? companyCode, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(invoice.InvoiceNumber))
            {
                return null;
            }

            string number = invoice.InvoiceNumber.Trim();
            List<Invoice> others = await repository.Invoice
                .FindByCondition(x => x.BuyerId == invoice.BuyerId && x.Id != invoice.Id && x.IsActive && x.InvoiceNumber == number)
                .ToListAsync(cancellationToken);
            if (others.Count == 0)
            {
                return null;
            }

            List<Guid> postingIds = others.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            List<Guid> orderIds = others.Where(x => x.PurchaseOrderId != null).Select(x => x.PurchaseOrderId!.Value).ToList();
            Dictionary<Guid, string?> companies = orderIds.Count == 0
                ? new Dictionary<Guid, string?>()
                : await repository.PurchaseOrder.FindByCondition(x => orderIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, x => x.CompanyCode, cancellationToken);
            foreach (Invoice other in others)
            {
                bool sameSupplier = (invoice.SilaSupplierId != null && other.SilaSupplierId == invoice.SilaSupplierId)
                    || (invoice.SupplierId != null && other.SupplierId == invoice.SupplierId)
                    || (!string.IsNullOrWhiteSpace(invoice.SupplierName) && string.Equals(other.SupplierName, invoice.SupplierName, StringComparison.OrdinalIgnoreCase));
                if (!sameSupplier)
                {
                    continue;
                }

                string? otherCompany = other.PurchaseOrderId != null && companies.TryGetValue(other.PurchaseOrderId.Value, out string? found) ? found : null;
                if (!string.IsNullOrWhiteSpace(companyCode) && !string.IsNullOrWhiteSpace(otherCompany)
                    && !string.Equals(companyCode.Trim(), otherCompany.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                InventoryErpPosting? posting = other.ErpPostingId != null && postings.TryGetValue(other.ErpPostingId.Value, out InventoryErpPosting? row) ? row : null;
                if (SilaInvoiceLifecycle.AlreadyPosted(other.Status, posting?.ErpReference))
                {
                    return "Supplier invoice " + number + " is already posted"
                        + (string.IsNullOrWhiteSpace(posting?.ErpReference) ? "." : " (SAP " + posting.ErpReference + ").");
                }
            }

            return null;
        }

        public static async Task<bool> ApprovalConfiguredAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            return await repository.MasterApprovalFlow
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Type != null && x.Type.ToUpper() == Common.SILA_APPROVAL_TYPE_INVOICE)
                .AnyAsync(cancellationToken);
        }

        public static async Task<bool> ApprovalCompleteAsync(IRepositoryWrapper repository, Guid invoiceId, CancellationToken cancellationToken)
        {
            List<SilaApprovalStep> steps = await repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoiceId && x.IsActive)
                .ToListAsync(cancellationToken);
            if (steps.Count == 0 || steps.Any(x => x.Status == Common.SILA_APPROVAL_PENDING))
            {
                return false;
            }

            int version = steps.Max(x => x.Version);
            return steps.Where(x => x.Version == version).All(x => x.Status == Common.SILA_APPROVAL_APPROVED);
        }

        public static string? ReadSupplierInvoice(string? body)
        {
            return ReadNamed(body, InvoiceReferenceNames);
        }

        public static void RememberResponse(IRepositoryWrapper repository, InventoryErpPosting posting, Guid userId)
        {
            if (posting.ReferenceType != Common.SILA_REF_INVOICE)
            {
                return;
            }

            string? fiscalYear = ReadNamed(posting.ErpResponsePayload, FiscalYearNames);
            string? accounting = ReadNamed(posting.ErpResponsePayload, AccountingDocumentNames);
            if (string.IsNullOrWhiteSpace(posting.ErpReference) && string.IsNullOrWhiteSpace(fiscalYear) && string.IsNullOrWhiteSpace(accounting))
            {
                return;
            }

            string comment = "SAP invoice " + (posting.ErpReference ?? string.Empty)
                + (string.IsNullOrWhiteSpace(fiscalYear) ? string.Empty : "; FiscalYear " + fiscalYear)
                + (string.IsNullOrWhiteSpace(accounting) ? string.Empty : "; AccountingDocument " + accounting);
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = posting.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = posting.ReferenceId,
                Action = ACTION_SAP,
                Comment = comment.Length > 1000 ? comment[..1000] : comment,
                ActorUserId = userId,
                IsActive = true
            });
        }

        public static void Block(IRepositoryWrapper repository, Invoice invoice, Guid userId, string message)
        {
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = invoice.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = invoice.Id,
                Action = ACTION_BLOCKED,
                Comment = message.Length > 1000 ? message[..1000] : message,
                ActorUserId = userId,
                IsActive = true
            });
        }

        public static async Task<string?> LatestBlockAsync(IRepositoryWrapper repository, Guid invoiceId, CancellationToken cancellationToken)
        {
            return await repository.InventoryWorkflowEvent
                .FindByCondition(x => x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoiceId && x.IsActive && x.Action == ACTION_BLOCKED)
                .OrderByDescending(x => x.DateCreated)
                .Select(x => x.Comment)
                .FirstOrDefaultAsync(cancellationToken);
        }

        public static async Task<string?> PaymentIntegrationAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            List<string> names = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == IntegrationConfigurationStatus.ACTIVE && x.Name != null)
                .Select(x => x.Name)
                .ToListAsync(cancellationToken);
            string? name = names.FirstOrDefault(x => x.Contains("payment", StringComparison.OrdinalIgnoreCase));
            return string.IsNullOrWhiteSpace(name) ? Common.SILA_PAYMENT_NOT_CONFIGURED : name;
        }

        private static async Task OnGrnAsync(
            IRepositoryWrapper repository, ILoggerManager logger, string? basePath, InventoryErpPosting posting, string status, CancellationToken cancellationToken)
        {
            GoodsReceipt? receipt = await repository.GoodsReceipt.FindFirstByConditionAsync(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId);
            if (receipt?.InvoiceId == null)
            {
                return;
            }

            Invoice? invoice = await repository.Invoice.FindFirstByConditionAsync(x => x.Id == receipt.InvoiceId && x.BuyerId == posting.BuyerId && x.IsActive);
            if (invoice == null)
            {
                return;
            }

            bool confirmed = status is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED or Common.SILA_POSTING_FAILED_LOCAL
                || !string.IsNullOrWhiteSpace(posting.ErpReference);
            if (!confirmed)
            {
                if (OpenForGrn(invoice.Status) && status is Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED or Common.SILA_POSTING_UNKNOWN)
                {
                    invoice.Status = Common.SILA_INVOICE_GRN_FAILED;
                    repository.Invoice.Update(invoice);
                }

                return;
            }

            try
            {
                await SilaGrnDocument.StoreAsync(repository, logger, basePath, receipt, invoice, posting.ErpReference, cancellationToken);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError($"GRN PDF was not stored. GoodsReceiptId: {receipt.Id}, Error: {SilaLogText.Short(exception.Message)}");
            }

            if (!OpenForGrn(invoice.Status))
            {
                return;
            }

            invoice.Status = Common.SILA_INVOICE_READY;
            repository.Invoice.Update(invoice);
        }

        private static async Task OnInvoiceAsync(IRepositoryWrapper repository, InventoryErpPosting posting, string status, CancellationToken cancellationToken)
        {
            Invoice? invoice = await repository.Invoice.FindFirstByConditionAsync(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId && x.IsActive);
            if (invoice == null)
            {
                return;
            }

            string next = status switch
            {
                Common.SILA_POSTING_POSTED => PaymentOrCurrent(invoice.Status),
                Common.SILA_POSTING_FAILED_LOCAL => Common.SILA_INVOICE_LOCAL_FAILED,
                Common.SILA_POSTING_UNKNOWN => Common.SILA_INVOICE_POSTING_UNKNOWN,
                Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED => Common.SILA_INVOICE_POSTING_FAILED,
                Common.SILA_POSTING_PENDING => Common.SILA_INVOICE_POSTING,
                _ => invoice.Status
            };
            if (ProtectsPayment(invoice.Status) && status != Common.SILA_POSTING_POSTED)
            {
                return;
            }

            if (next == invoice.Status)
            {
                return;
            }

            invoice.Status = next;
            invoice.ErpPostingId ??= posting.Id;
            repository.Invoice.Update(invoice);
            await Task.CompletedTask;
        }

        private static string PaymentOrCurrent(string status)
        {
            return status is Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_PARTIALLY_PAID or Common.SILA_INVOICE_OVERDUE
                ? status
                : Common.SILA_INVOICE_AWAITING_PAYMENT;
        }

        private static bool ProtectsPayment(string status)
        {
            return status is Common.SILA_INVOICE_AWAITING_PAYMENT or Common.SILA_INVOICE_PARTIALLY_PAID
                or Common.SILA_INVOICE_PAID or Common.SILA_INVOICE_OVERDUE;
        }

        private static bool OpenForGrn(string status)
        {
            return status is Common.SILA_INVOICE_UPLOADED or Common.SILA_INVOICE_EXTRACTED or Common.SILA_INVOICE_OCR_FAILED
                or Common.SILA_INVOICE_REVIEWED or Common.SILA_INVOICE_GRN_POSTED or Common.SILA_INVOICE_GRN_IN_PROGRESS
                or Common.SILA_INVOICE_GRN_FAILED or "REVIEW_REQUIRED";
        }

        private static void Add(Document document, string name, object? value)
        {
            document.Header.Add((name, value));
        }

        private static string? First(params string?[] values)
        {
            return values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();
        }

        private static string? FormatItem(string? lineNumber)
        {
            if (string.IsNullOrWhiteSpace(lineNumber))
            {
                return null;
            }

            return int.TryParse(lineNumber.Trim(), NumberStyles.Integer, CultureInfo.InvariantCulture, out int number)
                ? number.ToString("00000", CultureInfo.InvariantCulture)
                : lineNumber.Trim();
        }

        private static SnapshotLine? MatchLine(Snapshot? snapshot, PurchaseOrderItem? poItem)
        {
            if (snapshot == null || poItem == null)
            {
                return null;
            }

            string line = poItem.LineNumber.ToString(CultureInfo.InvariantCulture);
            return snapshot.Lines.FirstOrDefault(x => string.Equals(x.Line, line, StringComparison.OrdinalIgnoreCase))
                ?? snapshot.Lines.FirstOrDefault(x => !string.IsNullOrWhiteSpace(poItem.MaterialCode)
                    && string.Equals(x.Material, poItem.MaterialCode, StringComparison.OrdinalIgnoreCase));
        }

        private static async Task<Snapshot?> LatestSnapshotAsync(IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            string? comment = await repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == invoice.BuyerId && x.IsActive && x.Action == ACTION_PO
                    && x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoice.Id)
                .OrderByDescending(x => x.DateCreated)
                .Select(x => x.Comment)
                .FirstOrDefaultAsync(cancellationToken);
            if (string.IsNullOrWhiteSpace(comment))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<Snapshot>(comment, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static string Camel(string name)
        {
            return char.ToLowerInvariant(name[0]) + name[1..];
        }

        private static string? Text(object? value)
        {
            return value switch
            {
                null => null,
                string text when string.IsNullOrWhiteSpace(text) => null,
                string text => text.Trim(),
                decimal number => number.ToString(CultureInfo.InvariantCulture),
                _ => value.ToString()
            };
        }

        private static string? ReadNamed(string? body, IReadOnlyList<string> names)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                using JsonDocument json = JsonDocument.Parse(body);
                JsonElement root = json.RootElement;
                if (root.ValueKind == JsonValueKind.Object && root.TryGetProperty("d", out JsonElement wrapped) && wrapped.ValueKind == JsonValueKind.Object)
                {
                    root = wrapped;
                }

                if (root.ValueKind != JsonValueKind.Object)
                {
                    return null;
                }

                foreach (string name in names)
                {
                    if (root.TryGetProperty(name, out JsonElement value) && value.ValueKind is JsonValueKind.String or JsonValueKind.Number)
                    {
                        string text = value.ToString();
                        if (!string.IsNullOrWhiteSpace(text))
                        {
                            return text;
                        }
                    }
                }
            }
            catch (JsonException)
            {
                return null;
            }

            return null;
        }

        private sealed class Snapshot
        {
            public string? CompanyCode { get; set; }
            public string? Plant { get; set; }
            public string? SupplierCode { get; set; }
            public string? TaxCode { get; set; }
            public List<SnapshotLine> Lines { get; set; } = new();
        }

        private sealed class SnapshotLine
        {
            public string? Line { get; set; }
            public string? Material { get; set; }
            public string? Uom { get; set; }
        }
    }
}
