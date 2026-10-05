using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.RaiseLowStockAlerts;
using Buyer.Application.Features.Queries.GetSilaJobBuyers;
using Buyer.Application.Features.Shared;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job that raises LOW_STOCK alerts for location materials whose on-hand quantity is under the
    /// reorder point (or minimum stock). An open alert of the same material and location is not raised again.
    /// Each buyer runs in its own scope; one failing buyer is logged and the others continue.
    /// </summary>
    [DisallowConcurrentExecution]
    public class InventoryAlertJob : IJob
    {
        private const string JOB_NAME = nameof(InventoryAlertJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public InventoryAlertJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
        {
            _mediator = mediator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            _logger.LogInfo($"[{JOB_NAME}] start");
            try
            {
                List<Guid> buyerIds = await _mediator.Send(new GetSilaJobBuyersQuery { Job = GetSilaJobBuyersQuery.JOB_LOW_STOCK }, context.CancellationToken);
                int low = 0;
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Buyer", buyerIds,
                    (mediator, buyerId, cancellationToken) => mediator.Send(new RaiseLowStockAlertsCommand { BuyerId = buyerId }, cancellationToken),
                    result => low += result,
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {buyerIds.Count}, Failed: {failed}, BelowThreshold: {low}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The next run checks again.
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
