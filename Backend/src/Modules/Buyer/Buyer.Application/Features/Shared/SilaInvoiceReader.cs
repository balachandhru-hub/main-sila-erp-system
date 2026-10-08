using System.Net.Http.Headers;
using System.Text.Json;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Microsoft.Extensions.Configuration;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Reads an invoice file with the built-in OCR service (python-backend POST /ocr/invoice). The external provider is
    /// read by <see cref="SilaInvoiceExternalReader"/>. A reading that finds nothing is a failure with a message for the
    /// user, not an error; an OCR service that cannot be reached is a 424.
    /// </summary>
    public static class SilaInvoiceReader
    {
        private const string OCR_ROUTE = "ocr/invoice";
        private const string ERROR_TESSERACT_MISSING = "TESSERACT_MISSING";
        private const string DOCUMENT_DIGITAL_TEXT = "DIGITAL_TEXT";

        private static readonly JsonSerializerOptions JsonOptions = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };

        /// <summary>The outcome of one reading: the result, or why nothing was read; and how it was read.</summary>
        public sealed class Reading
        {
            public SilaInvoiceOcrResultDto? Result { get; set; }
            public string? Failure { get; set; }
            public string Method { get; set; } = SilaOcrSettings.METHOD_OCR;

            /// <summary>The reader could not be reached: recorded as a failed reading, then answered with 424.</summary>
            public bool Unreachable { get; set; }
        }

        public static async Task<Reading> ReadBuiltInAsync(
            IHttpClientFactory httpClientFactory, IConfiguration configuration, ILoggerManager logger, Invoice invoice, byte[] content, CancellationToken cancellationToken,
            int timeoutSeconds = 0)
        {
            HttpClient client = httpClientFactory.CreateClient(Common.HTTP_CLIENT_OCR);
            string? baseUrl = configuration[Common.OCR_SERVICE_URL];
            if (client.BaseAddress == null && !string.IsNullOrWhiteSpace(baseUrl))
            {
                client.BaseAddress = new Uri(baseUrl.EndsWith('/') ? baseUrl : baseUrl + "/");
            }

            if (client.BaseAddress == null)
            {
                logger.LogError("OCR service URL is not configured. Key: InterCallService:OcrUrl");
                throw new FailedDependencyCustomException("The OCR service is not configured.", "Ask your administrator to configure the OCR service URL.");
            }

            using MultipartFormDataContent form = new MultipartFormDataContent();
            ByteArrayContent fileContent = new ByteArrayContent(content);
            fileContent.Headers.ContentType = new MediaTypeHeaderValue(SilaReceivingRules.InvoiceContentType(invoice.FileName) ?? "application/octet-stream");
            form.Add(fileContent, "file", invoice.FileName);

            // The reader timeout of the OCR policy: a call that runs longer counts as unreachable (and may be retried).
            using CancellationTokenSource timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            if (timeoutSeconds > 0)
            {
                timeout.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));
            }

            HttpResponseMessage response;
            string body;
            try
            {
                response = await client.PostAsync(OCR_ROUTE, form, timeout.Token);
                body = await response.Content.ReadAsStringAsync(timeout.Token);
            }
            catch (Exception exception) when (exception is HttpRequestException || (exception is OperationCanceledException && !cancellationToken.IsCancellationRequested))
            {
                logger.LogError($"OCR service is not reachable. InvoiceId: {invoice.Id}, Error: {SilaLogText.Short(exception.Message)}");
                return new Reading { Unreachable = true, Failure = "The OCR service could not be reached. Try again later, or type the invoice fields yourself." };
            }

            using (response)
            {
                SilaInvoiceOcrResultDto? result = Parse(logger, body);
                if (!response.IsSuccessStatusCode)
                {
                    logger.LogError($"OCR service could not read the invoice. InvoiceId: {invoice.Id}, StatusCode: {(int)response.StatusCode}, Error: {SilaLogText.Short(result?.Error)}");
                    return new Reading
                    {
                        Failure = result?.Error == ERROR_TESSERACT_MISSING
                            ? "The OCR engine (Tesseract) is not installed on the OCR service. Type the invoice fields yourself."
                            : result?.Message ?? $"The OCR service could not read the invoice (HTTP {(int)response.StatusCode}). Type the invoice fields yourself."
                    };
                }

                if (result == null || (string.IsNullOrWhiteSpace(result.Text) && result.Fields == null))
                {
                    logger.LogError($"OCR service returned no text. InvoiceId: {invoice.Id}");
                    return new Reading { Failure = "No text could be read from the invoice. Type the invoice fields yourself." };
                }

                return new Reading
                {
                    Result = result,
                    Method = result.DocumentType == DOCUMENT_DIGITAL_TEXT ? SilaOcrSettings.METHOD_PDF_TEXT : SilaOcrSettings.METHOD_OCR
                };
            }
        }

        private static SilaInvoiceOcrResultDto? Parse(ILoggerManager logger, string body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                return JsonSerializer.Deserialize<SilaInvoiceOcrResultDto>(body, JsonOptions);
            }
            catch (JsonException exception)
            {
                logger.LogError($"OCR answer is not valid JSON. Error: {SilaLogText.Short(exception.Message)}");
                return null;
            }
        }
    }
}
