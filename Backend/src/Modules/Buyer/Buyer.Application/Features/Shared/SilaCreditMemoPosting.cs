using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Buyer.Application.Features.Commands.PostPendingErpPostings;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Credit memo SAP posting through FIVE S4-INVOICE CREDITMEMO. Uses stored prepared data only.
    /// Does not change the original invoice or FIVE S4-INVOICE POSTING.
    /// </summary>
    public static class SilaCreditMemoPosting
    {
        public const string ACTION_CREATED = "CREDIT_MEMO_CREATED";
        public const string ACTION_STARTED = "CREDIT_MEMO_POSTING_STARTED";
        public const string ACTION_POSTED = "CREDIT_MEMO_POSTED";
        public const string ACTION_FAILED = "CREDIT_MEMO_POSTING_FAILED";
        public const string ACTION_BLOCKED = "CREDIT_MEMO_BLOCKED";

        private static readonly string[] InvoiceReferenceNames =
        {
            "SupplierInvoice", "supplierInvoice", "SupplierInvoiceID", "supplierInvoiceId", "SupplierInvoiceNumber"
        };

        private static readonly string[] FiscalYearNames = { "FiscalYear", "fiscalYear", "Fiscalyear" };

        private static readonly Regex ODataSupplierInvoiceKey = new Regex(
            @"A_SupplierInvoice\(SupplierInvoice='([^']+)',FiscalYear='([^']+)'\)",
            RegexOptions.CultureInvariant | RegexOptions.Compiled,
            TimeSpan.FromSeconds(1));

        public static async Task<ApiIntegrationConfiguration?> FindCreditMemoApiAsync(
            IRepositoryWrapper repository, Guid organizationId, string? companyCode, CancellationToken cancellationToken)
        {
            List<ApiIntegrationConfiguration> configurations = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .ToListAsync(cancellationToken);
            bool named(ApiIntegrationConfiguration configuration) =>
                configuration.Name.Equals(SilaCreditMemoLifecycle.API_CREDIT_MEMO, StringComparison.OrdinalIgnoreCase);
            if (string.IsNullOrWhiteSpace(companyCode))
            {
                return configurations.FirstOrDefault(x => named(x)
                    && x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase));
            }

            return configurations.FirstOrDefault(x => named(x)
                && (x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase)
                    || x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase)));
        }

        public static (string? Body, List<string> Missing) Request(SilaCreditMemoPostingData.Prepared? prepared)
        {
            List<string> missing = SilaCreditMemoPostingData.Missing(prepared);
            if (prepared == null || missing.Count > 0)
            {
                return (null, missing);
            }

            string? documentDate = SapDate(SilaCreditMemoPostingData.Header(prepared, "DocumentDate"));
            string? postingDate = SapDate(SilaCreditMemoPostingData.Header(prepared, "PostingDate")) ?? documentDate;
            string? dueDate = SapDate(SilaCreditMemoPostingData.Header(prepared, "DueCalculationBaseDate")) ?? postingDate;
            string? taxDate = SapDate(SilaCreditMemoPostingData.Header(prepared, "TaxDeterminationDate"))
                ?? SapDate(SilaCreditMemoPostingData.Header(prepared, "TaxCalculationDate"));
            string? currency = SilaCreditMemoPostingData.Header(prepared, "DocumentCurrency");
            JsonArray results = new JsonArray();
            int sequence = 0;
            foreach (SilaCreditMemoPostingData.Line line in prepared.Lines)
            {
                sequence++;
                string? itemNumber = SilaCreditMemoPostingData.LineValue(line, "SupplierInvoiceItem");
                if (string.IsNullOrWhiteSpace(itemNumber))
                {
                    itemNumber = sequence.ToString("00000", CultureInfo.InvariantCulture);
                }

                results.Add(new JsonObject
                {
                    ["SupplierInvoiceItem"] = itemNumber,
                    ["PurchaseOrder"] = SilaCreditMemoPostingData.LineValue(line, "PurchaseOrder"),
                    ["PurchaseOrderItem"] = SilaCreditMemoPostingData.LineValue(line, "PurchaseOrderItem"),
                    ["DocumentCurrency"] = SilaCreditMemoPostingData.LineValue(line, "DocumentCurrency") ?? currency,
                    ["SupplierInvoiceItemAmount"] = SilaCreditMemoPostingData.LineValue(line, "SupplierInvoiceItemAmount"),
                    ["QuantityInPurchaseOrderUnit"] = QuantityText(SilaCreditMemoPostingData.LineValue(line, "QuantityInPurchaseOrderUnit")
                        ?? SilaCreditMemoPostingData.LineValue(line, "Quantity")),
                    ["PurchaseOrderQuantityUnit"] = SilaCreditMemoPostingData.LineValue(line, "PurchaseOrderQuantityUnit"),
                    ["TaxCode"] = SilaCreditMemoPostingData.LineValue(line, "TaxCode")
                });
            }

            JsonObject body = new JsonObject
            {
                ["CompanyCode"] = SilaCreditMemoPostingData.Header(prepared, "CompanyCode"),
                ["DocumentDate"] = documentDate,
                ["PostingDate"] = postingDate,
                ["DueCalculationBaseDate"] = dueDate
            };
            if (!string.IsNullOrWhiteSpace(taxDate))
            {
                body["TaxDeterminationDate"] = taxDate;
            }

            body["InvoicingParty"] = SilaCreditMemoPostingData.Header(prepared, "InvoicingParty");
            body["DocumentCurrency"] = currency;
            body["InvoiceGrossAmount"] = SilaCreditMemoPostingData.Header(prepared, "InvoiceGrossAmount");
            body["AccountingDocumentType"] = SilaCreditMemoLifecycle.DOCUMENT_TYPE;
            body["SupplierInvoiceIDByInvcgParty"] = SilaCreditMemoPostingData.Header(prepared, "SupplierInvoiceIDByInvoicingParty");
            body["TaxIsCalculatedAutomatically"] = true;
            body["SupplierInvoiceIsCreditMemo"] = "1";
            body["to_SuplrInvcItemPurOrdRef"] = new JsonObject { ["results"] = results };
            return (body.ToJsonString(), missing);
        }

        /// <summary>
        /// Same outbound date form as FIVE S4-INVOICE POSTING: yyyy-MM-ddT00:00:00.
        /// Stored posting data stays yyyy-MM-dd.
        /// </summary>
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

        public static async Task ContinueAsync(
            IRepositoryWrapper repository,
            IMediator mediator,
            BuyerBusinessProfile buyer,
            CreditMemo memo,
            Guid userId,
            CancellationToken cancellationToken)
        {
            ArgumentNullException.ThrowIfNull(buyer);
            SilaCreditMemoPostingData.Prepared? prepared = SilaCreditMemoPostingData.Read(memo.PostingData);
            List<string> missing = SilaCreditMemoPostingData.Missing(prepared);
            if (missing.Count > 0)
            {
                string message = SilaCreditMemoLifecycle.MISSING + ". " + string.Join("; ", missing);
                memo.Status = Common.SILA_CREDIT_MEMO_DRAFT;
                Remember(repository, memo, userId, ACTION_BLOCKED, message);
                repository.CreditMemo.Update(memo);
                await repository.SaveAsync();
                throw new BadRequestCustomException("Credit memo cannot be posted.", message);
            }

            memo.Status = Common.SILA_CREDIT_MEMO_READY_TO_POST;
            repository.CreditMemo.Update(memo);
            await repository.SaveAsync();

            InventoryErpPosting? posting = memo.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == memo.ErpPostingId && x.BuyerId == memo.BuyerId);
            if (posting != null && (posting.Status == Common.SILA_POSTING_UNKNOWN || SilaTrackerRules.ErpAlreadyAccepted(posting) || posting.Status == Common.SILA_POSTING_POSTED))
            {
                throw new BadRequestCustomException(
                    posting.Status == Common.SILA_POSTING_UNKNOWN ? "Reconcile this credit memo." : "Credit memo is already posted.",
                    posting.Status == Common.SILA_POSTING_UNKNOWN
                        ? "SAP did not confirm whether the credit memo was created. Reconcile it. SAP will not be called again until that is settled."
                        : "This credit memo already has a SAP reference.");
            }

            if (posting == null)
            {
                InventoryLedger ledger = new InventoryLedger(repository, memo.BuyerId, userId);
                posting = ledger.QueueErpPosting(
                    Common.SILA_REF_CREDIT_MEMO,
                    memo.Id,
                    memo.CreditMemoNumber ?? memo.CreditMemoReference ?? memo.Id.ToString(),
                    null,
                    Common.SILA_MOVEMENT_CREDIT_MEMO);
                memo.ErpPostingId = posting.Id;
            }
            else if (posting.Status is Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED)
            {
                string? previous = posting.ErrorMessage;
                posting.Status = Common.SILA_POSTING_PENDING;
                posting.ErrorMessage = null;
                SilaPostingRecovery.Record(repository, posting, userId, SilaTrackerRules.FROM_ERP, previous, true, false, "ERP processing queued again from stored credit memo posting data.");
            }

            posting.CompanyCode = SilaCreditMemoPostingData.Header(prepared, "CompanyCode") ?? memo.CompanyCode;
            posting.IntegrationSystem = SilaCreditMemoLifecycle.API_CREDIT_MEMO;
            memo.Status = Common.SILA_CREDIT_MEMO_POSTING;
            Remember(repository, memo, userId, ACTION_STARTED, memo.CreditMemoNumber);
            RememberInvoice(repository, memo, userId, ACTION_STARTED, "Credit Memo Posting Started");
            repository.CreditMemo.Update(memo);
            await repository.SaveAsync();
            await mediator.Send(new PostPendingErpPostingsCommand { BuyerId = memo.BuyerId, PostingId = posting.Id }, cancellationToken);
        }

        public static async Task OnFinishedAsync(IRepositoryWrapper repository, InventoryErpPosting posting, string status, CancellationToken cancellationToken)
        {
            if (posting.ReferenceType != Common.SILA_REF_CREDIT_MEMO)
            {
                return;
            }

            CreditMemo? memo = await repository.CreditMemo.FindFirstByConditionAsync(x => x.Id == posting.ReferenceId && x.BuyerId == posting.BuyerId && x.IsActive);
            if (memo == null)
            {
                return;
            }

            await ApplyStoredSuccessAsync(repository, memo, posting, cancellationToken);

            string next = status switch
            {
                Common.SILA_POSTING_POSTED => Common.SILA_CREDIT_MEMO_POSTED,
                Common.SILA_POSTING_FAILED_LOCAL => Common.SILA_CREDIT_MEMO_LOCAL_FAILED,
                Common.SILA_POSTING_UNKNOWN => Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN,
                Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED => Common.SILA_CREDIT_MEMO_POSTING_FAILED,
                Common.SILA_POSTING_PENDING => Common.SILA_CREDIT_MEMO_POSTING,
                _ => memo.Status
            };
            if (next == memo.Status)
            {
                return;
            }

            memo.Status = next;
            memo.ErpPostingId ??= posting.Id;
            if (status == Common.SILA_POSTING_POSTED)
            {
                Remember(repository, memo, posting.UpdatedBy, ACTION_POSTED, PostedComment(posting));
                RememberInvoice(repository, memo, posting.UpdatedBy, ACTION_POSTED, "Credit Memo Posted. " + PostedComment(posting));
            }
            else if (status is Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED)
            {
                string error = SafeFailure(posting.ErpHttpStatus, posting.ErpResponsePayload, posting.ErrorMessage);
                Remember(repository, memo, posting.UpdatedBy, ACTION_FAILED, error);
                RememberInvoice(repository, memo, posting.UpdatedBy, ACTION_FAILED, "Credit Memo Posting Failed. " + error);
            }

            repository.CreditMemo.Update(memo);
            await Task.CompletedTask;
        }

        public static string? ReadSupplierInvoice(string? body)
        {
            return ReadNamed(body, InvoiceReferenceNames);
        }

        public static string? ReadFiscalYear(string? body)
        {
            return ReadNamed(body, FiscalYearNames);
        }

        /// <summary>
        /// Fills a missing ERP reference from the stored SAP 201 body. Never calls SAP.
        /// Does not overwrite an existing different reference or create another posting.
        /// </summary>
        public static async Task<bool> ApplyStoredSuccessAsync(
            IRepositoryWrapper repository,
            CreditMemo memo,
            InventoryErpPosting? posting,
            CancellationToken cancellationToken)
        {
            if (posting == null
                || posting.ReferenceType != Common.SILA_REF_CREDIT_MEMO
                || posting.ReferenceId != memo.Id
                || (posting.Status != Common.SILA_POSTING_POSTED
                    && posting.Status != Common.SILA_POSTING_ERP_ACCEPTED
                    && posting.Status != Common.SILA_POSTING_FAILED_LOCAL))
            {
                return false;
            }

            string? sap = ReadSupplierInvoice(posting.ErpResponsePayload);
            string? fiscal = ReadFiscalYear(posting.ErpResponsePayload);
            if (string.IsNullOrWhiteSpace(sap))
            {
                return false;
            }

            bool changed = false;
            if (string.IsNullOrWhiteSpace(posting.ErpReference))
            {
                posting.ErpReference = sap;
                repository.InventoryErpPosting.Update(posting);
                changed = true;
            }
            else if (!posting.ErpReference.Trim().Equals(sap.Trim(), StringComparison.Ordinal))
            {
                return false;
            }

            string comment = PostedComment(posting.ErpReference, fiscal);
            List<InventoryWorkflowEvent> events = await repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == memo.BuyerId && x.IsActive && x.Action == ACTION_POSTED
                    && ((x.ReferenceType == Common.SILA_REF_CREDIT_MEMO && x.ReferenceId == memo.Id)
                        || (x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == memo.ReferenceInvoiceId)))
                .ToListAsync(cancellationToken);
            foreach (InventoryWorkflowEvent row in events)
            {
                if (!string.IsNullOrWhiteSpace(row.Comment) && row.Comment.Contains(sap, StringComparison.Ordinal))
                {
                    continue;
                }

                if (row.ReferenceType == Common.SILA_REF_CREDIT_MEMO)
                {
                    row.Comment = Truncate(comment);
                }
                else
                {
                    row.Comment = Truncate("Credit Memo Posted. " + comment);
                }

                repository.InventoryWorkflowEvent.Update(row);
                changed = true;
            }

            return changed;
        }

        private static string PostedComment(InventoryErpPosting posting)
        {
            return PostedComment(posting.ErpReference, ReadFiscalYear(posting.ErpResponsePayload));
        }

        private static string PostedComment(string? sap, string? fiscal)
        {
            return "SAP Credit Memo " + (sap ?? string.Empty)
                + (string.IsNullOrWhiteSpace(fiscal) ? string.Empty : " / " + fiscal);
        }

        public static string SafeFailure(int? httpStatus, string? responseBody, string? fallback)
        {
            string? sap = ReadNamed(responseBody, new[] { "message", "Message", "error", "Error", "value" });
            if (string.IsNullOrWhiteSpace(sap) && !string.IsNullOrWhiteSpace(responseBody))
            {
                sap = responseBody.Trim();
                if (sap.Length > 400)
                {
                    sap = sap[..400];
                }
            }

            sap = StripSecrets(sap);
            string code = httpStatus?.ToString(CultureInfo.InvariantCulture) ?? "ERROR";
            if (!string.IsNullOrWhiteSpace(sap))
            {
                return "SAP " + code + " — " + sap;
            }

            string safe = StripSecrets(fallback) ?? "The ERP could not be reached.";
            return "SAP " + code + " — " + safe;
        }

        public static void Remember(IRepositoryWrapper repository, CreditMemo memo, Guid userId, string action, string? comment)
        {
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = memo.BuyerId,
                ReferenceType = Common.SILA_REF_CREDIT_MEMO,
                ReferenceId = memo.Id,
                Action = action,
                Comment = Truncate(comment),
                ActorUserId = userId,
                IsActive = true
            });
        }

        public static void RememberInvoice(IRepositoryWrapper repository, CreditMemo memo, Guid userId, string action, string? comment)
        {
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = memo.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = memo.ReferenceInvoiceId,
                Action = action,
                Comment = Truncate(comment),
                ActorUserId = userId,
                IsActive = true
            });
        }

        private static string? Truncate(string? comment)
        {
            if (string.IsNullOrWhiteSpace(comment))
            {
                return comment;
            }

            return comment.Length > 1000 ? comment[..1000] : comment;
        }

        private static string? StripSecrets(string? text)
        {
            if (string.IsNullOrWhiteSpace(text))
            {
                return text;
            }

            if (System.Text.RegularExpressions.Regex.IsMatch(text, "password|connection string|dataprotection|key ring|/tmp/|/workspace/|stack trace", System.Text.RegularExpressions.RegexOptions.IgnoreCase))
            {
                return "The credit memo posting could not be sent. Re-save FIVE S4-INVOICE CREDITMEMO credentials if they were changed.";
            }

            return text.Trim();
        }

        private static string? ReadNamed(string? body, IReadOnlyList<string> names)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            string? json = ReadNamedJson(body, names);
            if (!string.IsNullOrWhiteSpace(json))
            {
                return json;
            }

            bool supplier = names.Any(x => InvoiceReferenceNames.Contains(x, StringComparer.Ordinal));
            bool fiscal = names.Any(x => FiscalYearNames.Contains(x, StringComparer.Ordinal));
            if (!supplier && !fiscal)
            {
                return null;
            }

            try
            {
                Match key = ODataSupplierInvoiceKey.Match(body);
                if (key.Success)
                {
                    string value = fiscal && !supplier ? key.Groups[2].Value : key.Groups[1].Value;
                    if (!string.IsNullOrWhiteSpace(value))
                    {
                        return value.Trim();
                    }
                }
            }
            catch (RegexMatchTimeoutException)
            {
                return null;
            }

            foreach (string name in names)
            {
                Match property = Regex.Match(
                    body,
                    "(?<![A-Za-z])\"" + Regex.Escape(name) + "\"\\s*:\\s*\"([^\"]+)\"",
                    RegexOptions.CultureInvariant,
                    TimeSpan.FromSeconds(1));
                if (property.Success && !string.IsNullOrWhiteSpace(property.Groups[1].Value))
                {
                    return property.Groups[1].Value.Trim();
                }
            }

            return null;
        }

        private static string? ReadNamedJson(string body, IReadOnlyList<string> names)
        {
            try
            {
                using JsonDocument document = JsonDocument.Parse(body);
                JsonElement root = document.RootElement;
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
    }
}
