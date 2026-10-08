using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.GenerateSilaSubstitutionProposals
{
    /// <summary>
    /// Proposes substitutes for the short ingredients of approved recipes (see SilaSubstitutionEngine) and saves once per
    /// buyer. In a scheduler run a failing buyer is logged and skipped; a manual run reports the error to the caller.
    /// </summary>
    public class GenerateSilaSubstitutionProposalsCommandHandler : IRequestHandler<GenerateSilaSubstitutionProposalsCommand, SilaSubstitutionRunResultDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GenerateSilaSubstitutionProposalsCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaSubstitutionRunResultDto> Handle(GenerateSilaSubstitutionProposalsCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Checking recipes for substitutions. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            SilaSubstitutionRunResultDto total = new SilaSubstitutionRunResultDto();
            if (request.OrganizationId != null)
            {
                BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId.Value);
                total = await SilaSubstitutionEngine.RunAsync(_repository, _logger, buyer.Id, request.UserId, cancellationToken);
                await _repository.SaveAsync();
                _logger.LogInfo($"Substitution check completed. BuyerId: {buyer.Id}, Created: {total.Created}, AutoDismissed: {total.AutoDismissed}");
                return total;
            }

            if (request.BuyerId != null)
            {
                // Scheduler run of one buyer (own scope): an error goes back to the job, which logs it and continues.
                total = await SilaSubstitutionEngine.RunAsync(_repository, _logger, request.BuyerId.Value, request.UserId, cancellationToken);
                await _repository.SaveAsync();
                total.Buyers = 1;
                _logger.LogInfo($"Substitution check completed. BuyerId: {request.BuyerId}, Created: {total.Created}, AutoDismissed: {total.AutoDismissed}");
                return total;
            }

            List<Guid> buyerIds = await _repository.Recipe
                .FindByCondition(x => x.IsActive && x.ActiveVersion > 0)
                .Select(x => x.BuyerId)
                .Union(_repository.RecipeSubstitutionProposal
                    .FindByCondition(x => x.IsActive && x.Status == Common.SILA_PROPOSAL_PROPOSED)
                    .Select(x => x.BuyerId))
                .Distinct()
                .ToListAsync(cancellationToken);

            foreach (Guid buyerId in buyerIds)
            {
                try
                {
                    SilaSubstitutionRunResultDto result = await SilaSubstitutionEngine.RunAsync(_repository, _logger, buyerId, request.UserId, cancellationToken);
                    await _repository.SaveAsync();
                    total.Buyers++;
                    total.RecipesChecked += result.RecipesChecked;
                    total.ShortIngredients += result.ShortIngredients;
                    total.Created += result.Created;
                    total.Updated += result.Updated;
                    total.AutoDismissed += result.AutoDismissed;
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    // The next run checks this buyer again; its unsaved rows are dropped so the next buyer saves cleanly.
                    SilaRetry.DiscardChanges(_repository);
                    _logger.LogError($"Substitution check failed for a buyer. BuyerId: {buyerId}, Error: {SilaLogText.Short(exception.Message)}");
                }
            }

            _logger.LogInfo($"Substitution check completed. Buyers: {total.Buyers}/{buyerIds.Count}, Recipes: {total.RecipesChecked}, Created: {total.Created}, Updated: {total.Updated}, AutoDismissed: {total.AutoDismissed}");
            return total;
        }
    }
}
