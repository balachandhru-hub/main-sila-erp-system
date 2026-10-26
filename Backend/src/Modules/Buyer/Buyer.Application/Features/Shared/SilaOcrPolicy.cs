using System.Security.Cryptography;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The invoice reading policy of a buyer: the effective value of each OCR setting (a setting never saved has its
    /// default), the validation of a change, and the financial reconciliation (net + tax = gross within the tolerance).
    /// </summary>
    public static class SilaOcrPolicy
    {
        public const decimal DEFAULT_AMOUNT_TOLERANCE = 0.05m;
        public const int DEFAULT_TIMEOUT_SECONDS = 60;
        public const int DEFAULT_RETRY_COUNT = 1;
        public const int MAX_TIMEOUT_SECONDS = 600;
        public const int MAX_RETRY_COUNT = 5;
        public const decimal MAX_AMOUNT_TOLERANCE = 1000m;

        /// <summary>Invoice files stay in the application's local folder.</summary>
        public const string STORAGE_LOCAL = "LOCAL";

        /// <summary>A folder path recorded on the OCR settings. Files still stay on the local downloads path.</summary>
        public const string STORAGE_FILE_PATH = "FILE_PATH";

        /// <summary>A SharePoint site and library recorded on the OCR settings. Files still stay on the local downloads path.</summary>
        public const string STORAGE_SHAREPOINT = "SHAREPOINT";

        public const int MAX_ATTACHMENT_PATH = 1000;
        public const int MAX_SHAREPOINT_SITE = 2000;
        public const int MAX_SHAREPOINT_LIBRARY = 200;
        public const int MAX_SHAREPOINT_FOLDER = 400;

        public static decimal AmountTolerance(SilaOcrConfiguration settings) => settings.AmountTolerance ?? DEFAULT_AMOUNT_TOLERANCE;

        public static int TimeoutSeconds(SilaOcrConfiguration settings) => settings.BackendTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS;

        public static int RetryCount(SilaOcrConfiguration settings) => settings.BackendRetryCount ?? DEFAULT_RETRY_COUNT;

        public static bool AutoFallback(SilaOcrConfiguration settings) => settings.AutoFallback ?? true;

        public static bool AlwaysBackendOnReread(SilaOcrConfiguration settings) => settings.AlwaysBackendOnReread ?? true;

        public static bool DetailedLineExtraction(SilaOcrConfiguration settings) => settings.DetailedLineExtraction ?? true;

        public static bool SupplierValidation(SilaOcrConfiguration settings) => settings.SupplierValidation ?? false;

        public static bool PoValidation(SilaOcrConfiguration settings) => settings.PoValidation ?? false;

        public static bool FinancialReconciliation(SilaOcrConfiguration settings) => settings.FinancialReconciliation ?? true;

        public static bool ReuseCachedOcr(SilaOcrConfiguration settings) => settings.ReuseCachedOcr ?? false;

        /// <summary>LOCAL when nothing else was saved.</summary>
        public static string AttachmentStorage(SilaOcrConfiguration settings)
        {
            string mode = (settings.AttachmentStorage ?? string.Empty).Trim().ToUpperInvariant();
            return mode is STORAGE_FILE_PATH or STORAGE_SHAREPOINT ? mode : STORAGE_LOCAL;
        }

        /// <summary>
        /// The folder an invoice file is written to. SharePoint and a custom file path are kept on the settings;
        /// the file stays on the local downloads path.
        /// </summary>
        public static string? AttachmentWriteRoot(SilaOcrConfiguration settings, string? localBasePath)
        {
            _ = settings;
            return string.IsNullOrWhiteSpace(localBasePath) ? null : localBasePath;
        }

        /// <summary>Checks the ranges of a change and writes it (a field sent as null keeps its saved value).</summary>
        public static void Apply(ILoggerManager logger, SilaOcrConfiguration settings, SilaOcrConfigurationWriteDto input)
        {
            if (input.AmountTolerance != null && (input.AmountTolerance < 0 || input.AmountTolerance > MAX_AMOUNT_TOLERANCE))
            {
                logger.LogError($"OCR amount tolerance out of range. AmountTolerance: {input.AmountTolerance}");
                throw new BadRequestCustomException("Invalid amount tolerance.", $"Enter an amount tolerance between 0 and {MAX_AMOUNT_TOLERANCE:0} (for example 0.05).");
            }

            if (input.BackendTimeoutSeconds != null && (input.BackendTimeoutSeconds < 1 || input.BackendTimeoutSeconds > MAX_TIMEOUT_SECONDS))
            {
                logger.LogError($"OCR timeout out of range. BackendTimeoutSeconds: {input.BackendTimeoutSeconds}");
                throw new BadRequestCustomException("Invalid timeout.", $"Enter a reader timeout between 1 and {MAX_TIMEOUT_SECONDS} seconds.");
            }

            if (input.BackendRetryCount != null && (input.BackendRetryCount < 0 || input.BackendRetryCount > MAX_RETRY_COUNT))
            {
                logger.LogError($"OCR retry count out of range. BackendRetryCount: {input.BackendRetryCount}");
                throw new BadRequestCustomException("Invalid retry count.", $"Enter between 0 and {MAX_RETRY_COUNT} retries.");
            }

            settings.AmountTolerance = input.AmountTolerance == null ? settings.AmountTolerance : Math.Round(input.AmountTolerance.Value, 4);
            settings.BackendTimeoutSeconds = input.BackendTimeoutSeconds ?? settings.BackendTimeoutSeconds;
            settings.BackendRetryCount = input.BackendRetryCount ?? settings.BackendRetryCount;
            settings.AutoFallback = input.AutoFallback ?? settings.AutoFallback;
            settings.AlwaysBackendOnReread = input.AlwaysBackendOnReread ?? settings.AlwaysBackendOnReread;
            settings.DetailedLineExtraction = input.DetailedLineExtraction ?? settings.DetailedLineExtraction;
            settings.SupplierValidation = input.SupplierValidation ?? settings.SupplierValidation;
            settings.PoValidation = input.PoValidation ?? settings.PoValidation;
            settings.FinancialReconciliation = input.FinancialReconciliation ?? settings.FinancialReconciliation;
            settings.ReuseCachedOcr = input.ReuseCachedOcr ?? settings.ReuseCachedOcr;
            ApplyAttachment(logger, settings, input);
        }

        /// <summary>Stores the attachment destination. A missing storage value keeps the saved choice.</summary>
        public static void ApplyAttachment(ILoggerManager logger, SilaOcrConfiguration settings, SilaOcrConfigurationWriteDto input)
        {
            if (input.AttachmentStorage == null && input.AttachmentPath == null && input.SharePointSiteUrl == null
                && input.SharePointLibrary == null && input.SharePointFolder == null)
            {
                return;
            }

            string mode = string.IsNullOrWhiteSpace(input.AttachmentStorage)
                ? AttachmentStorage(settings)
                : input.AttachmentStorage.Trim().ToUpperInvariant();
            if (mode != STORAGE_LOCAL && mode != STORAGE_FILE_PATH && mode != STORAGE_SHAREPOINT)
            {
                logger.LogError($"Invoice attachment storage is invalid. AttachmentStorage: {mode}");
                throw new BadRequestCustomException("Invalid attachment storage.", "Choose the local downloads path, a file path, or SharePoint.");
            }

            string? path = Trimmed(input.AttachmentPath, MAX_ATTACHMENT_PATH);
            string? site = Trimmed(input.SharePointSiteUrl, MAX_SHAREPOINT_SITE);
            string? library = Trimmed(input.SharePointLibrary, MAX_SHAREPOINT_LIBRARY);
            string? folder = Trimmed(input.SharePointFolder, MAX_SHAREPOINT_FOLDER);
            if (mode == STORAGE_FILE_PATH && path == null)
            {
                logger.LogError("Invoice attachment file path is missing.");
                throw new BadRequestCustomException("File path is required.", "Enter the folder where invoice files should be kept.");
            }

            if (mode == STORAGE_SHAREPOINT)
            {
                if (site == null || !Uri.TryCreate(site, UriKind.Absolute, out Uri? siteUri)
                    || (siteUri.Scheme != Uri.UriSchemeHttps && siteUri.Scheme != Uri.UriSchemeHttp)
                    || !string.IsNullOrEmpty(siteUri.UserInfo))
                {
                    logger.LogError("SharePoint site URL is invalid.");
                    throw new BadRequestCustomException("SharePoint site is required.", "Enter the SharePoint site URL, for example https://tenant.sharepoint.com/sites/finance.");
                }

                if (library == null)
                {
                    logger.LogError("SharePoint library is missing.");
                    throw new BadRequestCustomException("SharePoint library is required.", "Enter the document library that will hold the invoice files.");
                }

                site = siteUri.ToString().TrimEnd('/');
            }

            settings.AttachmentStorage = mode;
            settings.AttachmentPath = path;
            settings.SharePointSiteUrl = site;
            settings.SharePointLibrary = library;
            settings.SharePointFolder = folder;
        }

        private static string? Trimmed(string? value, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            string text = value.Trim();
            if (text.Length > maxLength || text.Any(character => char.IsControl(character)))
            {
                throw new BadRequestCustomException("Attachment location is too long.", "Shorten the attachment location and save again.");
            }

            return text;
        }

        /// <summary>Copies the effective settings onto the answer.</summary>
        public static void Fill(SilaOcrConfigurationDto dto, SilaOcrConfiguration settings, string? localBasePath = null)
        {
            dto.AmountTolerance = AmountTolerance(settings);
            dto.BackendTimeoutSeconds = TimeoutSeconds(settings);
            dto.BackendRetryCount = RetryCount(settings);
            dto.AutoFallback = AutoFallback(settings);
            dto.AlwaysBackendOnReread = AlwaysBackendOnReread(settings);
            dto.DetailedLineExtraction = DetailedLineExtraction(settings);
            dto.SupplierValidation = SupplierValidation(settings);
            dto.PoValidation = PoValidation(settings);
            dto.FinancialReconciliation = FinancialReconciliation(settings);
            dto.ReuseCachedOcr = ReuseCachedOcr(settings);
            dto.AttachmentStorage = AttachmentStorage(settings);
            dto.AttachmentPath = settings.AttachmentPath;
            dto.SharePointSiteUrl = settings.SharePointSiteUrl;
            dto.SharePointLibrary = settings.SharePointLibrary;
            dto.SharePointFolder = settings.SharePointFolder;
            dto.AttachmentWritesLocally = true;
            dto.AttachmentLocalPath = AttachmentLocalFolder(localBasePath);
            dto.PrimaryOcrEnabled = SilaOcrAiProviders.PrimaryEnabled(settings);
            dto.AiFallbackEnabled = SilaOcrAiProviders.AiFallbackEnabled(settings);
            dto.Providers = SilaOcrAiProviders.Describe(settings);
        }

        /// <summary>The local downloads folder invoice files are written to, or null when file storage is not configured.</summary>
        public static string? AttachmentLocalFolder(string? localBasePath)
        {
            return string.IsNullOrWhiteSpace(localBasePath) ? null : Path.Combine(localBasePath.Trim(), Common.SILA_INVOICE_FOLDER);
        }

        /// <summary>The warning when net + tax differs from gross by more than the tolerance; null when they agree or a figure is missing.</summary>
        public static string? ReconciliationWarning(decimal? net, decimal? tax, decimal? gross, decimal tolerance)
        {
            if (net == null || tax == null || gross == null)
            {
                return null;
            }

            decimal difference = net.Value + tax.Value - gross.Value;
            return Math.Abs(difference) <= tolerance
                ? null
                : $"Net {net.Value:0.00} + tax {tax.Value:0.00} = {net.Value + tax.Value:0.00}, but the gross amount is {gross.Value:0.00} (difference {difference:0.00}). Check the amounts.";
        }

        /// <summary>SHA-256 of a file as lower-case hex.</summary>
        public static string ContentHash(byte[] content)
        {
            return Convert.ToHexString(SHA256.HashData(content)).ToLowerInvariant();
        }
    }
}
