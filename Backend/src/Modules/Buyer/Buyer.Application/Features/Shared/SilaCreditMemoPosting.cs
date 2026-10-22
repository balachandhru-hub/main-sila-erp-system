using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
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

            JsonArray items = new JsonArray();
            foreach (SilaCreditMemoPostingData.Line line in prepared.Lines)
            {
                items.Add(new JsonObject
                {
                    ["InvoicingParty"] = SilaCreditMemoPostingData.LineValue(line, "InvoicingParty"),
                    ["PurchaseOrder"] = SilaCreditMemoPostingData.LineValue(line, "PurchaseOrder"),
                    ["PurchaseOrderItem"] = SilaCreditMemoPostingData.LineValue(line, "PurchaseOrderItem"),
                    ["SupplierInvoiceItemAmount"] = SilaCreditMemoPostingData.LineValue(line, "SupplierInvoiceItemAmount"),
                    ["DocumentCurrency"] = SilaCreditMemoPostingData.LineValue(line, "DocumentCurrency"),
                    ["Quantity"] = SilaCreditMemoPostingData.LineValue(line, "Quantity"),
                    ["PurchaseOrderQuantityUnit"] = SilaCreditMemoPostingData.LineValue(line, "PurchaseOrderQuantityUnit"),
                    ["TaxCode"] = SilaCreditMemoPostingData.LineValue(line, "TaxCode")
                });
            }

            JsonObject body = new JsonObject
            {
                ["CompanyCode"] = SilaCreditMemoPostingData.Header(prepared, "CompanyCode"),
                ["DocumentDate"] = SapDate(SilaCreditMemoPostingData.Header(prepared, "DocumentDate")),
                ["PostingDate"] = SapDate(SilaCreditMemoPostingData.Header(prepared, "PostingDate")),
                ["SupplierInvoiceIDByInvcgParty"] = SilaCreditMemoPostingData.Header(prepared, "SupplierInvoiceIDByInvoicingParty"),
                ["InvoicingParty"] = SilaCreditMemoPostingData.Header(prepared, "InvoicingParty"),
                ["DocumentCurrency"] = SilaCreditMemoPostingData.Header(prepared, "DocumentCurrency"),
                ["InvoiceGrossAmount"] = SilaCreditMemoPostingData.Header(prepared, "InvoiceGrossAmount"),
                ["AccountingDocumentType"] = SilaCreditMemoLifecycle.DOCUMENT_TYPE,
                ["TaxCalculationDate"] = SapDate(SilaCreditMemoPostingData.Header(prepared, "TaxCalculationDate")),
                ["To_SuplrInvcItemPurOrdRef"] = items
            };
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
                string? fiscal = ReadFiscalYear(posting.ErpResponsePayload);
                string comment = "SAP Credit Memo " + (posting.ErpReference ?? string.Empty)
                    + (string.IsNullOrWhiteSpace(fiscal) ? string.Empty : " / " + fiscal);
                Remember(repository, memo, posting.UpdatedBy, ACTION_POSTED, comment);
                RememberInvoice(repository, memo, posting.UpdatedBy, ACTION_POSTED, "Credit Memo Posted. " + comment);
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

            try
            {
                using JsonDocument document = JsonDocument.Parse(body);
                JsonElement root = document.RootElement;
                if (root.TryGetProperty("d", out JsonElement wrapped))
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
