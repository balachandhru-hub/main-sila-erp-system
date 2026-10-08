using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.StartDueSilaPhysicalInventories;
using Buyer.Application.Features.Queries.GetSilaJobBuyers;
using Buyer.Application.Features.Shared;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Daily Quartz job (cron Scheduler:PhysicalInventoryCron) that opens the surprise blind count of every physical
    /// inventory request scheduled for today or earlier and links the count to the request. Each buyer runs in its own
    /// scope; one failing buyer is logged and the others continue.
    /// </summary>
    [DisallowConcurrentExecution]
    public class PhysicalInventoryJob : IJob
    {
        private const string JOB_NAME = nameof(PhysicalInventoryJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public PhysicalInventoryJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
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
                List<Guid> buyerIds = await _mediator.Send(new GetSilaJobBuyersQuery { Job = GetSilaJobBuyersQuery.JOB_PHYSICAL_INVENTORY }, context.CancellationToken);
                int started = 0;
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Buyer", buyerIds,
                    (mediator, buyerId, cancellationToken) => mediator.Send(new StartDueSilaPhysicalInventoriesCommand { BuyerId = buyerId }, cancellationToken),
                    result => started += result,
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {buyerIds.Count}, Failed: {failed}, CountsStarted: {started}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // Requests that did not start stay SCHEDULED; the next run tries again.
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
