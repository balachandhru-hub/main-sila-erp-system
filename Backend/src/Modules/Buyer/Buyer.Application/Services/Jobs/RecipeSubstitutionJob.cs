using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Quartz;
using Buyer.Application.Features.Commands.GenerateSilaSubstitutionProposals;
using Buyer.Application.Features.Queries.GetSilaJobBuyers;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Services.Jobs
{
    /// <summary>
    /// Quartz job (cron Scheduler:RecipeSubstitutionCron, hourly) that checks every approved recipe for ingredients short
    /// across their property, proposes an in-stock substitute to the outlet and dismisses proposals whose ingredient is back.
    /// Each buyer runs in its own scope; one failing buyer is logged and the others continue.
    /// </summary>
    [DisallowConcurrentExecution]
    public class RecipeSubstitutionJob : IJob
    {
        private const string JOB_NAME = nameof(RecipeSubstitutionJob);

        private readonly IMediator _mediator;
        private readonly IServiceScopeFactory _scopeFactory;
        private readonly ILoggerManager _logger;

        public RecipeSubstitutionJob(IMediator mediator, IServiceScopeFactory scopeFactory, ILoggerManager logger)
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
                List<Guid> buyerIds = await _mediator.Send(new GetSilaJobBuyersQuery { Job = GetSilaJobBuyersQuery.JOB_SUBSTITUTION }, context.CancellationToken);
                SilaSubstitutionRunResultDto total = new SilaSubstitutionRunResultDto();
                int failed = await SilaJobRunner.ForEachAsync(
                    _scopeFactory, _logger, JOB_NAME, "Buyer", buyerIds,
                    (mediator, buyerId, cancellationToken) => mediator.Send(new GenerateSilaSubstitutionProposalsCommand { BuyerId = buyerId }, cancellationToken),
                    result =>
                    {
                        total.Buyers += result.Buyers;
                        total.RecipesChecked += result.RecipesChecked;
                        total.ShortIngredients += result.ShortIngredients;
                        total.Created += result.Created;
                        total.Updated += result.Updated;
                        total.AutoDismissed += result.AutoDismissed;
                    },
                    context.CancellationToken);
                _logger.LogInfo($"[{JOB_NAME}] end. Buyers: {total.Buyers}/{buyerIds.Count}, Failed: {failed}, Recipes: {total.RecipesChecked}, Short: {total.ShortIngredients}, Created: {total.Created}, Updated: {total.Updated}, AutoDismissed: {total.AutoDismissed}");
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                // The next run checks again.
                _logger.LogError($"[{JOB_NAME}] end with error. Error: {SilaLogText.Short(exception.Message)}");
            }
        }
    }
}
