using System.Text.Json;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Integration.Enums;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The buyer's invoice reading settings (SilaOcrConfiguration, one row per buyer) with their defaults, and the invoice
    /// statuses and extraction values the receiving use cases share.
    /// </summary>
    public static class SilaOcrSettings
    {
        public const string PROVIDER_BUILT_IN = "BUILT_IN";
        public const string PROVIDER_EXTERNAL = "EXTERNAL";
        public const decimal DEFAULT_MINIMUM_CONFIDENCE = 0.75m;

        /// <summary>Extracted, but below the minimum confidence: every field must be checked before saving.</summary>
        public const string INVOICE_REVIEW_REQUIRED = "REVIEW_REQUIRED";

        public const string TRIGGER_UPLOAD = "UPLOAD";
        public const string TRIGGER_MANUAL = "MANUAL";
        public const string TRIGGER_REREAD = "REREAD";
        public const string METHOD_PDF_TEXT = "PDF_TEXT";
        public const string METHOD_OCR = "OCR";
        public const string METHOD_EXTERNAL = "EXTERNAL";
        public const string EXTRACTION_COMPLETED = "COMPLETED";
        public const string EXTRACTION_FAILED = "FAILED";

        /// <summary>The saved settings, or the defaults (built-in reader, no automatic reading, 75 % confidence).</summary>
        public static async Task<SilaOcrConfiguration> GetAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            SilaOcrConfiguration? saved = await repository.SilaOcrConfiguration
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            return saved ?? new SilaOcrConfiguration
            {
                BuyerId = buyerId,
                Provider = PROVIDER_BUILT_IN,
                AutoExtractOnUpload = false,
                MinimumConfidence = DEFAULT_MINIMUM_CONFIDENCE
            };
        }

        /// <summary>What one reading found (stored in InvoiceExtraction.FieldsJson), or null when it cannot be read.</summary>
        public static SilaInvoiceOcrResultDto? ReadReading(string? fieldsJson)
        {
            if (string.IsNullOrWhiteSpace(fieldsJson))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<SilaInvoiceOcrResultDto>(fieldsJson);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        public static async Task<SilaOcrConfigurationDto> ToDtoAsync(IRepositoryWrapper repository, BuyerBusinessProfile buyer, SilaOcrConfiguration configuration, CancellationToken cancellationToken)
        {
            bool externalConfigured = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.OrganizationId == buyer.OrganizationId
                    && x.ProcessType == IntegrationProcessType.EXTRACT_INVOICE
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .AnyAsync(cancellationToken);
            SilaOcrConfigurationDto dto = new SilaOcrConfigurationDto
            {
                Provider = configuration.Provider,
                AutoExtractOnUpload = configuration.AutoExtractOnUpload,
                MinimumConfidence = configuration.MinimumConfidence,
                ExternalConfigured = externalConfigured,
                Saved = configuration.Id != Guid.Empty,
                UpdatedOn = configuration.Id == Guid.Empty ? null : (configuration.DateUpdated == default ? configuration.DateCreated : configuration.DateUpdated)
            };
            SilaOcrPolicy.Fill(dto, configuration);
            return dto;
        }
    }
}
