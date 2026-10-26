using System.Text.Json;
using Buyer.Application.Features.Commands.SendIntegrationRequest;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Attaches the invoice document URL to the S/4 supplier invoice after that invoice exists.
    /// The call is FIVE S4 - INVOICE ATTACHMENT (API_CV_ATTACHMENT_SRV). It does not post the invoice again.
    /// </summary>
    public static class SilaInvoiceAttachment
    {
        public const int MAX_ATTEMPTS = 3;
        public const string PUBLIC_BASE = "Sila:PublicDocumentBaseUrl";

        /// <summary>
        /// Legacy JSON body template — INVALID for CreateUrlAsAttachment.
        /// Runtime $metadata defines a FunctionImport; parameters must be on the URL.
        /// Sending LinkedSAPObjectKey in a JSON body yields SAP error
        /// "Invalid Function Import Parameter 'LinkedSAPObjectKey'".
        /// </summary>
        public const string DefaultRequest =
            """
            {
              "BusinessObjectTypeName": "BUS2081",
              "LinkedSAPObjectKey": "{{LinkedSAPObjectKey}}",
              "Url": "{{Url}}",
              "FileName": "{{FileName}}"
            }
            """;

        /// <summary>
        /// Exact FunctionImport parameter names from runtime
        /// /sap/opu/odata/sap/API_CV_ATTACHMENT_SRV/$metadata CreateUrlAsAttachment.
        /// There is no FileName parameter on this FunctionImport.
        /// </summary>
        public static readonly string[] FunctionImportParameters =
        {
            "HarmonizedDocumentType",
            "SAPObjectType",
            "SAPObjectNodeType",
            "SemanticObject",
            "LinkedSAPObjectKey",
            "BusinessObjectTypeName",
            "Url",
            "UrlDescription",
            "MIMEType"
        };

        /// <summary>SAP invoice number and fiscal year as strings, no separator. Preserves leading zeros.</summary>
        public static string? LinkedKey(string? sapInvoiceNumber, string? fiscalYear)
        {
            string number = Compact(sapInvoiceNumber);
            string year = Compact(fiscalYear);
            if (number.Length == 0 || year.Length == 0)
            {
                return null;
            }

            return number + year;
        }

        /// <summary>
        /// Builds CreateUrlAsAttachment FunctionImport URL from runtime $metadata.
        /// POST with empty body; Edm.String parameters as quoted OData query values.
        /// Required (non-nullable in metadata): LinkedSAPObjectKey, Url, UrlDescription, MIMEType.
        /// </summary>
        public static string FunctionImportPath(string? configuredPath, string linkedKey, string url, string urlDescription)
        {
            string path = string.IsNullOrWhiteSpace(configuredPath)
                ? SilaInvoiceLifecycle.ATTACHMENT_PATH.TrimStart('/')
                : configuredPath.Trim();
            int queryAt = path.IndexOf('?', StringComparison.Ordinal);
            if (queryAt >= 0)
            {
                path = path[..queryAt];
            }

            path = path.TrimEnd('/');
            if (!path.Contains("CreateUrlAsAttachment", StringComparison.OrdinalIgnoreCase))
            {
                int srv = path.IndexOf("API_CV_ATTACHMENT_SRV", StringComparison.OrdinalIgnoreCase);
                path = srv >= 0
                    ? path[..srv] + "API_CV_ATTACHMENT_SRV/CreateUrlAsAttachment"
                    : SilaInvoiceLifecycle.ATTACHMENT_PATH.TrimStart('/');
            }

            string description = string.IsNullOrWhiteSpace(urlDescription) ? "Invoice" : urlDescription.Trim();
            if (description.Length > 255)
            {
                description = description[..255];
            }

            // Parameter order matches runtime FunctionImport definition.
            return path
                + "?SemanticObject=''"
                + "&LinkedSAPObjectKey='" + ODataString(linkedKey) + "'"
                + "&BusinessObjectTypeName='" + ODataString(SilaInvoiceLifecycle.BUSINESS_OBJECT) + "'"
                + "&Url='" + ODataString(url) + "'"
                + "&UrlDescription='" + ODataString(description) + "'"
                + "&MIMEType='" + ODataString("text/url") + "'";
        }

        private static string ODataString(string value)
        {
            // OData V2 Edm.String FunctionImport values: single-quoted; escape ' as ''.
            return (value ?? string.Empty).Replace("'", "''", StringComparison.Ordinal);
        }

        /// <summary>An address SAP can open. Localhost, file paths and blob addresses are refused.</summary>
        public static bool Suitable(string? url)
        {
            if (string.IsNullOrWhiteSpace(url) || !Uri.TryCreate(url.Trim(), UriKind.Absolute, out Uri? uri))
            {
                return false;
            }

            if (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp)
            {
                return false;
            }

            string host = uri.IdnHost;
            return !host.Equals("localhost", StringComparison.OrdinalIgnoreCase)
                && host != "127.0.0.1"
                && host != "::1"
                && !host.EndsWith(".local", StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// The invoice file SAP should open. SharePoint when that storage is configured, otherwise the public document address.
        /// </summary>
        public static string? DocumentUrl(
            string? storage,
            string? sharePointSite,
            string? library,
            string? folder,
            string? attachmentPath,
            string? publicBase,
            Guid invoiceId,
            string? fileName)
        {
            if (string.Equals(storage?.Trim(), SilaOcrPolicy.STORAGE_SHAREPOINT, StringComparison.OrdinalIgnoreCase))
            {
                string? sharePoint = SharePointUrl(sharePointSite, library, folder, fileName);
                if (Suitable(sharePoint))
                {
                    return sharePoint;
                }
            }

            if (Suitable(attachmentPath))
            {
                return attachmentPath!.Trim();
            }

            if (!Suitable(publicBase))
            {
                return null;
            }

            return publicBase!.Trim().TrimEnd('/') + "/api/v1/buyer/sila/invoices/" + invoiceId.ToString("D") + "/file";
        }

        public static string FileNameOf(string? fileName, string? invoiceNumber)
        {
            string name = string.IsNullOrWhiteSpace(fileName) ? string.Empty : Path.GetFileName(fileName.Trim());
            if (!string.IsNullOrWhiteSpace(name))
            {
                return name.Length > 200 ? name[..200] : name;
            }

            string number = Compact(invoiceNumber);
            return number.Length == 0 ? "InvoiceReferenceLink" : "Invoice-" + number;
        }

        /// <summary>The attachment body. A template without the attachment tokens keeps the BUS2081 body.</summary>
        public static string RequestBody(string? template, string linkedKey, string url, string fileName)
        {
            string source = string.IsNullOrWhiteSpace(template) || !template.Contains("{{", StringComparison.Ordinal)
                ? DefaultRequest
                : template;
            return source
                .Replace("{{BusinessObjectTypeName}}", Escape(SilaInvoiceLifecycle.BUSINESS_OBJECT), StringComparison.Ordinal)
                .Replace("{{LinkedSAPObjectKey}}", Escape(linkedKey), StringComparison.Ordinal)
                .Replace("{{Url}}", Escape(url), StringComparison.Ordinal)
                .Replace("{{FileName}}", Escape(fileName), StringComparison.Ordinal);
        }

        public static bool BlocksResend(InventoryErpPosting? attachment)
        {
            return attachment?.Status == Common.SILA_POSTING_UNKNOWN;
        }

        public static SilaInvoiceAttachmentDto Describe(InventoryErpPosting? invoicePosting, InventoryErpPosting? attachment, Invoice invoice, string? documentUrl = null)
        {
            bool posted = invoicePosting?.Status == Common.SILA_POSTING_POSTED && !string.IsNullOrWhiteSpace(invoicePosting.ErpReference);
            string? fiscalYear = SilaInvoicePosting.ReadFiscalYear(invoicePosting?.ErpResponsePayload);
            string? key = LinkedKey(invoicePosting?.ErpReference, fiscalYear);
            string fileName = FileNameOf(invoice.FileName, invoice.InvoiceNumber);
            string status = ScreenStatus(posted, attachment);
            string? url = Suitable(documentUrl) ? documentUrl!.Trim() : null;
            return new SilaInvoiceAttachmentDto
            {
                BusinessObject = SilaInvoiceLifecycle.BUSINESS_OBJECT_LABEL,
                BusinessObjectType = SilaInvoiceLifecycle.BUSINESS_OBJECT,
                LinkedSapObjectKey = key,
                FileName = fileName,
                Url = url,
                HttpStatus = attachment?.ErpHttpStatus,
                Status = status,
                LastAttempt = attachment == null ? null : attachment.PostedOn ?? attachment.DateUpdated,
                Message = ScreenMessage(status, attachment, url),
                CanReprocess = posted && status is "Failed" or "Pending"
            };
        }

        /// <summary>Runs after the invoice posting has been stored and finalized. A failure here leaves that posting successful.</summary>
        public static async Task AfterInvoiceAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IMediator mediator,
            string? publicBase,
            InventoryErpPosting invoicePosting,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (invoicePosting.ReferenceType != Common.SILA_REF_INVOICE || invoicePosting.Status != Common.SILA_POSTING_POSTED)
            {
                return;
            }

            Invoice? invoice = await repository.Invoice.FindFirstByConditionAsync(x => x.Id == invoicePosting.ReferenceId && x.BuyerId == invoicePosting.BuyerId && x.IsActive);
            if (invoice == null)
            {
                return;
            }

            InventoryErpPosting? attachment = await FindAsync(repository, invoice, cancellationToken);
            if (attachment != null && (attachment.Status == Common.SILA_POSTING_POSTED || BlocksResend(attachment) || attachment.Status == Common.SILA_POSTING_FAILED))
            {
                return;
            }

            await SendAsync(repository, logger, mediator, publicBase, invoice, invoicePosting, attachment, userId, cancellationToken);
        }

        /// <summary>The pending job and Reprocess Attachment. Sends only the attachment API.</summary>
        public static async Task SendPendingAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IMediator mediator,
            string? publicBase,
            InventoryErpPosting attachment,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (attachment.ReferenceType != Common.SILA_REF_INVOICE_ATTACHMENT || attachment.Status != Common.SILA_POSTING_PENDING)
            {
                return;
            }

            if (SilaTrackerRules.ErpAlreadyAccepted(attachment))
            {
                await FinishLocalAsync(repository, logger, attachment, cancellationToken);
                return;
            }

            Invoice? invoice = await repository.Invoice.FindFirstByConditionAsync(x => x.Id == attachment.ReferenceId && x.BuyerId == attachment.BuyerId && x.IsActive);
            InventoryErpPosting? invoicePosting = invoice?.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId.Value);
            if (invoice == null || invoicePosting == null || invoicePosting.Status != Common.SILA_POSTING_POSTED || string.IsNullOrWhiteSpace(invoicePosting.ErpReference))
            {
                await FailAsync(repository, logger, attachment, "The supplier invoice is not posted in S/4, so the attachment was not sent.");
                return;
            }

            await SendAsync(repository, logger, mediator, publicBase, invoice, invoicePosting, attachment, userId, cancellationToken);
        }

        /// <summary>Reprocess Attachment. Does not read the purchase order, post the invoice, or repeat the goods receipt.</summary>
        public static async Task ReprocessAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IMediator mediator,
            string? publicBase,
            Invoice invoice,
            Guid userId,
            CancellationToken cancellationToken)
        {
            InventoryErpPosting? invoicePosting = invoice.ErpPostingId == null
                ? null
                : await repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == invoice.ErpPostingId.Value && x.BuyerId == invoice.BuyerId);
            if (invoicePosting == null || invoicePosting.Status != Common.SILA_POSTING_POSTED || string.IsNullOrWhiteSpace(invoicePosting.ErpReference))
            {
                throw new BadRequestCustomException(
                    "Attachment cannot be reprocessed.",
                    "The supplier invoice is not posted in S/4. Reprocess Attachment does not post the invoice.");
            }

            InventoryErpPosting? attachment = await FindAsync(repository, invoice, cancellationToken);
            if (BlocksResend(attachment))
            {
                throw new BadRequestCustomException(
                    "Reconcile the attachment.",
                    "S/4 did not confirm whether the link was created. Reconcile the attachment before it is sent again.");
            }

            if (attachment?.Status == Common.SILA_POSTING_POSTED)
            {
                throw new BadRequestCustomException("Nothing to reprocess.", "This document is already attached in S/4.");
            }

            if (attachment != null && SilaTrackerRules.ErpAlreadyAccepted(attachment))
            {
                await FinishLocalAsync(repository, logger, attachment, cancellationToken);
                return;
            }

            // Keep a terminal failed attempt. Start a new InventoryErpPosting row for Attempt N+1.
            if (attachment != null && attachment.Status is Common.SILA_POSTING_FAILED
                or Common.SILA_POSTING_SKIPPED or Common.SILA_POSTING_FAILED_LOCAL)
            {
                InventoryErpPosting next = await CreateAsync(repository, invoice, invoicePosting, userId, cancellationToken, forceNew: true);
                await SendAsync(repository, logger, mediator, publicBase, invoice, invoicePosting, next, userId, cancellationToken);
                return;
            }

            if (attachment != null)
            {
                attachment.Status = Common.SILA_POSTING_PENDING;
                attachment.ErrorMessage = null;
                repository.InventoryErpPosting.Update(attachment);
                await repository.SaveAsync();
            }

            await SendAsync(repository, logger, mediator, publicBase, invoice, invoicePosting, attachment, userId, cancellationToken);
        }

        private static async Task SendAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IMediator mediator,
            string? publicBase,
            Invoice invoice,
            InventoryErpPosting invoicePosting,
            InventoryErpPosting? attachment,
            Guid userId,
            CancellationToken cancellationToken)
        {
            if (attachment?.Status == Common.SILA_POSTING_POSTED || BlocksResend(attachment))
            {
                return;
            }

            if (attachment != null && SilaTrackerRules.ErpAlreadyAccepted(attachment))
            {
                await FinishLocalAsync(repository, logger, attachment, cancellationToken);
                return;
            }

            string? fiscalYear = SilaInvoicePosting.ReadFiscalYear(invoicePosting.ErpResponsePayload);
            string? linkedKey = LinkedKey(invoicePosting.ErpReference, fiscalYear);
            attachment ??= await CreateAsync(repository, invoice, invoicePosting, userId, cancellationToken);
            if (linkedKey == null)
            {
                await FailAsync(repository, logger, attachment, "The SAP supplier invoice number and fiscal year must both be stored before the attachment can be sent.");
                return;
            }

            BuyerBusinessProfile? buyer = await repository.BuyerBusinessProfile.FindFirstByConditionAsync(x => x.Id == invoice.BuyerId);
            if (buyer == null)
            {
                await FailAsync(repository, logger, attachment, "The buyer of this invoice no longer exists.");
                return;
            }

            ApiIntegrationConfiguration? configuration = await ResolveAsync(repository, buyer, invoicePosting.CompanyCode, cancellationToken);
            if (configuration == null)
            {
                await FailAsync(repository, logger, attachment, "No active " + SilaInvoiceLifecycle.API_ATTACHMENT + " API is configured. Activate it under Integrations.");
                return;
            }

            SilaOcrConfiguration settings = await SilaOcrSettings.GetAsync(repository, invoice.BuyerId, cancellationToken);
            string fileName = FileNameOf(invoice.FileName, invoice.InvoiceNumber);
            string? url = DocumentUrl(
                SilaOcrPolicy.AttachmentStorage(settings),
                settings.SharePointSiteUrl,
                settings.SharePointLibrary,
                settings.SharePointFolder,
                settings.AttachmentPath,
                publicBase,
                invoice.Id,
                fileName);
            if (!Suitable(url))
            {
                await FailAsync(repository, logger, attachment, "The invoice document has no external address that S/4 can open. Configure SharePoint or a public document address. A localhost address is not sent.");
                return;
            }

            // Function import: params on the URL; empty body (JSON body causes Invalid Function Import Parameter).
            string functionPath = FunctionImportPath(configuration.ResourcePath, linkedKey, url!, fileName);
            attachment.IntegrationSystem = configuration.Name;
            attachment.ErpRequestPayload = SilaErpPayload.Sanitise(functionPath);
            attachment.CompanyCode = invoicePosting.CompanyCode;
            attachment.Status = Common.SILA_POSTING_PENDING;
            repository.InventoryErpPosting.Update(attachment);
            await repository.SaveAsync();

            IntegrationSendResultDto sent;
            try
            {
                sent = await mediator.Send(new SendIntegrationRequestCommand
                {
                    OrganizationId = buyer.OrganizationId,
                    ConfigurationId = configuration.Id,
                    Body = string.Empty,
                    ResourcePathOverride = functionPath,
                    Headers = new Dictionary<string, string>
                    {
                        [Common.IDEMPOTENCY_HEADER] = attachment.Id.ToString(),
                        ["X-Correlation-Id"] = attachment.Id.ToString()
                    }
                }, cancellationToken);
            }
            catch (BaseCustomException exception)
            {
                logger.LogError($"Invoice attachment was not sent. InvoiceId: {invoice.Id}, HttpStatus: {exception.Code}");
                sent = new IntegrationSendResultDto
                {
                    Answered = false,
                    StatusCode = exception.Code,
                    ErrorCode = "INTEGRATION_REFUSED",
                    ErrorMessage = "The API is not active. Activate it under Integrations."
                };
            }

            attachment.ErpHttpStatus = sent.Answered ? sent.StatusCode : null;
            attachment.ErpResponsePayload = SilaErpPayload.Sanitise(sent.ResponseBody);
            bool succeeded = sent.Answered && sent.StatusCode >= 200 && sent.StatusCode < 300;
            if (succeeded)
            {
                attachment.ErpReference = linkedKey;
                attachment.PostedOn = DateTime.UtcNow;
                attachment.Status = Common.SILA_POSTING_ERP_ACCEPTED;
                attachment.ErrorMessage = null;
                repository.InventoryErpPosting.Update(attachment);
                await repository.SaveAsync();
                await FinishLocalAsync(repository, logger, attachment, cancellationToken);
                logger.LogInfo($"Invoice attachment stored in S/4. InvoiceId: {invoice.Id}, LinkedSAPObjectKey: {linkedKey}");
                return;
            }

            string error = sent.Answered
                ? "S/4 returned HTTP " + sent.StatusCode + "." + Snippet(sent.ResponseBody)
                : sent.ErrorMessage ?? "S/4 could not be reached.";
            if (sent.OutcomeUnknown)
            {
                attachment.Attempts++;
                attachment.Status = Common.SILA_POSTING_UNKNOWN;
                attachment.ErrorMessage = Trim(error + " S/4 gave no clear answer. Reconcile the attachment before it is sent again.");
                repository.InventoryErpPosting.Update(attachment);
                await repository.SaveAsync();
                logger.LogError($"Invoice attachment outcome unknown. InvoiceId: {invoice.Id}, StatusCode: {sent.StatusCode}");
                return;
            }

            attachment.Attempts++;
            attachment.Status = attachment.Attempts >= MAX_ATTEMPTS ? Common.SILA_POSTING_FAILED : Common.SILA_POSTING_PENDING;
            attachment.ErrorMessage = Trim(error);
            repository.InventoryErpPosting.Update(attachment);
            await repository.SaveAsync();
            logger.LogError($"Invoice attachment was not accepted. InvoiceId: {invoice.Id}, Attempts: {attachment.Attempts}, StatusCode: {sent.StatusCode}");
        }

        /// <summary>
        /// Uses the attachment API the organization already saved. A missing row is not inserted.
        /// When only FIVE S4-INVOICE POSTING exists, that S/4 connection is reused with
        /// ResourcePathOverride set to CreateUrlAsAttachment (no second API configuration).
        /// </summary>
        private static async Task<ApiIntegrationConfiguration?> ResolveAsync(
            IRepositoryWrapper repository,
            BuyerBusinessProfile buyer,
            string? companyCode,
            CancellationToken cancellationToken)
        {
            string processType = IntegrationProcessType.SUPPLIER_INVOICE_ATTACHMENT.ToString();
            List<ApiIntegrationConfiguration> existing = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                    && (x.ProcessType == processType
                        || x.Name == SilaInvoiceLifecycle.API_ATTACHMENT
                        || x.Name == SilaInvoiceLifecycle.API_ATTACHMENT_LEGACY
                        || (x.ResourcePath != null && x.ResourcePath.Contains(SilaInvoiceLifecycle.ATTACHMENT_SERVICE))))
                .ToListAsync(cancellationToken);
            ApiIntegrationConfiguration? match = Match(existing, companyCode);
            if (match != null && match.Status == IntegrationConfigurationStatus.ACTIVE)
            {
                return match;
            }

            // Same S/4 host and credentials as invoice posting; FunctionImport path is applied per call.
            string invoiceProcess = IntegrationProcessType.POST_INVOICE.ToString();
            List<ApiIntegrationConfiguration> invoiceApis = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                    && (x.ProcessType == invoiceProcess || x.Name == SilaInvoiceLifecycle.API_INVOICE))
                .ToListAsync(cancellationToken);
            ApiIntegrationConfiguration? invoice = Match(invoiceApis, companyCode);
            return invoice != null && invoice.Status == IntegrationConfigurationStatus.ACTIVE ? invoice : null;
        }

        private static ApiIntegrationConfiguration? Match(List<ApiIntegrationConfiguration> configurations, string? companyCode)
        {
            if (!string.IsNullOrWhiteSpace(companyCode))
            {
                ApiIntegrationConfiguration? exact = configurations.FirstOrDefault(x => x.EntityCode.Equals(companyCode, StringComparison.OrdinalIgnoreCase));
                if (exact != null)
                {
                    return exact;
                }
            }

            return configurations.FirstOrDefault(x => x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase))
                ?? configurations.OrderBy(x => x.DateCreated).FirstOrDefault();
        }

        private static async Task<InventoryErpPosting?> FindAsync(IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            return await repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == invoice.BuyerId && x.IsActive
                    && x.ReferenceType == Common.SILA_REF_INVOICE_ATTACHMENT && x.ReferenceId == invoice.Id)
                .OrderByDescending(x => x.DateCreated)
                .FirstOrDefaultAsync(cancellationToken);
        }

        private static async Task<InventoryErpPosting> CreateAsync(
            IRepositoryWrapper repository,
            Invoice invoice,
            InventoryErpPosting invoicePosting,
            Guid userId,
            CancellationToken cancellationToken,
            bool forceNew = false)
        {
            if (!forceNew)
            {
                InventoryErpPosting? existing = await FindAsync(repository, invoice, cancellationToken);
                if (existing != null)
                {
                    return existing;
                }
            }

            DateTime now = DateTime.UtcNow;
            InventoryErpPosting created = new InventoryErpPosting
            {
                Id = Guid.NewGuid(),
                BuyerId = invoice.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE_ATTACHMENT,
                ReferenceId = invoice.Id,
                ReferenceNumber = string.IsNullOrWhiteSpace(invoice.InvoiceNumber) ? invoice.FileName : invoice.InvoiceNumber.Trim(),
                LocationId = invoicePosting.LocationId,
                MovementType = Common.SILA_MOVEMENT_INVOICE_ATTACHMENT,
                Status = Common.SILA_POSTING_PENDING,
                CompanyCode = invoicePosting.CompanyCode,
                IntegrationSystem = SilaInvoiceLifecycle.API_ATTACHMENT,
                IsActive = true,
                DateCreated = now,
                DateUpdated = now,
                CreatedBy = userId,
                UpdatedBy = userId
            };
            repository.InventoryErpPosting.Create(created);
            await repository.SaveAsync();
            return created;
        }

        private static async Task FinishLocalAsync(IRepositoryWrapper repository, ILoggerManager logger, InventoryErpPosting attachment, CancellationToken cancellationToken)
        {
            _ = cancellationToken;
            if (attachment.Status == Common.SILA_POSTING_POSTED)
            {
                return;
            }

            attachment.Status = Common.SILA_POSTING_POSTED;
            attachment.ErrorMessage = null;
            attachment.PostedOn ??= DateTime.UtcNow;
            repository.InventoryErpPosting.Update(attachment);
            try
            {
                await repository.SaveAsync();
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                logger.LogError($"Invoice attachment local finalization failed. PostingId: {attachment.Id}, Error: {SilaLogText.Short(exception.Message)}");
                attachment.Status = Common.SILA_POSTING_FAILED_LOCAL;
                attachment.ErrorMessage = SilaTrackerRules.LocalFailureMessage(attachment.ErpReference);
                try
                {
                    await repository.SaveAsync();
                }
                catch (Exception saveException) when (saveException is not OperationCanceledException)
                {
                    logger.LogError($"Invoice attachment local failure could not be saved. PostingId: {attachment.Id}, Error: {SilaLogText.Short(saveException.Message)}");
                }
            }
        }

        private static async Task FailAsync(IRepositoryWrapper repository, ILoggerManager logger, InventoryErpPosting attachment, string message)
        {
            attachment.Attempts++;
            attachment.Status = Common.SILA_POSTING_FAILED;
            attachment.ErrorMessage = Trim(message);
            repository.InventoryErpPosting.Update(attachment);
            await repository.SaveAsync();
            logger.LogError($"Invoice attachment stopped. PostingId: {attachment.Id}, Error: {SilaLogText.Short(message)}");
        }

        private static string ScreenStatus(bool invoicePosted, InventoryErpPosting? attachment)
        {
            if (!invoicePosted)
            {
                return "Not started";
            }

            return attachment?.Status switch
            {
                null => "Pending",
                Common.SILA_POSTING_POSTED => "Success",
                Common.SILA_POSTING_FAILED or Common.SILA_POSTING_SKIPPED or Common.SILA_POSTING_FAILED_LOCAL => "Failed",
                Common.SILA_POSTING_UNKNOWN => "Unknown",
                Common.SILA_POSTING_PENDING when attachment.Attempts > 0 => "Processing",
                Common.SILA_POSTING_ERP_ACCEPTED => "Processing",
                _ => "Pending"
            };
        }

        private static string? ScreenMessage(string status, InventoryErpPosting? attachment, string? url)
        {
            if (status == "Pending" && !string.IsNullOrWhiteSpace(url))
            {
                return "Attachment path updated. The attachment API has not been called.";
            }

            if (status == "Success")
            {
                int? http = attachment?.ErpHttpStatus;
                return http is >= 200 and < 300
                    ? "Updated successfully. HTTP " + http.Value + "."
                    : "Updated successfully.";
            }

            return MessageOf(status, attachment);
        }

        private static string? MessageOf(string status, InventoryErpPosting? attachment)
        {
            if (status == "Success")
            {
                return "Updated successfully.";
            }

            if (status == "Unknown")
            {
                return attachment?.ErrorMessage ?? "S/4 gave no clear answer. Reconcile the attachment before it is sent again.";
            }

            return string.IsNullOrWhiteSpace(attachment?.ErrorMessage) ? null : attachment.ErrorMessage;
        }

        private static string? SharePointUrl(string? site, string? library, string? folder, string? fileName)
        {
            if (!Suitable(site))
            {
                return null;
            }

            List<string> parts = new List<string>();
            if (!string.IsNullOrWhiteSpace(library))
            {
                parts.Add(Uri.EscapeDataString(library.Trim()));
            }

            if (!string.IsNullOrWhiteSpace(folder))
            {
                parts.Add(Uri.EscapeDataString(folder.Trim()));
            }

            string name = string.IsNullOrWhiteSpace(fileName) ? string.Empty : Path.GetFileName(fileName.Trim());
            if (name.Length > 0)
            {
                parts.Add(Uri.EscapeDataString(name));
            }

            return site!.Trim().TrimEnd('/') + (parts.Count == 0 ? string.Empty : "/" + string.Join("/", parts));
        }

        private static string Compact(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return string.Empty;
            }

            return string.Concat(value.Where(character => !char.IsWhiteSpace(character)));
        }

        private static string Escape(string value)
        {
            string encoded = JsonSerializer.Serialize(value);
            return encoded.Length >= 2 ? encoded[1..^1] : encoded;
        }

        private static string Snippet(string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return string.Empty;
            }

            string text = body.Trim().Replace('\r', ' ').Replace('\n', ' ');
            return " " + (text.Length > 240 ? text[..240] : text);
        }

        private static string Trim(string message)
        {
            return message.Length > 1000 ? message[..1000] : message;
        }
    }
}
