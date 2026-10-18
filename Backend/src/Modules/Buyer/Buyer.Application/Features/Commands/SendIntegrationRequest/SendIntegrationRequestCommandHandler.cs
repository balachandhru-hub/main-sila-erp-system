using System.Diagnostics;
using Buyer.Domain.Dtos;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services.Integration;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Commands.SendIntegrationRequest
{
    /// <summary>
    /// The document is built by its owner (the weekly bucket); this handler adds the saved sign-in and
    /// makes the call, once. A failed call is a result, not an error.
    /// </summary>
    public class SendIntegrationRequestCommandHandler : IRequestHandler<SendIntegrationRequestCommand, IntegrationSendResultDto>
    {
        private const int RESPONSE_LIMIT = 4000;

        // Failures after which the API may still have received the document.
        private static readonly string[] UnknownOutcomeCodes = { "REMOTE_UNAVAILABLE", "REMOTE_TIMEOUT" };
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;

        public SendIntegrationRequestCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
        }

        public async Task<IntegrationSendResultDto> Handle(SendIntegrationRequestCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Sending document to integration. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            // The attachment API is a POST. On a server whose API type is still an enum, its row is stored as a type that enum
            // already contains, so the integrations list can load. The name and the attachment path still identify the call.
            bool attachment = string.Equals(configuration.Name, SilaInvoiceLifecycle.API_ATTACHMENT, StringComparison.OrdinalIgnoreCase)
                || string.Equals(configuration.Name, SilaInvoiceLifecycle.API_ATTACHMENT_LEGACY, StringComparison.OrdinalIgnoreCase)
                || (configuration.ResourcePath?.Contains(SilaInvoiceLifecycle.ATTACHMENT_SERVICE, StringComparison.OrdinalIgnoreCase) ?? false);
            if (configuration.Status != IntegrationConfigurationStatus.ACTIVE
                || (!attachment && IntegrationProcessCatalog.Find(configuration.ProcessType)?.IsPush != true))
            {
                _logger.LogError($"Integration cannot be sent to. ConfigurationId: {configuration.Id}, Status: {configuration.Status}, ProcessType: {configuration.ProcessType}");
                throw new BadRequestCustomException("API is not active.", "Activate this API before documents are sent to it.");
            }

            IntegrationSendResultDto result = new IntegrationSendResultDto();
            Stopwatch watch = Stopwatch.StartNew();
            configuration.LastAttemptAt = DateTime.UtcNow;
            string? savedPath = configuration.ResourcePath;
            if (!string.IsNullOrWhiteSpace(request.ResourcePathOverride))
            {
                configuration.ResourcePath = request.ResourcePathOverride.Trim();
            }

            try
            {
                // Empty body = no content (OData function imports such as CreateUrlAsAttachment).
                string? requestBody = string.IsNullOrWhiteSpace(request.Body) ? null : request.Body;
                using HttpResponseMessage response = await _executor.SendOnceAsync(
                    configuration,
                    _executor.ResourceUrl(configuration),
                    new HttpMethod(configuration.HttpMethod),
                    requestBody,
                    request.Headers,
                    cancellationToken);
                string body = await response.Content.ReadAsStringAsync(cancellationToken);
                result.Answered = true;
                result.StatusCode = (int)response.StatusCode;
                int responseLimit = request.ResponseLimit > 0 ? request.ResponseLimit : RESPONSE_LIMIT;
                result.ResponseBody = body.Length > responseLimit ? body[..responseLimit] : body;

                // A server error or a request timeout answer leaves it open whether the document was created.
                result.OutcomeUnknown = (int)response.StatusCode >= 500 || (int)response.StatusCode == 408;
                if (response.IsSuccessStatusCode)
                {
                    // Read from the whole answer, not from the kept part, which may be cut in the middle of its JSON.
                    result.DocumentNumber = ExternalDocumentNumberReader.TryRead(body);
                    configuration.LastSuccessfulRunAt = DateTime.UtcNow;
                    configuration.LastErrorSafe = null;
                }
                else
                {
                    result.ErrorCode = "REMOTE_HTTP_ERROR";
                    result.ErrorMessage = $"The API returned HTTP {(int)response.StatusCode}.";
                    configuration.LastErrorSafe = result.ErrorMessage;
                }
            }
            catch (IntegrationException exception)
            {
                result.Answered = false;
                result.OutcomeUnknown = UnknownOutcomeCodes.Contains(exception.Code);
                result.ErrorCode = exception.Code;
                result.ErrorMessage = exception.Message;
                configuration.LastErrorSafe = exception.Message;
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // A failure before the HTTP call (for example the saved sign-in cannot be read) is not an IntegrationException.
                // Leave it on the configuration; otherwise the attempt is discarded and the posting only keeps a generic sentence.
                result.Answered = false;
                result.ErrorCode = "INTEGRATION_SEND_FAILED";
                result.ErrorMessage = "The posting could not be sent. " + SilaLogText.Short(exception.Message);
                configuration.LastErrorSafe = result.ErrorMessage;
                _logger.LogError($"Document could not be sent to integration. ConfigurationId: {configuration.Id}, Error: {SilaLogText.Short(exception.Message)}");
            }
            finally
            {
                if (!string.IsNullOrWhiteSpace(request.ResourcePathOverride))
                {
                    configuration.ResourcePath = savedPath;
                }
            }

            watch.Stop();
            result.DurationMs = watch.ElapsedMilliseconds;
            await _repository.SaveAsync();
            if (result.ErrorCode == null)
            {
                _logger.LogInfo($"Document sent to integration. ConfigurationId: {configuration.Id}, StatusCode: {result.StatusCode}, DurationMs: {result.DurationMs}");
            }
            else
            {
                _logger.LogError($"Document could not be sent to integration. ConfigurationId: {configuration.Id}, Code: {result.ErrorCode}, StatusCode: {result.StatusCode}, DurationMs: {result.DurationMs}");
            }

            return result;
        }
    }
}
