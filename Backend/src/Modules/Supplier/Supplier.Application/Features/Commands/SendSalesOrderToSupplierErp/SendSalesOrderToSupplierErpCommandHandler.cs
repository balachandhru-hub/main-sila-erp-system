using System.Diagnostics;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Supplier.Application.Features.Shared;
using Supplier.Domain.Entities;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Commands.SendSalesOrderToSupplierErp
{
    /// <summary>
    /// The supplier's sales order API (POST_SALES_ORDER) is the one of the supplier's organization; its address and sign-in are
    /// saved under Integrations, so nothing about the supplier's ERP is in code. The order is sent once: whether to try again is
    /// decided by the caller. A failed call is a result, not an error.
    /// </summary>
    public class SendSalesOrderToSupplierErpCommandHandler : IRequestHandler<SendSalesOrderToSupplierErpCommand, SupplierSalesOrderResultDto>
    {
        private const int RESPONSE_LIMIT = 4000;

        // Failures after which the ERP may still have received the order.
        private static readonly string[] UnknownOutcomeCodes = { "REMOTE_UNAVAILABLE", "REMOTE_TIMEOUT" };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;

        public SendSalesOrderToSupplierErpCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
        }

        public async Task<SupplierSalesOrderResultDto> Handle(SendSalesOrderToSupplierErpCommand request, CancellationToken cancellationToken)
        {
            SupplierSalesOrderRequestDto order = request.Order;
            _logger.LogInfo($"Sending purchase order to the supplier ERP. SupplierId: {order.SupplierId}, PurchaseOrderNumber: {order.PurchaseOrderNumber}");

            SupplierBusinessProfile? supplier = _repository.SupplierBusinessProfile.FindFirstByCondition(x => x.Id == order.SupplierId && x.IsActive);
            if (supplier == null)
            {
                _logger.LogError($"Supplier not found for the sales order. SupplierId: {order.SupplierId}");
                throw new NotFoundCustomException("Supplier not found.", "No supplier exists for this purchase order.");
            }

            ApiIntegrationConfiguration? configuration = await _repository.ApiIntegrationConfiguration.FindFirstByConditionAsync(
                x => x.OrganizationId == supplier.OrganizationId
                    && x.ProcessType == IntegrationProcessType.POST_SALES_ORDER
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive);
            if (configuration == null)
            {
                _logger.LogInfo($"The supplier has no active sales order API. SupplierId: {order.SupplierId}, OrganizationId: {supplier.OrganizationId}");
                return new SupplierSalesOrderResultDto { Configured = false };
            }

            SupplierSalesOrderResultDto result = new SupplierSalesOrderResultDto
            {
                Configured = true,
                ConfigurationId = configuration.Id,
                SystemName = configuration.SystemName
            };
            Dictionary<string, string> headers = new Dictionary<string, string>
            {
                ["Idempotency-Key"] = order.IdempotencyKey,
                ["X-Correlation-Id"] = order.CorrelationId
            };

            Stopwatch watch = Stopwatch.StartNew();
            configuration.LastAttemptAt = DateTime.UtcNow;
            try
            {
                string body = SupplierSalesOrderPayload.Build(order, configuration.RequestBody);
                using HttpResponseMessage response = await _executor.SendOnceAsync(
                    configuration,
                    _executor.ResourceUrl(configuration),
                    new HttpMethod(string.IsNullOrWhiteSpace(configuration.HttpMethod) ? "POST" : configuration.HttpMethod),
                    body,
                    headers,
                    cancellationToken);
                string answer = await response.Content.ReadAsStringAsync(cancellationToken);
                result.Answered = true;
                result.StatusCode = (int)response.StatusCode;
                result.ResponseBody = answer.Length > RESPONSE_LIMIT ? answer[..RESPONSE_LIMIT] : answer;

                // A server error or a request timeout answer leaves it open whether the order was created.
                result.OutcomeUnknown = (int)response.StatusCode >= 500 || (int)response.StatusCode == 408;
                if (response.IsSuccessStatusCode)
                {
                    result.DocumentNumber = ExternalDocumentNumber.TryRead(answer);
                    if (string.IsNullOrWhiteSpace(result.DocumentNumber))
                    {
                        // Accepted, but without a number: the order may exist there, so it is not sent again blindly.
                        result.ErrorCode = "NO_DOCUMENT_NUMBER";
                        result.ErrorMessage = "The supplier ERP accepted the order but did not return an order number.";
                        result.OutcomeUnknown = true;
                        configuration.LastErrorSafe = result.ErrorMessage;
                    }
                    else
                    {
                        result.Succeeded = true;
                        result.OutcomeUnknown = false;
                        configuration.LastSuccessfulRunAt = DateTime.UtcNow;
                        configuration.LastErrorSafe = null;
                    }
                }
                else
                {
                    result.ErrorCode = "REMOTE_HTTP_ERROR";
                    result.ErrorMessage = $"The supplier ERP returned HTTP {(int)response.StatusCode}.";
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

            watch.Stop();
            result.DurationMs = watch.ElapsedMilliseconds;
            await _repository.SaveAsync();
            if (result.Succeeded)
            {
                _logger.LogInfo($"Purchase order sent to the supplier ERP. SupplierId: {order.SupplierId}, ConfigurationId: {configuration.Id}, Document: {result.DocumentNumber}, DurationMs: {result.DurationMs}");
            }
            else
            {
                _logger.LogError($"Purchase order could not be sent to the supplier ERP. SupplierId: {order.SupplierId}, ConfigurationId: {configuration.Id}, Code: {result.ErrorCode}, StatusCode: {result.StatusCode}, DurationMs: {result.DurationMs}");
            }

            return result;
        }
    }
}
