using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.PostPendingErpPostings;
using Buyer.Application.Features.Queries.GetSilaJobBuyers;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job (cron Scheduler:InventoryErpPostingCron, every minute) that sends the pending SILA ME inventory
    /// documents to the buyers' ERP. Each buyer with pending documents runs in its own scope; the command posts and saves
    /// each document on its own. Start/end are logged only when there is work, to keep the minute runs quiet.
    /// </summary>
    [DisallowConcurrentExecution]
    public class InventoryErpPostingJob : IJob
    {
        private const string JOB_NAME = nameof(InventoryErpPostingJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public InventoryErpPostingJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
        {
            _mediator = mediator;
            _scopeFactory = scopeFactory;
            _logger = logger;
        }

        public async Task Execute(IJobExecutionContext context)
        {
            try
            {
                List<Guid> buyerIds = await _mediator.Send(new GetSilaJobBuyersQuery { Job = GetSilaJobBuyersQuery.JOB_ERP_POSTING }, context.CancellationToken);
                if (buyerIds.Count == 0)
                {
                    return;
                }

                _logger.LogInfo($"[{JOB_NAME}] start. Buyers: {buyerIds.Count}");
                SilaErpPostingRunResultDto total = new SilaErpPostingRunResultDto();
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Buyer", buyerIds,
                    (mediator, buyerId, cancellationToken) => mediator.Send(new PostPendingErpPostingsCommand { BuyerId = buyerId }, cancellationToken),
                    result =>
                    {
                        total.Processed += result.Processed;
                        total.Posted += result.Posted;
                        total.Failed += result.Failed;
                        total.Retrying += result.Retrying;
                        total.Skipped += result.Skipped;
                    },
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {buyerIds.Count}, BuyersFailed: {failed}, Processed: {total.Processed}, Posted: {total.Posted}, Failed: {total.Failed}, Retrying: {total.Retrying}, Skipped: {total.Skipped}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The next run picks up whatever is still pending.
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
