using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
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
            /// <summary>PO uses to_SuplrInvcItemPurOrdRef. NON_PO uses to_SupplierInvoiceItemGLAcct.</summary>
            public string Mode { get; set; } = Common.SILA_INVOICE_CREATION_PO;
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

            PurchaseOrder? primaryOrder = await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId && x.BuyerId == invoice.BuyerId);
            if (primaryOrder == null || string.IsNullOrWhiteSpace(primaryOrder.PoNumber))
            {
                return "Matched purchase order, from the SILA invoice";
            }

            List<Guid> lineItemIds = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && x.PurchaseOrderItemId != null)
                .Select(x => x.PurchaseOrderItemId!.Value)
                .ToListAsync(cancellationToken);
            List<Guid> extraPoIds = lineItemIds.Count == 0
                ? new List<Guid>()
                : await repository.PurchaseOrderItem
                    .FindByCondition(x => lineItemIds.Contains(x.Id) && x.PurchaseOrderId != primaryOrder.Id)
                    .Select(x => x.PurchaseOrderId)
                    .Distinct()
                    .ToListAsync(cancellationToken);
            List<PurchaseOrder> orders = new List<PurchaseOrder> { primaryOrder };
            if (extraPoIds.Count > 0)
            {
                orders.AddRange(await repository.PurchaseOrder
                    .FindByCondition(x => extraPoIds.Contains(x.Id) && x.BuyerId == invoice.BuyerId && !string.IsNullOrWhiteSpace(x.PoNumber))
                    .ToListAsync(cancellationToken));
            }

            Dictionary<Guid, SilaPurchaseOrderInvoiceRead.Order> sapByPo = new Dictionary<Guid, SilaPurchaseOrderInvoiceRead.Order>();
            Dictionary<Guid, string> numbers = new Dictionary<Guid, string>();
            SilaPurchaseOrderInvoiceRead.Order? primarySap = null;
            foreach (PurchaseOrder current in orders)
            {
                (SilaPurchaseOrderInvoiceRead.Order? sap, string? error) = await ReadOnePurchaseOrderAsync(
                    repository, logger, executor, organizationId, invoice, userId, current, cancellationToken);
                if (error != null || sap == null)
                {
                    return orders.Count == 1 ? error : current.PoNumber + ": " + error;
                }

                sapByPo[current.Id] = sap;
                numbers[current.Id] = current.PoNumber.Trim();
                if (current.Id == primaryOrder.Id)
                {
                    primarySap = sap;
                }
            }

            await SilaInvoicePostingData.StoreAsync(repository, invoice, primarySap!, userId, cancellationToken, sapByPo, numbers);
            return null;
        }

        private static async Task<(SilaPurchaseOrderInvoiceRead.Order? Sap, string? Error)> ReadOnePurchaseOrderAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor,
            Guid organizationId,
            Invoice invoice,
            Guid userId,
            PurchaseOrder order,
            CancellationToken cancellationToken)
        {
            string company = order.CompanyCode?.Trim() ?? string.Empty;
            List<ApiIntegrationConfiguration> configurations = await SilaErpPull.ActiveConfigurationsAsync(
                repository, organizationId, IntegrationProcessType.GET_PO, cancellationToken);
            ApiIntegrationConfiguration? configuration = configurations.FirstOrDefault(x =>
                x.Name.Equals(SilaInvoiceLifecycle.API_GET_PO, StringComparison.OrdinalIgnoreCase)
                && (string.IsNullOrEmpty(company)
                    || x.EntityCode.Equals(company, StringComparison.OrdinalIgnoreCase)
                    || x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)));
            if (configuration == null)
            {
                return (null, SilaInvoiceLifecycle.API_GET_PO + (string.IsNullOrEmpty(company) ? " is not configured." : " is not configured for company code " + company));
            }

            List<ApiFieldMapping> mappings = await repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == configuration.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            if (mappings.Count == 0)
            {
                return (null, "Purchase order field mappings are missing on " + configuration.Name);
            }

            string filter = SilaPurchaseOrderInvoiceRead.Filter(order.PoNumber);
            List<JsonElement> records;
            try
            {
                records = await SilaErpPull.ReadAsync(
                    executor, logger, configuration, "purchase order", filter, SilaPurchaseOrderInvoiceRead.WithItemExpand, cancellationToken, true);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError($"GET PO for invoice posting failed. InvoiceId: {invoice.Id}, Error: {SilaLogText.Short(exception.Message)}");
                return (null, SilaInvoiceLifecycle.API_GET_PO + " could not be read. " + exception.Message);
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
                return (null, "Purchase order " + order.PoNumber + " was not returned by " + SilaInvoiceLifecycle.API_GET_PO);
            }

            JsonElement? sapRecord = null;
            foreach (JsonElement record in records)
            {
                string? number = IntegrationRecordReader.Read(mappings, "Po.Number", record);
                if (string.IsNullOrWhiteSpace(number) && record.TryGetProperty("PurchaseOrder", out JsonElement purchaseOrder))
                {
                    number = purchaseOrder.GetString();
                }

                if (string.Equals(number?.Trim(), order.PoNumber.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    sapRecord = record;
                    break;
                }
            }

            if (sapRecord == null)
            {
                return (null, "Purchase order " + order.PoNumber + " was not returned by " + SilaInvoiceLifecycle.API_GET_PO);
            }

            SilaPurchaseOrderInvoiceRead.Order sapOrder = SilaPurchaseOrderInvoiceRead.FromRecord(mappings, sapRecord.Value);
            List<Guid> invoiceLineIds = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && x.PurchaseOrderItemId != null)
                .Select(x => x.PurchaseOrderItemId!.Value)
                .ToListAsync(cancellationToken);
            List<PurchaseOrderItem> poItems = invoiceLineIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => invoiceLineIds.Contains(x.Id) && x.PurchaseOrderId == order.Id).ToListAsync(cancellationToken);
            string? missingFields = SilaPurchaseOrderInvoiceRead.MissingMessage(sapOrder, poItems.Select(x => x.LineNumber).ToList());
            if (missingFields != null)
            {
                return (null, missingFields);
            }

            SilaPoImportRowDto header = matched[0];
            if (!string.IsNullOrWhiteSpace(sapOrder.CompanyCode))
            {
                order.CompanyCode = sapOrder.CompanyCode;
            }
            else if (!string.IsNullOrWhiteSpace(header.CompanyCode))
            {
                order.CompanyCode = header.CompanyCode.Trim();
            }

            if (!string.IsNullOrWhiteSpace(sapOrder.Plant))
            {
                order.PlantCode = sapOrder.Plant;
            }
            else if (!string.IsNullOrWhiteSpace(header.Plant))
            {
                order.PlantCode = header.Plant.Trim();
            }

            if (!string.IsNullOrWhiteSpace(sapOrder.Currency))
            {
                order.Currency = sapOrder.Currency;
            }

            foreach (PurchaseOrderItem poItem in poItems)
            {
                SilaPurchaseOrderInvoiceRead.Line? sapLine = sapOrder.Lines.FirstOrDefault(x =>
                    int.TryParse(x.Item, NumberStyles.Integer, CultureInfo.InvariantCulture, out int number) && number == poItem.LineNumber);
                if (sapLine == null)
                {
                    continue;
                }

                if (string.IsNullOrWhiteSpace(poItem.UnitOfMeasure) && !string.IsNullOrWhiteSpace(sapLine.Uom))
                {
                    poItem.UnitOfMeasure = sapLine.Uom;
                }

                if (string.IsNullOrWhiteSpace(poItem.MaterialCode) && !string.IsNullOrWhiteSpace(sapLine.Material))
                {
                    poItem.MaterialCode = sapLine.Material;
                }

                if (!string.IsNullOrWhiteSpace(sapLine.TaxCode))
                {
                    poItem.TaxCode = sapLine.TaxCode.Trim();
                }

                repository.PurchaseOrderItem.Update(poItem);
            }

            repository.PurchaseOrder.Update(order);
            string snapshot = JsonSerializer.Serialize(new Snapshot
            {
                CompanyCode = order.CompanyCode,
                Plant = order.PlantCode,
                SupplierCode = sapOrder.SupplierCode ?? header.SupplierCode,
                Currency = sapOrder.Currency ?? header.Currency,
                TaxCode = sapOrder.Lines.Select(x => x.TaxCode).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x)),
                Lines = sapOrder.Lines.Take(40).Select(x => new SnapshotLine
                {
                    Line = x.Item,
                    Material = x.Material,
                    Uom = x.Uom,
                    TaxCode = x.TaxCode
                }).ToList()
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
            return (sapOrder, null);
        }

        /// <summary>Reads the S/4 purchase order when needed, maps the invoice, then posts through the existing invoice API. Approval has already finished.</summary>
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
            bool nonPo = SilaInvoiceCreation.IsNonPo(invoice.CreationType);
            if (!nonPo)
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
            }

            PurchaseOrder? order = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId);
            SilaInvoicePostingData.Prepared? prepared = SilaInvoicePostingData.Read(invoice.PostingData);
            List<string> missing = SilaInvoicePostingData.Missing(prepared);
            if (missing.Count > 0)
            {
                string message = SilaInvoiceLifecycle.MISSING + ". " + string.Join("; ", missing);
                invoice.Status = Common.SILA_INVOICE_VALIDATION_FAILED;
                Block(repository, invoice, userId, message);
                repository.Invoice.Update(invoice);
                await repository.SaveAsync();
                throw new BadRequestCustomException("Invoice cannot be posted.", message);
            }

            Document described = SilaInvoicePostingData.ToDocument(prepared!);
            invoice.Status = Common.SILA_INVOICE_READY_TO_POST;
            repository.Invoice.Update(invoice);
            await repository.SaveAsync();

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

            posting.CompanyCode = described.CompanyCode ?? invoice.CompanyCode ?? order?.CompanyCode;
            posting.IntegrationSystem = SilaInvoiceLifecycle.API_INVOICE;
            invoice.Status = Common.SILA_INVOICE_POSTING;
            repository.Invoice.Update(invoice);
            await repository.SaveAsync();
            await mediator.Send(new PostPendingErpPostingsCommand { BuyerId = invoice.BuyerId, PostingId = posting.Id }, cancellationToken);
        }

        public static async Task<ApiIntegrationConfiguration?> FindInvoiceApiAsync(
            IRepositoryWrapper repository, Guid organizationId, string? companyCode, CancellationToken cancellationToken)
        {
            // The configured API keeps its own process type (POST_FIVE_S4_INVOICE_POSTING). Match it by name.
            List<ApiIntegrationConfiguration> configurations = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .ToListAsync(cancellationToken);
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
            string? supplierCode = await SupplierCodeAsync(repository, invoice, cancellationToken);
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
            string? supplier = First(SilaReceivingRules.ErpCode(snapshot?.SupplierCode), supplierCode);
            string? currency = First(invoice.Currency, snapshot?.Currency, order?.Currency);

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
            Add(document, "Currency", currency);
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
                    ("PurchaseOrder", invoice.PoNumber ?? order?.PoNumber),
                    ("TaxCode", line?.TaxCode ?? snapshot?.TaxCode)
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

        /// <summary>The same supplier id and the same supplier invoice number cannot be posted twice.</summary>
        public static bool SameSupplier(Invoice left, Invoice right)
        {
            return SupplierIds(left).Overlaps(SupplierIds(right));
        }

        public static async Task<string?> DuplicateMessageAsync(IRepositoryWrapper repository, Invoice invoice, string? companyCode, CancellationToken cancellationToken)
        {
            if (string.IsNullOrWhiteSpace(invoice.InvoiceNumber) || SupplierIds(invoice).Count == 0)
            {
                return null;
            }

            string number = invoice.InvoiceNumber.Trim();
            string? company = string.IsNullOrWhiteSpace(companyCode) ? invoice.CompanyCode?.Trim() : companyCode.Trim();
            List<Invoice> others = await repository.Invoice
                .FindByCondition(x => x.BuyerId == invoice.BuyerId && x.Id != invoice.Id && x.IsActive && x.InvoiceNumber == number)
                .ToListAsync(cancellationToken);
            List<Invoice> sameSupplier = others.Where(other =>
            {
                if (!SameSupplier(invoice, other))
                {
                    return false;
                }

                if (string.IsNullOrWhiteSpace(company))
                {
                    return true;
                }

                string? otherCompany = other.CompanyCode?.Trim();
                return string.IsNullOrWhiteSpace(otherCompany)
                    || string.Equals(otherCompany, company, StringComparison.OrdinalIgnoreCase);
            }).ToList();
            if (sameSupplier.Count == 0)
            {
                return null;
            }

            List<Guid> postingIds = sameSupplier.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            foreach (Invoice other in sameSupplier)
            {
                InventoryErpPosting? posting = other.ErpPostingId != null && postings.TryGetValue(other.ErpPostingId.Value, out InventoryErpPosting? row) ? row : null;
                if (SilaInvoiceLifecycle.AlreadyPosted(other.Status, posting?.ErpReference))
                {
                    return "Supplier invoice " + number + " for this supplier"
                        + (string.IsNullOrWhiteSpace(company) ? "" : " / company " + company)
                        + " is already posted"
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

        /// <summary>Fiscal year persisted on the invoice posting response. The attachment key is not built until this is stored.</summary>
        public static string? ReadFiscalYear(string? body)
        {
            return ReadNamed(body, FiscalYearNames);
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

        /// <summary>
        /// Builds A_SupplierInvoice from the stored posting document. A template with {{placeholders}} is left to
        /// the normal replacement. A literal sample is not copied, and an empty GL navigation is not sent.
        /// TaxDeterminationDate is sent only from the stored header. FIVE requires it; other tenants do not.
        /// </summary>
        public static (string? Body, List<string> Missing) SupplierInvoiceRequest(string? template, Document document, bool timeDependentTaxes = false)
        {
            List<string> missing = new List<string>();
            if (!string.IsNullOrWhiteSpace(template) && template.Contains("{{", StringComparison.Ordinal))
            {
                return (null, missing);
            }

            string? Value(string name)
            {
                (string Name, object? Field) found = document.Header.LastOrDefault(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
                return found.Name == null ? null : Text(found.Field);
            }

            string? date = SapDate(Value("DocumentDate") ?? Value("InvoiceDate"));
            string? postingDate = SapDate(Value("PostingDate")) ?? date;
            string? dueDate = SapDate(Value("DueCalculationBaseDate")) ?? date;
            string? taxDate = SapDate(Value("TaxDeterminationDate"));
            string? supplier = BusinessCode(Value("SupplierCode"));
            string? currency = Value("Currency");
            string? company = Value("CompanyCode");
            string? number = Value("InvoiceNumber");
            string? gross = Money(Value("GrossAmount"));
            string? documentType = Value("AccountingDocumentType");
            string? taxAutomatic = Value("TaxIsCalculatedAutomatically");
            Require(company, SilaInvoiceCreation.IsNonPo(document.Mode) ? "Company code, from Create Invoice" : "Company code, from the purchase order", missing);
            Require(date, "Document date, from the SILA invoice", missing);
            Require(postingDate, "Posting date, from the stored posting data", missing);
            Require(dueDate, "Due calculation base date, from the stored posting data", missing);
            if (timeDependentTaxes)
            {
                Require(taxDate, SilaFiveInvoicePosting.TAX_DATE_MISSING, missing);
            }
            Require(supplier, SilaInvoiceCreation.IsNonPo(document.Mode) ? "Invoicing party, from the supplier master" : "Invoicing party, from the purchase order", missing);
            Require(currency, "Currency, from the SILA invoice", missing);
            Require(gross, "Gross amount, from the SILA invoice", missing);
            Require(number, "Supplier invoice reference, from the SILA invoice", missing);
            Require(documentType, "Accounting document type, from the invoice posting configuration", missing);
            Require(taxAutomatic, "Automatic tax calculation, from the invoice posting configuration", missing);

            bool automatic = taxAutomatic != null && taxAutomatic.Equals("true", StringComparison.OrdinalIgnoreCase);
            bool nonPo = SilaInvoiceCreation.IsNonPo(document.Mode);
            JsonArray results = new JsonArray();
            int sequence = 0;
            HashSet<string> taxCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (List<(string Name, object? Value)> item in document.Items)
            {
                sequence++;
                string? ItemValue(string name)
                {
                    (string Name, object? Field) found = item.LastOrDefault(x => x.Name.Equals(name, StringComparison.OrdinalIgnoreCase));
                    return found.Name == null ? null : Text(found.Field);
                }

                string? amount = Money(ItemValue("Amount"));
                string? tax = ItemValue("TaxCode");
                string? itemCurrency = ItemValue("DocumentCurrency") ?? currency;
                string? itemNumber = ItemValue("SupplierInvoiceItem");
                if (string.IsNullOrWhiteSpace(itemNumber))
                {
                    itemNumber = sequence.ToString("00000", CultureInfo.InvariantCulture);
                }

                if (nonPo)
                {
                    string? gl = ItemValue("GLAccount");
                    Require(gl, "GL account, from the Non-PO invoice line", missing);
                    Require(amount, "Invoice amount, from the SILA invoice lines", missing);
                    if (string.IsNullOrWhiteSpace(tax))
                    {
                        missing.Add("Field: TaxCode. GL Account: " + (gl ?? ""));
                    }
                    else
                    {
                        taxCodes.Add(tax);
                    }

                    JsonObject glItem = new JsonObject
                    {
                        ["SupplierInvoiceItem"] = itemNumber,
                        ["CompanyCode"] = ItemValue("CompanyCode") ?? company,
                        ["GLAccount"] = gl,
                        ["DocumentCurrency"] = itemCurrency,
                        ["SupplierInvoiceItemAmount"] = amount,
                        ["TaxCode"] = tax,
                        ["DebitCreditCode"] = ItemValue("DebitCreditCode") ?? "S"
                    };
                    Put(glItem, "CostCenter", ItemValue("CostCenter"));
                    Put(glItem, "ProfitCenter", ItemValue("ProfitCenter"));
                    Put(glItem, "InternalOrder", ItemValue("InternalOrder"));
                    Put(glItem, "WBSElement", ItemValue("WBSElement"));
                    Put(glItem, "BusinessArea", ItemValue("BusinessArea"));
                    Put(glItem, "AssignmentReference", ItemValue("AssignmentReference"));
                    Put(glItem, "SupplierInvoiceItemText", ItemValue("SupplierInvoiceItemText"));
                    results.Add(glItem);
                    continue;
                }

                string? po = ItemValue("PurchaseOrder") ?? Value("PurchaseOrder");
                string? poItem = ItemValue("PurchaseOrderItem");
                string? quantity = QuantityText(ItemValue("Quantity"));
                string? uom = ItemValue("Uom");
                Require(po, "Purchase order, from the purchase order", missing);
                Require(poItem, "Purchase order item, from the purchase order", missing);
                Require(quantity, "Invoice quantity, from the SILA invoice lines", missing);
                Require(amount, "Invoice amount, from the SILA invoice lines", missing);
                Require(uom, "PO UOM, from the purchase order item", missing);
                if (string.IsNullOrWhiteSpace(tax))
                {
                    missing.Add("Field: TaxCode. PO: " + (po ?? "") + ". PO Item: " + (poItem ?? ""));
                }
                else
                {
                    taxCodes.Add(tax);
                }

                results.Add(new JsonObject
                {
                    ["SupplierInvoiceItem"] = itemNumber,
                    ["PurchaseOrder"] = po,
                    ["PurchaseOrderItem"] = poItem,
                    ["DocumentCurrency"] = itemCurrency,
                    ["SupplierInvoiceItemAmount"] = amount,
                    ["QuantityInPurchaseOrderUnit"] = quantity,
                    ["PurchaseOrderQuantityUnit"] = uom,
                    ["TaxCode"] = tax
                });
            }

            if (document.Items.Count == 0)
            {
                missing.Add("Invoice line, from the supplier invoice. At least one line is required.");
            }

            string? taxAmount = Money(Value("TaxAmount"));
            if (!automatic && !string.IsNullOrWhiteSpace(taxAutomatic))
            {
                Require(taxAmount, "Tax amount, from the SILA invoice", missing);
                if (taxCodes.Count != 1)
                {
                    missing.Add("Tax amount, from the SILA invoice. One tax code is required when tax is supplied explicitly.");
                }
            }

            if (missing.Count > 0)
            {
                return (null, missing.Distinct(StringComparer.OrdinalIgnoreCase).ToList());
            }

            JsonObject body = new JsonObject
            {
                ["CompanyCode"] = company,
                ["DocumentDate"] = date,
                ["PostingDate"] = postingDate,
                ["DueCalculationBaseDate"] = dueDate
            };
            if (!string.IsNullOrWhiteSpace(taxDate))
            {
                body["TaxDeterminationDate"] = taxDate;
            }

            body["InvoicingParty"] = supplier;
            body["DocumentCurrency"] = currency;
            body["InvoiceGrossAmount"] = gross;
            body["AccountingDocumentType"] = documentType;
            body["SupplierInvoiceIDByInvcgParty"] = number;
            body["TaxIsCalculatedAutomatically"] = automatic;
            if (nonPo)
            {
                body["to_SupplierInvoiceItemGLAcct"] = new JsonObject { ["results"] = results };
            }
            else
            {
                body["to_SuplrInvcItemPurOrdRef"] = new JsonObject { ["results"] = results };
            }

            if (!automatic)
            {
                body["to_SupplierInvoiceTax"] = new JsonObject
                {
                    ["results"] = new JsonArray
                    {
                        new JsonObject
                        {
                            ["TaxCode"] = taxCodes.Single(),
                            ["DocumentCurrency"] = currency,
                            ["TaxAmount"] = taxAmount
                        }
                    }
                };
            }

            return (body.ToJsonString(), missing);
        }

        private static void Put(JsonObject target, string name, string? value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                target[name] = value;
            }
        }

        private static string? SapDate(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            string text = value.Trim();
            if (text.Length == 10)
            {
                return text + "T00:00:00";
            }

            if (text.Length == 16 && text[10] == 'T')
            {
                return text + ":00";
            }

            return text;
        }

        private static string? QuantityText(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out decimal amount)
                ? amount.ToString("0.####", CultureInfo.InvariantCulture)
                : value.Trim();
        }

        private static HashSet<Guid> SupplierIds(Invoice invoice)
        {
            HashSet<Guid> ids = new HashSet<Guid>();
            if (invoice.SilaSupplierId != null && invoice.SilaSupplierId != Guid.Empty)
            {
                ids.Add(invoice.SilaSupplierId.Value);
            }

            if (invoice.SupplierId != null && invoice.SupplierId != Guid.Empty)
            {
                ids.Add(invoice.SupplierId.Value);
            }

            return ids;
        }

        private static async Task<string?> SupplierCodeAsync(IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            Guid? purchaseOrderSupplierId = invoice.PurchaseOrderId == null
                ? null
                : await repository.PurchaseOrder
                    .FindByCondition(x => x.Id == invoice.PurchaseOrderId)
                    .Select(x => (Guid?)x.SupplierId)
                    .FirstOrDefaultAsync(cancellationToken);
            return await SilaReceivingRules.ErpSupplierCodeAsync(
                repository, purchaseOrderSupplierId, invoice.SupplierId, invoice.SilaSupplierId, cancellationToken);
        }

        private static string? BusinessCode(string? code)
        {
            string? text = string.IsNullOrWhiteSpace(code) ? null : code.Trim();
            return text != null && Guid.TryParse(text, out _) ? null : text;
        }

        private static void Require(string? value, string missingText, List<string> missing)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                missing.Add(missingText);
            }
        }

        private static string? Money(string? value)
        {
            return decimal.TryParse(value, NumberStyles.Number, CultureInfo.InvariantCulture, out decimal amount)
                ? amount.ToString("0.00", CultureInfo.InvariantCulture)
                : value;
        }

        private sealed class Snapshot
        {
            public string? CompanyCode { get; set; }
            public string? Plant { get; set; }
            public string? SupplierCode { get; set; }
            public string? Currency { get; set; }
            public string? TaxCode { get; set; }
            public List<SnapshotLine> Lines { get; set; } = new();
        }

        private sealed class SnapshotLine
        {
            public string? Line { get; set; }
            public string? Material { get; set; }
            public string? Uom { get; set; }
            public string? TaxCode { get; set; }
        }
    }
}
