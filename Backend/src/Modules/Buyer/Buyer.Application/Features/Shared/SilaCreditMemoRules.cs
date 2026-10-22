using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    public static class SilaCreditMemoRules
    {
        public static bool InvoiceEligible(Invoice invoice, InventoryErpPosting? posting)
        {
            if (SilaInvoiceLifecycle.PostedStatuses.Contains(invoice.Status))
            {
                return true;
            }

            return posting != null && (posting.Status == Common.SILA_POSTING_POSTED || SilaTrackerRules.ErpAlreadyAccepted(posting));
        }

        public static async Task<CreditMemo> GetAsync(IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid creditMemoId)
        {
            CreditMemo? memo = await repository.CreditMemo.FindFirstByConditionAsync(x => x.Id == creditMemoId && x.BuyerId == buyerId && x.IsActive);
            if (memo == null)
            {
                logger.LogError($"Credit memo not found. CreditMemoId: {creditMemoId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Credit memo not found.", "Select a credit memo of this organization.");
            }

            return memo;
        }

        public static async Task<Invoice> RequirePostedInvoiceAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid invoiceId, CancellationToken cancellationToken)
        {
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(repository, logger, buyerId, invoiceId);
            InventoryErpPosting? posting = invoice.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == buyerId);
            if (!InvoiceEligible(invoice, posting))
            {
                throw new BadRequestCustomException(
                    "Credit memo requires a posted invoice.",
                    "Create a credit memo only against a successfully posted invoice.");
            }

            await Task.CompletedTask;
            return invoice;
        }

        public static async Task<Invoice?> ResolveReferenceInvoiceAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid? invoiceId,
            string? invoiceNumber,
            string? erpInvoiceId,
            CancellationToken cancellationToken)
        {
            if (invoiceId != null && invoiceId != Guid.Empty)
            {
                return await repository.Invoice.FindFirstByConditionAsync(x => x.Id == invoiceId && x.BuyerId == buyerId && x.IsActive);
            }

            string number = invoiceNumber?.Trim() ?? string.Empty;
            string erp = erpInvoiceId?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(number) && string.IsNullOrWhiteSpace(erp))
            {
                return null;
            }

            IQueryable<Invoice> invoices = repository.Invoice.FindByCondition(x => x.BuyerId == buyerId && x.IsActive);
            if (!string.IsNullOrWhiteSpace(number))
            {
                Invoice? byNumber = await invoices.FirstOrDefaultAsync(
                    x => x.InvoiceNumber != null && x.InvoiceNumber == number, cancellationToken);
                if (byNumber != null)
                {
                    return byNumber;
                }
            }

            if (string.IsNullOrWhiteSpace(erp))
            {
                return null;
            }

            InventoryErpPosting? posting = await repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_INVOICE
                    && x.ErpReference != null && x.ErpReference == erp)
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
            if (posting == null)
            {
                return null;
            }

            return await repository.Invoice.FindFirstByConditionAsync(x => x.Id == posting.ReferenceId && x.BuyerId == buyerId && x.IsActive);
        }

        public static string DefaultHeaderText(string? invoiceNumber)
        {
            string number = invoiceNumber?.Trim() ?? string.Empty;
            return string.IsNullOrWhiteSpace(number) ? "Return of invoice" : "Return of " + number;
        }

        public static string ResolveHeaderText(string? headerText, string? reason, string? invoiceNumber)
        {
            if (!string.IsNullOrWhiteSpace(headerText))
            {
                return headerText.Trim();
            }

            if (!string.IsNullOrWhiteSpace(reason))
            {
                return reason.Trim();
            }

            return DefaultHeaderText(invoiceNumber);
        }

        public static DateTime TransactionDate(DateTime? requested)
        {
            return requested?.Date ?? DateTime.UtcNow.Date;
        }

        public static async Task<SilaCreditMemoReferenceInvoiceDto> ToReferenceAsync(
            IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            InventoryErpPosting? posting = invoice.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId && x.BuyerId == invoice.BuyerId);
            SilaInvoicePostingData.Prepared? prepared = SilaInvoicePostingData.Read(invoice.PostingData);
            string? postingCompany = prepared?.Header
                .LastOrDefault(x => x.ApiField.Equals("CompanyCode", StringComparison.OrdinalIgnoreCase))?.Value;
            return new SilaCreditMemoReferenceInvoiceDto
            {
                Id = invoice.Id,
                InvoiceNumber = invoice.InvoiceNumber,
                ErpInvoiceId = posting?.ErpReference,
                FiscalYear = SilaInvoicePosting.ReadFiscalYear(posting?.ErpResponsePayload),
                SupplierName = invoice.SupplierName,
                PoNumber = invoice.PoNumber,
                CompanyCode = FirstNonEmpty(invoice.CompanyCode, postingCompany, posting?.CompanyCode),
                Currency = invoice.Currency ?? prepared?.Header
                    .LastOrDefault(x => x.ApiField.Equals("DocumentCurrency", StringComparison.OrdinalIgnoreCase)
                        || x.ApiField.Equals("Currency", StringComparison.OrdinalIgnoreCase))?.Value,
                OriginalGrossAmount = invoice.GrossAmount,
                PostingDate = posting?.PostedOn,
                InvoiceDate = invoice.InvoiceDate,
                Status = invoice.Status,
                HeaderText = DefaultHeaderText(invoice.InvoiceNumber)
            };
        }

        public static async Task<List<SilaCreditMemoEligibleLineDto>> EligibleLinesAsync(
            IRepositoryWrapper repository, Invoice invoice, Guid? excludeCreditMemoId, CancellationToken cancellationToken)
        {
            List<InvoiceItem> items = await repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            SilaInvoicePostingData.Prepared? prepared = SilaInvoicePostingData.Read(invoice.PostingData);
            List<Guid> poItemIds = items.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).Distinct().ToList();
            List<PurchaseOrderItem> poItems = poItemIds.Count == 0
                ? new List<PurchaseOrderItem>()
                : await repository.PurchaseOrderItem.FindByCondition(x => poItemIds.Contains(x.Id)).ToListAsync(cancellationToken);
            Dictionary<(Guid? LineId, int LineNumber), (decimal Qty, decimal Amount)> credited = await CreditedAsync(
                repository, invoice.Id, excludeCreditMemoId, cancellationToken);
            List<SilaCreditMemoEligibleLineDto> result = new List<SilaCreditMemoEligibleLineDto>();
            foreach (InvoiceItem item in items)
            {
                SilaInvoicePostingData.Line? preparedLine = prepared?.Lines.FirstOrDefault(x => x.InvoiceItemId == item.Id)
                    ?? prepared?.Lines.FirstOrDefault(x => x.InvoiceLine == item.LineNumber);
                PurchaseOrderItem? poItem = item.PurchaseOrderItemId == null
                    ? null
                    : poItems.FirstOrDefault(x => x.Id == item.PurchaseOrderItemId);
                decimal originalQty = DecimalOf(LineField(preparedLine, "QuantityInPurchaseOrderUnit")) ?? item.Quantity ?? 0;
                decimal originalAmt = DecimalOf(LineField(preparedLine, "SupplierInvoiceItemAmount")) ?? item.Amount ?? 0;
                credited.TryGetValue((item.Id, item.LineNumber), out (decimal Qty, decimal Amount) previous);
                result.Add(new SilaCreditMemoEligibleLineDto
                {
                    InvoiceLineId = item.Id,
                    LineNumber = item.LineNumber,
                    PoNumber = LineField(preparedLine, "PurchaseOrder") ?? invoice.PoNumber,
                    PoItem = LineField(preparedLine, "PurchaseOrderItem")
                        ?? (poItem == null ? null : poItem.LineNumber.ToString("00000", System.Globalization.CultureInfo.InvariantCulture)),
                    Material = LineField(preparedLine, "Material") ?? item.SupplierMaterialCode ?? poItem?.MaterialCode,
                    Description = item.Description,
                    OriginalQuantity = originalQty,
                    OriginalAmount = originalAmt,
                    PreviouslyCreditedQuantity = previous.Qty,
                    PreviouslyCreditedAmount = previous.Amount,
                    RemainingQuantity = Math.Max(0, originalQty - previous.Qty),
                    RemainingAmount = Math.Max(0, originalAmt - previous.Amount),
                    Uom = LineField(preparedLine, "PurchaseOrderQuantityUnit") ?? item.Uom ?? poItem?.UnitOfMeasure,
                    TaxCode = LineField(preparedLine, "TaxCode") ?? item.TaxCode ?? poItem?.TaxCode
                });
            }

            return result;
        }

        public static async Task<SilaCreditMemoDetailDto> ToDetailAsync(
            IRepositoryWrapper repository, CreditMemo memo, CancellationToken cancellationToken)
        {
            Invoice invoice = await repository.Invoice.FindFirstByConditionAsync(x => x.Id == memo.ReferenceInvoiceId && x.BuyerId == memo.BuyerId && x.IsActive)
                ?? throw new NotFoundCustomException("Reference invoice not found.", "The original invoice of this credit memo is missing.");
            List<CreditMemoItem> items = await repository.CreditMemoItem
                .FindByCondition(x => x.CreditMemoId == memo.Id && x.IsActive)
                .OrderBy(x => x.LineNumber)
                .ToListAsync(cancellationToken);
            List<SilaCreditMemoEligibleLineDto> eligible = await EligibleLinesAsync(repository, invoice, memo.Id, cancellationToken);
            InventoryErpPosting? posting = memo.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == memo.ErpPostingId && x.BuyerId == memo.BuyerId);
            if (await SilaCreditMemoPosting.ApplyStoredSuccessAsync(repository, memo, posting, cancellationToken))
            {
                await repository.SaveAsync();
            }

            List<InventoryWorkflowEvent> events = await repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == memo.BuyerId && x.IsActive
                    && ((x.ReferenceType == Common.SILA_REF_CREDIT_MEMO && x.ReferenceId == memo.Id)
                        || (x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == memo.ReferenceInvoiceId)))
                .OrderByDescending(x => x.DateCreated)
                .Take(40)
                .ToListAsync(cancellationToken);
            return new SilaCreditMemoDetailDto
            {
                Id = memo.Id,
                BuyerId = memo.BuyerId,
                CreditMemoNumber = memo.CreditMemoNumber,
                CreditMemoReference = memo.CreditMemoReference,
                ReferenceInvoiceId = memo.ReferenceInvoiceId,
                ReferenceSupplierInvoiceNumber = memo.ReferenceSupplierInvoiceNumber,
                ReferenceErpInvoiceId = memo.ReferenceErpInvoiceId,
                ReferenceFiscalYear = memo.ReferenceFiscalYear,
                SupplierId = memo.SupplierId,
                SilaSupplierId = memo.SilaSupplierId,
                SupplierName = memo.SupplierName,
                PurchaseOrderId = memo.PurchaseOrderId,
                PoNumber = memo.PoNumber,
                CompanyCode = memo.CompanyCode,
                Currency = memo.Currency,
                DocumentDate = memo.DocumentDate,
                PostingDate = memo.PostingDate,
                TaxCalculationDate = memo.TaxCalculationDate,
                Reason = memo.Reason,
                HeaderText = SilaCreditMemoPostingData.Header(SilaCreditMemoPostingData.Read(memo.PostingData), "HeaderText")
                    ?? memo.Reason
                    ?? DefaultHeaderText(memo.ReferenceSupplierInvoiceNumber),
                GrossAmount = memo.GrossAmount,
                Status = memo.Status,
                ErpPostingId = memo.ErpPostingId,
                ErpStatus = posting?.Status,
                ErpReference = posting?.ErpReference,
                FiscalYear = SilaCreditMemoPosting.ReadFiscalYear(posting?.ErpResponsePayload),
                ErpMessage = posting == null ? null : SilaCreditMemoPosting.SafeFailure(posting.ErpHttpStatus, posting.ErpResponsePayload, posting.ErrorMessage),
                IntegrationName = posting?.IntegrationSystem,
                PostedOn = posting?.PostedOn,
                CanSubmit = SilaCreditMemoLifecycle.CanSubmit(memo.Status),
                CanRetry = SilaCreditMemoLifecycle.CanRetry(memo.Status, posting?.Status),
                ReferenceLocked = true,
                Lines = items.Select(item =>
                {
                    SilaCreditMemoEligibleLineDto? source = eligible.FirstOrDefault(x => x.InvoiceLineId == item.ReferenceInvoiceLineId);
                    return new SilaCreditMemoLineDto
                    {
                        Id = item.Id,
                        ReferenceInvoiceLineId = item.ReferenceInvoiceLineId,
                        LineNumber = item.LineNumber,
                        PoNumber = item.PoNumber ?? source?.PoNumber,
                        PoItem = item.PoItem ?? source?.PoItem,
                        Material = item.Material ?? source?.Material,
                        Description = item.Description,
                        Quantity = item.Quantity,
                        Uom = item.Uom ?? source?.Uom,
                        Amount = item.Amount,
                        TaxCode = item.TaxCode ?? source?.TaxCode,
                        Reason = item.Reason,
                        OriginalQuantity = source?.OriginalQuantity ?? 0,
                        OriginalAmount = source?.OriginalAmount ?? 0,
                        PreviouslyCreditedQuantity = source?.PreviouslyCreditedQuantity ?? 0,
                        PreviouslyCreditedAmount = source?.PreviouslyCreditedAmount ?? 0,
                        RemainingQuantity = source?.RemainingQuantity ?? 0,
                        RemainingAmount = source?.RemainingAmount ?? 0
                    };
                }).ToList(),
                ReferenceInvoice = await ToReferenceAsync(repository, invoice, cancellationToken),
                DocumentTrack = await SilaDocumentTrack.ForCreditMemoAsync(repository, memo.BuyerId, memo, invoice, cancellationToken),
                History = events.Select(x => new SilaDocumentTrackEventDto
                {
                    Action = x.Action,
                    Comment = x.Comment,
                    OccurredOn = x.DateCreated,
                    ReferenceType = x.ReferenceType,
                    ReferenceId = x.ReferenceId
                }).ToList()
            };
        }

        public static List<SilaCreditMemoLineWriteDto> IncludedWrites(
            IReadOnlyList<SilaCreditMemoEligibleLineDto> eligible, IReadOnlyList<SilaCreditMemoLineWriteDto>? requested)
        {
            List<SilaCreditMemoLineWriteDto> writes = requested == null || requested.Count == 0
                ? eligible
                    .Where(x => x.RemainingQuantity > 0 || x.RemainingAmount > 0)
                    .Select(x => new SilaCreditMemoLineWriteDto
                    {
                        InvoiceLineId = x.InvoiceLineId,
                        Quantity = x.RemainingQuantity,
                        Amount = x.RemainingAmount
                    })
                    .ToList()
                : requested.ToList();
            GuardQuantities(eligible, writes);
            List<SilaCreditMemoLineWriteDto> included = writes
                .Where(x => (x.Quantity ?? 0) > 0 || (x.Amount ?? 0) > 0)
                .ToList();
            if (included.Count == 0)
            {
                throw new BadRequestCustomException("Credit memo has no lines.", "Enter a credit quantity or amount on at least one line.");
            }

            return included;
        }

        public static void GuardQuantities(IReadOnlyList<SilaCreditMemoEligibleLineDto> eligible, IReadOnlyList<SilaCreditMemoLineWriteDto> writes)
        {
            foreach (SilaCreditMemoLineWriteDto write in writes)
            {
                SilaCreditMemoEligibleLineDto? line = eligible.FirstOrDefault(x => x.InvoiceLineId == write.InvoiceLineId);
                if (line == null)
                {
                    throw new BadRequestCustomException("Credit memo line is not on the original invoice.", "Each credit line must reference an original invoice line.");
                }

                decimal qty = write.Quantity ?? 0;
                decimal amount = write.Amount ?? 0;
                if (qty < 0 || amount < 0)
                {
                    throw new BadRequestCustomException("Credit quantity and amount cannot be negative.", "Enter a credit quantity and amount of zero or more.");
                }

                if (qty > line.RemainingQuantity || amount > line.RemainingAmount)
                {
                    throw new BadRequestCustomException(
                        "Credit exceeds remaining eligible quantity or amount.",
                        "PO item " + (line.PoItem ?? line.LineNumber.ToString()) + " remaining qty " + line.RemainingQuantity + ", remaining amount " + line.RemainingAmount + ".");
                }
            }
        }

        private static async Task<Dictionary<(Guid? LineId, int LineNumber), (decimal Qty, decimal Amount)>> CreditedAsync(
            IRepositoryWrapper repository, Guid invoiceId, Guid? excludeCreditMemoId, CancellationToken cancellationToken)
        {
            List<CreditMemo> memos = await repository.CreditMemo
                .FindByCondition(x => x.ReferenceInvoiceId == invoiceId && x.IsActive
                    && SilaCreditMemoLifecycle.CountsTowardRemaining.Contains(x.Status)
                    && (excludeCreditMemoId == null || x.Id != excludeCreditMemoId))
                .ToListAsync(cancellationToken);
            List<Guid> ids = memos.Select(x => x.Id).ToList();
            List<CreditMemoItem> items = ids.Count == 0
                ? new List<CreditMemoItem>()
                : await repository.CreditMemoItem.FindByCondition(x => ids.Contains(x.CreditMemoId) && x.IsActive).ToListAsync(cancellationToken);
            Dictionary<(Guid? LineId, int LineNumber), (decimal Qty, decimal Amount)> result = new();
            foreach (CreditMemoItem item in items)
            {
                (Guid? LineId, int LineNumber) key = (item.ReferenceInvoiceLineId, item.LineNumber);
                result.TryGetValue(key, out (decimal Qty, decimal Amount) current);
                result[key] = (current.Qty + (item.Quantity ?? 0), current.Amount + (item.Amount ?? 0));
            }

            return result;
        }

        private static string? FirstNonEmpty(params string?[] values)
        {
            return values.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x))?.Trim();
        }

        private static string? LineField(SilaInvoicePostingData.Line? line, string name)
        {
            return line?.Fields.LastOrDefault(x => x.ApiField.Equals(name, StringComparison.OrdinalIgnoreCase))?.Value;
        }

        private static decimal? DecimalOf(string? value)
        {
            return decimal.TryParse(value, System.Globalization.NumberStyles.Number, System.Globalization.CultureInfo.InvariantCulture, out decimal number)
                ? number
                : null;
        }
    }
}
