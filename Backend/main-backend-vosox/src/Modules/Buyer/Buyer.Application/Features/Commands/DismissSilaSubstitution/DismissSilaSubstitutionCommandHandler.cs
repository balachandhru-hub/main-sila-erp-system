using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DismissSilaSubstitution
{
    /// <summary>
    /// "No" on a recipe change suggestion: the proposal is dismissed with the user's reason (kept in the workflow events) and
    /// its alert resolved. The same suggestion is not raised again for a week.
    /// </summary>
    public class DismissSilaSubstitutionCommandHandler : IRequestHandler<DismissSilaSubstitutionCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DismissSilaSubstitutionCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DismissSilaSubstitutionCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Dismissing substitution proposal. ProposalId: {request.ProposalId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            string reason = request.Request?.Reason?.Trim() ?? string.Empty;
            if (reason.Length == 0 || reason.Length > SilaSubstitutionRules.MAX_REASON)
            {
                _logger.LogError($"Dismiss reason is invalid. ProposalId: {request.ProposalId}, Length: {reason.Length}");
                throw new BadRequestCustomException("Reason is required.", $"Say why the suggestion is not used, in at most {SilaSubstitutionRules.MAX_REASON} characters.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            RecipeSubstitutionProposal proposal = await SilaSubstitutionRules.GetProposalAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.ProposalId, cancellationToken);
            SilaSubstitutionRules.EnsureOpen(_logger, proposal);

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            await SilaSubstitutionRules.CloseAsync(_repository, ledger, proposal, Common.SILA_PROPOSAL_DISMISSED, request.UserId,
                SilaSubstitutionRules.EVENT_DISMISSED, reason, cancellationToken);
            await _repository.SaveAsync();

            _logger.LogInfo($"Substitution proposal dismissed. ProposalId: {proposal.Id}, ProposalNumber: {proposal.ProposalNumber}");
            return Unit.Value;
        }
    }
}
