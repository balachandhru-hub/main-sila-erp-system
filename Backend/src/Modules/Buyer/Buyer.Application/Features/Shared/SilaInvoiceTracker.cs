using System.Text.Json;
using System.Text.Json.Nodes;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The supplier-invoice row on the transaction tracker: the SAP invoice id, the attachment result,
    /// and the stored PO, posting, and attachment steps.
    /// </summary>
    public static class SilaInvoiceTracker
    {
        public const string STEP_PO = "PO API Retrieval";
        public const string STEP_SUBMIT = "Invoice submission";
        public const string STEP_RESPONSE = "Response";
        public const string STEP_ATTACHMENT = "Invoice attachment request";

        public static bool IsInvoiceFamily(string? referenceType)
        {
            return referenceType == Common.SILA_REF_INVOICE || referenceType == Common.SILA_REF_INVOICE_ATTACHMENT;
        }

        public static bool Succeeded(string? status, string? erpReference)
        {
            return !string.IsNullOrWhiteSpace(erpReference)
                && (status == Common.SILA_POSTING_POSTED || status == Common.SILA_POSTING_ERP_ACCEPTED);
        }

        /// <summary>
        /// Success text for the tracker result column. Null when the invoice posting did not succeed,
        /// so the stored error stays in that column.
        /// </summary>
        public static string? ResultMessage(
            string? status,
            string? erpReference,
            string? attachmentStatus,
            string? attachmentError,
            int? attachmentHttp,
            string? fileName,
            string? fiscalYear)
        {
            if (!Succeeded(status, erpReference))
            {
                return null;
            }

            return "Successful. SAP invoice " + erpReference!.Trim() + ". "
                + AttachmentSentence(attachmentStatus, attachmentError, attachmentHttp, fileName, erpReference, fiscalYear);
        }

        public static string AttachmentSentence(
            string? attachmentStatus,
            string? attachmentError,
            int? attachmentHttp,
            string? fileName,
            string? erpReference,
            string? fiscalYear)
        {
            string? key = SilaInvoiceAttachment.LinkedKey(erpReference, fiscalYear);
            List<string> bits = new List<string>();
            if (!string.IsNullOrWhiteSpace(key))
            {
                bits.Add("key " + key);
            }

            if (!string.IsNullOrWhiteSpace(fileName))
            {
                bits.Add("file " + fileName.Trim());
            }

            if (attachmentHttp is > 0)
            {
                bits.Add("HTTP " + attachmentHttp.Value);
            }

            string detail = bits.Count == 0 ? string.Empty : " (" + string.Join(", ", bits) + ")";
            string error = string.IsNullOrWhiteSpace(attachmentError) ? string.Empty : " " + Trim(attachmentError, 300);
            if (string.IsNullOrWhiteSpace(attachmentStatus))
            {
                return "Attachment not sent" + detail + ".";
            }

            if (attachmentStatus == Common.SILA_POSTING_POSTED)
            {
                return "Attachment successful" + detail + ".";
            }

            if (attachmentStatus == Common.SILA_POSTING_FAILED
                || attachmentStatus == Common.SILA_POSTING_SKIPPED
                || attachmentStatus == Common.SILA_POSTING_FAILED_LOCAL)
            {
                return "Attachment failed" + detail + "." + error;
            }

            if (attachmentStatus == Common.SILA_POSTING_UNKNOWN)
            {
                return "Attachment unknown" + detail + "." + (error.Length == 0 ? " S/4 gave no clear answer." : error);
            }

            return "Attachment " + attachmentStatus.Trim() + detail + ".";
        }

        public static List<SilaTrackerFlowStepDto> Steps(
            string? poResource,
            string? poNumber,
            string? postingData,
            string? invoiceRequest,
            string? invoiceResponse,
            int? invoiceHttp,
            string? erpReference,
            string? attachmentRequest,
            string? attachmentResponse,
            int? attachmentHttp,
            string? attachmentStatus,
            string? attachmentError,
            string? fileName,
            string? fiscalYear)
        {
            string? key = SilaInvoiceAttachment.LinkedKey(erpReference, fiscalYear);
            bool posted = Succeeded(invoiceHttp is >= 200 and < 300 ? Common.SILA_POSTING_POSTED : null, erpReference)
                || !string.IsNullOrWhiteSpace(erpReference);
            string invoiceStatus = string.IsNullOrWhiteSpace(invoiceRequest)
                ? "NOT_STARTED"
                : invoiceHttp is >= 200 and < 300 ? "SUCCESS" : invoiceHttp is >= 400 ? "FAILED" : "PROCESSING";
            string attachmentStepStatus = string.IsNullOrWhiteSpace(attachmentStatus)
                ? "NOT_STARTED"
                : attachmentStatus == Common.SILA_POSTING_POSTED ? "SUCCESS"
                : attachmentStatus is Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED or Common.SILA_POSTING_FAILED_LOCAL ? "FAILED"
                : attachmentStatus == Common.SILA_POSTING_UNKNOWN ? "UNKNOWN"
                : "PROCESSING";

            return new List<SilaTrackerFlowStepDto>
            {
                new SilaTrackerFlowStepDto
                {
                    Name = STEP_PO,
                    Status = string.IsNullOrWhiteSpace(postingData) ? "NOT_STARTED" : "SUCCESS",
                    Detail = string.IsNullOrWhiteSpace(poNumber) ? SilaInvoiceLifecycle.API_GET_PO : SilaInvoiceLifecycle.API_GET_PO + " · purchase order " + poNumber.Trim(),
                    Request = PoRequest(poResource, poNumber),
                    Response = string.IsNullOrWhiteSpace(postingData) ? "PO retrieval was not stored for this invoice." : postingData
                },
                new SilaTrackerFlowStepDto
                {
                    Name = STEP_SUBMIT,
                    Status = invoiceStatus,
                    Detail = string.IsNullOrWhiteSpace(invoiceRequest) ? "The invoice was not sent." : "FIVE S4-INVOICE POSTING",
                    Request = string.IsNullOrWhiteSpace(invoiceRequest) ? "The invoice was not sent." : invoiceRequest
                },
                new SilaTrackerFlowStepDto
                {
                    Name = STEP_RESPONSE,
                    Status = invoiceStatus,
                    Detail = ResponseDetail(invoiceHttp, erpReference, posted),
                    Response = string.IsNullOrWhiteSpace(invoiceResponse) ? "No invoice response was stored." : invoiceResponse
                },
                new SilaTrackerFlowStepDto
                {
                    Name = STEP_ATTACHMENT,
                    Status = attachmentStepStatus,
                    Detail = string.IsNullOrWhiteSpace(attachmentRequest) ? "The attachment API was not called." : "API_CV_ATTACHMENT_SRV",
                    Request = string.IsNullOrWhiteSpace(attachmentRequest) ? AttachmentNotSent(key, fileName) : attachmentRequest
                },
                new SilaTrackerFlowStepDto
                {
                    Name = STEP_RESPONSE,
                    Status = attachmentStepStatus,
                    Detail = string.IsNullOrWhiteSpace(attachmentStatus)
                        ? "No attachment response was stored."
                        : AttachmentSentence(attachmentStatus, attachmentError, attachmentHttp, fileName, erpReference, fiscalYear),
                    Response = string.IsNullOrWhiteSpace(attachmentResponse)
                        ? (string.IsNullOrWhiteSpace(attachmentError) ? "Not sent." : attachmentError)
                        : attachmentResponse
                }
            };
        }

        /// <summary>The copy must not keep the source supplier-invoice id, or a later submit would repeat the posted document.</summary>
        public static string? RetargetPostingData(string? json, string invoiceNumber)
        {
            if (string.IsNullOrWhiteSpace(json) || string.IsNullOrWhiteSpace(invoiceNumber))
            {
                return null;
            }

            JsonNode? node;
            try
            {
                node = JsonNode.Parse(json);
            }
            catch (JsonException)
            {
                return null;
            }

            if (node is not JsonObject document || document["header"] is not JsonArray header)
            {
                return null;
            }

            foreach (JsonNode? field in header)
            {
                if (field is not JsonObject item)
                {
                    continue;
                }

                string? name = item["apiField"]?.ToString() ?? item["ApiField"]?.ToString();
                if (!string.Equals(name, "SupplierInvoiceIDByInvcgParty", StringComparison.Ordinal))
                {
                    continue;
                }

                if (item.ContainsKey("value"))
                {
                    item["value"] = invoiceNumber;
                }
                else if (item.ContainsKey("Value"))
                {
                    item["Value"] = invoiceNumber;
                }
                else
                {
                    item["value"] = invoiceNumber;
                }
            }

            return document.ToJsonString();
        }

        public static async Task<SilaInvoiceTrackerView> ReadAsync(
            IRepositoryWrapper repository,
            Guid buyerId,
            Guid invoiceId,
            CancellationToken cancellationToken)
        {
            Invoice? invoice = await repository.Invoice.FindFirstByConditionAsync(x => x.Id == invoiceId && x.BuyerId == buyerId && x.IsActive);
            List<InventoryErpPosting> postings = await repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == buyerId && x.ReferenceId == invoiceId && x.IsActive
                    && (x.ReferenceType == Common.SILA_REF_INVOICE || x.ReferenceType == Common.SILA_REF_INVOICE_ATTACHMENT))
                .ToListAsync(cancellationToken);
            InventoryErpPosting? invoicePosting = postings
                .Where(x => x.ReferenceType == Common.SILA_REF_INVOICE)
                .OrderByDescending(x => x.Status == Common.SILA_POSTING_POSTED)
                .ThenByDescending(x => x.DateUpdated)
                .FirstOrDefault();
            InventoryErpPosting? attachment = postings
                .Where(x => x.ReferenceType == Common.SILA_REF_INVOICE_ATTACHMENT)
                .OrderByDescending(x => x.DateUpdated)
                .FirstOrDefault();
            string? poResource = null;
            ApiIntegrationConfiguration? poApi = await repository.ApiIntegrationConfiguration.FindFirstByConditionAsync(
                x => x.BuyerId == buyerId && x.IsActive && x.Name == SilaInvoiceLifecycle.API_GET_PO);
            poResource = poApi?.ResourcePath;
            string? fiscalYear = SilaInvoicePosting.ReadFiscalYear(invoicePosting?.ErpResponsePayload);
            string? erpReference = invoicePosting?.ErpReference;
            string? message = ResultMessage(
                invoicePosting?.Status,
                erpReference,
                attachment?.Status,
                attachment?.ErrorMessage,
                attachment?.ErpHttpStatus,
                invoice?.FileName,
                fiscalYear);
            return new SilaInvoiceTrackerView
            {
                Message = message,
                ErpInvoiceId = string.IsNullOrWhiteSpace(erpReference) ? null : erpReference.Trim(),
                Steps = Steps(
                    poResource,
                    invoice?.PoNumber,
                    invoice?.PostingData,
                    invoicePosting?.ErpRequestPayload,
                    invoicePosting?.ErpResponsePayload,
                    invoicePosting?.ErpHttpStatus,
                    erpReference,
                    attachment?.ErpRequestPayload,
                    attachment?.ErpResponsePayload,
                    attachment?.ErpHttpStatus,
                    attachment?.Status,
                    attachment?.ErrorMessage,
                    invoice?.FileName,
                    fiscalYear)
            };
        }

        private static string PoRequest(string? resource, string? poNumber)
        {
            List<string> lines = new List<string> { SilaInvoiceLifecycle.API_GET_PO };
            if (!string.IsNullOrWhiteSpace(resource))
            {
                lines.Add(resource.Trim());
            }

            if (!string.IsNullOrWhiteSpace(poNumber))
            {
                lines.Add("Purchase order " + poNumber.Trim());
            }

            return string.Join('\n', lines);
        }

        private static string ResponseDetail(int? http, string? erpReference, bool posted)
        {
            if (http == null && string.IsNullOrWhiteSpace(erpReference))
            {
                return "No invoice response was stored.";
            }

            string status = http == null ? string.Empty : "HTTP " + http.Value;
            string invoice = string.IsNullOrWhiteSpace(erpReference) ? string.Empty : "SAP invoice " + erpReference.Trim();
            string joined = string.Join(". ", new[] { status, invoice }.Where(x => x.Length > 0));
            return posted && joined.Length > 0 ? joined + "." : joined.Length == 0 ? "No invoice response was stored." : joined + ".";
        }

        private static string AttachmentNotSent(string? key, string? fileName)
        {
            return "Not sent. The attachment API was not called.\n"
                + "BusinessObjectTypeName: " + SilaInvoiceLifecycle.BUSINESS_OBJECT + "\n"
                + "LinkedSAPObjectKey: " + (string.IsNullOrWhiteSpace(key) ? "—" : key) + "\n"
                + "FileName: " + (string.IsNullOrWhiteSpace(fileName) ? "—" : fileName.Trim());
        }

        private static string Trim(string value, int limit)
        {
            string flat = string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
            return flat.Length <= limit ? flat : flat[..limit];
        }
    }

    public sealed class SilaInvoiceTrackerView
    {
        public string? Message { get; init; }
        public string? ErpInvoiceId { get; init; }
        public List<SilaTrackerFlowStepDto> Steps { get; init; } = new List<SilaTrackerFlowStepDto>();
    }
}
