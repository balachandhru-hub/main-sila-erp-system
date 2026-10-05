using System.Diagnostics;
using System.Text.Json;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ExtractSilaInvoice
{
    public class ExtractSilaInvoiceCommandHandler : IRequestHandler<ExtractSilaInvoiceCommand, SilaInvoiceDetailDto>
    {
        private const int MESSAGE_LIMIT = 1000;
        private const string PROVIDER_CACHED = "CACHED";
        private static readonly string[] Triggers = { SilaOcrSettings.TRIGGER_UPLOAD, SilaOcrSettings.TRIGGER_MANUAL, SilaOcrSettings.TRIGGER_REREAD };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly IConfiguration _configuration;
        private readonly IMediator _mediator;

        public ExtractSilaInvoiceCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IHttpClientFactory httpClientFactory,
            IConfiguration configuration,
            IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _httpClientFactory = httpClientFactory;
            _configuration = configuration;
            _mediator = mediator;
        }

        public async Task<SilaInvoiceDetailDto> Handle(ExtractSilaInvoiceCommand request, CancellationToken cancellationToken)
        {
            string trigger = (request.Trigger ?? SilaOcrSettings.TRIGGER_MANUAL).Trim().ToUpperInvariant();
            _logger.LogInfo($"Extracting invoice. InvoiceId: {request.InvoiceId}, Trigger: {trigger}, OrganizationId: {request.OrganizationId}");
            if (!Triggers.Contains(trigger))
            {
                _logger.LogError($"Invoice extraction trigger is invalid. Trigger: {trigger}");
                throw new BadRequestCustomException("Invalid trigger.", "Use UPLOAD, MANUAL or REREAD.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            bool reread = trigger == SilaOcrSettings.TRIGGER_REREAD;
            if (invoice.Status == Common.SILA_INVOICE_GRN_POSTED || (!reread && invoice.Status == Common.SILA_INVOICE_REVIEWED))
            {
                _logger.LogError($"Invoice cannot be read again. InvoiceId: {invoice.Id}, Status: {invoice.Status}, Trigger: {trigger}");
                throw new BadRequestCustomException(
                    "Invoice cannot be read again.",
                    invoice.Status == Common.SILA_INVOICE_GRN_POSTED
                        ? "Goods were received against this invoice; it is no longer read."
                        : "The invoice was reviewed: use Re-read, which keeps your corrections.");
            }

            string? fullPath = SilaFileRules.ResolveUnderRoot(_configuration[Common.BASE_FOLDER_PATH], invoice.FilePath);
            if (fullPath == null || !File.Exists(fullPath))
            {
                _logger.LogError($"Invoice file is missing. InvoiceId: {invoice.Id}");
                throw new NotFoundCustomException("Invoice file not found.", "The stored file of this invoice is missing. Upload the invoice again.");
            }

            byte[] content = await File.ReadAllBytesAsync(fullPath, cancellationToken);
            SilaOcrConfiguration settings = await SilaOcrSettings.GetAsync(_repository, buyer.Id, cancellationToken);
            invoice.ContentHash = SilaOcrPolicy.ContentHash(content);
            Stopwatch watch = Stopwatch.StartNew();
            (SilaInvoiceReader.Reading reading, string provider) = await ReadAsync(request.OrganizationId, buyer.Id, invoice, content, settings, reread, cancellationToken);
            watch.Stop();

            List<InvoiceExtraction> history = await _repository.InvoiceExtraction
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive)
                .OrderByDescending(x => x.Attempt)
                .ToListAsync(cancellationToken);
            InvoiceExtraction extraction = new InvoiceExtraction
            {
                Id = Guid.NewGuid(),
                InvoiceId = invoice.Id,
                Attempt = (history.FirstOrDefault()?.Attempt ?? 0) + 1,
                Trigger = trigger,
                Method = reading.Method,
                Provider = provider,
                DurationMs = (int)Math.Min(int.MaxValue, watch.ElapsedMilliseconds),
                ContentHash = invoice.ContentHash,
                IsActive = true
            };

            if (reading.Result == null)
            {
                extraction.Status = SilaOcrSettings.EXTRACTION_FAILED;
                extraction.Message = Limit(reading.Failure);

                // A reviewed invoice keeps its fields when a re-read fails.
                if (invoice.Status != Common.SILA_INVOICE_REVIEWED)
                {
                    invoice.Status = Common.SILA_INVOICE_OCR_FAILED;
                    invoice.OcrText = reading.Failure;
                    invoice.OcrConfidence = null;
                }
            }
            else
            {
                SilaInvoiceOcrFieldsDto? previous = PreviousFields(history);
                await SilaInvoiceApply.ApplyAsync(
                    _repository, invoice, buyer.Id, reading.Result, previous, reread, settings.MinimumConfidence, cancellationToken, SilaOcrPolicy.DetailedLineExtraction(settings));
                extraction.Status = SilaOcrSettings.EXTRACTION_COMPLETED;
                extraction.Confidence = reading.Result.Confidence;
                List<string> notes = PolicyWarnings(invoice, settings);
                if (reading.Result.Confidence != null && reading.Result.Confidence < settings.MinimumConfidence)
                {
                    notes.Insert(0, $"Confidence below the minimum of {settings.MinimumConfidence * 100:0} %: check every field.");
                }

                // A reading the checks do not accept is reviewed before goods are received against it.
                if (notes.Count > 0 && invoice.Status == Common.SILA_INVOICE_EXTRACTED)
                {
                    invoice.Status = SilaOcrSettings.INVOICE_REVIEW_REQUIRED;
                }

                extraction.Message = notes.Count == 0 ? null : Limit(string.Join(" ", notes));
                extraction.FieldsJson = JsonSerializer.Serialize(new SilaInvoiceOcrResultDto
                {
                    Confidence = reading.Result.Confidence,
                    Fields = reading.Result.Fields,
                    Lines = reading.Result.Lines,
                    DocumentType = reading.Result.DocumentType
                });
            }

            _repository.InvoiceExtraction.Create(extraction);
            await _repository.SaveAsync();
            if (reading.Unreachable)
            {
                _logger.LogError($"Invoice reader unreachable; failure recorded. InvoiceId: {invoice.Id}, Attempt: {extraction.Attempt}");
                throw new FailedDependencyCustomException("The invoice reader is not reachable.", reading.Failure ?? "Try again later, or type the invoice fields yourself.");
            }

            SilaInvoiceDetailDto detail = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            _logger.LogInfo($"Invoice extraction finished. InvoiceId: {invoice.Id}, Status: {invoice.Status}, Attempt: {extraction.Attempt}, Lines: {detail.Items.Count}");
            return detail;
        }

        /// <summary>
        /// Reads the file: a cached reading of an identical file when that is on (not for a re-read that must use the backend),
        /// else the configured reader (the external one falls back to the built-in one when that is on). The built-in reader
        /// runs with the configured timeout and is retried while it cannot be reached.
        /// </summary>
        private async Task<(SilaInvoiceReader.Reading Reading, string Provider)> ReadAsync(
            Guid organizationId, Guid buyerId, Invoice invoice, byte[] content, SilaOcrConfiguration settings, bool reread, CancellationToken cancellationToken)
        {
            if (SilaOcrPolicy.ReuseCachedOcr(settings) && !(reread && SilaOcrPolicy.AlwaysBackendOnReread(settings)))
            {
                SilaInvoiceReader.Reading? cached = await CachedReadingAsync(buyerId, invoice, cancellationToken);
                if (cached != null)
                {
                    _logger.LogInfo($"Invoice reading reused from an identical file. InvoiceId: {invoice.Id}");
                    return (cached, PROVIDER_CACHED);
                }
            }

            if (settings.Provider == SilaOcrSettings.PROVIDER_EXTERNAL)
            {
                SilaInvoiceReader.Reading external = await SilaInvoiceExternalReader.ReadAsync(_mediator, _repository, _logger, organizationId, invoice, content, cancellationToken);
                if (external.Result != null || !SilaOcrPolicy.AutoFallback(settings))
                {
                    return (external, SilaOcrSettings.PROVIDER_EXTERNAL);
                }

                _logger.LogInfo($"External invoice reader failed; falling back to the built-in reader. InvoiceId: {invoice.Id}");
            }

            SilaInvoiceReader.Reading reading = new SilaInvoiceReader.Reading();
            for (int attempt = 0; attempt <= SilaOcrPolicy.RetryCount(settings); attempt++)
            {
                reading = await SilaInvoiceReader.ReadBuiltInAsync(
                    _httpClientFactory, _configuration, _logger, invoice, content, cancellationToken, SilaOcrPolicy.TimeoutSeconds(settings));
                if (!reading.Unreachable)
                {
                    break;
                }
            }

            return (reading, SilaOcrSettings.PROVIDER_BUILT_IN);
        }

        /// <summary>The last completed reading of another invoice of the buyer with the same file hash, or null.</summary>
        private async Task<SilaInvoiceReader.Reading?> CachedReadingAsync(Guid buyerId, Invoice invoice, CancellationToken cancellationToken)
        {
            string? hash = invoice.ContentHash;
            List<Invoice> twins = await _repository.Invoice
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Id != invoice.Id && x.ContentHash == hash)
                .ToListAsync(cancellationToken);
            List<Guid> twinIds = twins.Select(x => x.Id).ToList();
            InvoiceExtraction? source = twinIds.Count == 0
                ? null
                : await _repository.InvoiceExtraction
                    .FindByCondition(x => twinIds.Contains(x.InvoiceId) && x.IsActive && x.Status == SilaOcrSettings.EXTRACTION_COMPLETED && x.FieldsJson != null)
                    .OrderByDescending(x => x.DateCreated)
                    .FirstOrDefaultAsync(cancellationToken);
            SilaInvoiceOcrResultDto? result = source == null ? null : SilaOcrSettings.ReadReading(source.FieldsJson);
            if (source == null || result == null)
            {
                return null;
            }

            result.Text = twins.First(x => x.Id == source.InvoiceId).OcrText;
            return new SilaInvoiceReader.Reading { Result = result, Method = source.Method };
        }

        /// <summary>The checks of the OCR policy on the applied reading: supplier and purchase order known, net + tax = gross.</summary>
        private static List<string> PolicyWarnings(Invoice invoice, SilaOcrConfiguration settings)
        {
            List<string> warnings = new List<string>();
            if (SilaOcrPolicy.SupplierValidation(settings) && invoice.SilaSupplierId == null)
            {
                warnings.Add("The supplier was not found in the Supplier Master.");
            }

            if (SilaOcrPolicy.PoValidation(settings) && invoice.PurchaseOrderId == null)
            {
                warnings.Add(invoice.PoNumber == null
                    ? "No purchase order number was read."
                    : $"Purchase order {invoice.PoNumber} is not a known purchase order.");
            }

            string? reconciliation = SilaOcrPolicy.FinancialReconciliation(settings)
                ? SilaOcrPolicy.ReconciliationWarning(invoice.NetAmount, invoice.TaxAmount, invoice.GrossAmount, SilaOcrPolicy.AmountTolerance(settings))
                : null;
            if (reconciliation != null)
            {
                warnings.Add(reconciliation);
            }

            return warnings;
        }

        // What the last successful reading found; a re-read compares the invoice with it to see what the user changed.
        private static SilaInvoiceOcrFieldsDto? PreviousFields(List<InvoiceExtraction> history)
        {
            InvoiceExtraction? last = history.FirstOrDefault(x => x.Status == SilaOcrSettings.EXTRACTION_COMPLETED && x.FieldsJson != null);
            return last == null ? null : SilaOcrSettings.ReadReading(last.FieldsJson)?.Fields;
        }

        private static string? Limit(string? message)
        {
            return message == null || message.Length <= MESSAGE_LIMIT ? message : message[..MESSAGE_LIMIT];
        }
    }
}
