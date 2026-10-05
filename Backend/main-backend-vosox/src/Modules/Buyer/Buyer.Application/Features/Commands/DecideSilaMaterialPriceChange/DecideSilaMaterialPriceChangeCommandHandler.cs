using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DecideSilaMaterialPriceChange
{
    /// <summary>
    /// Records the approver's decision on a material price change. The last approval writes the price (per base unit)
    /// and currency to the material and marks the change APPROVED; a rejection marks it REJECTED. Returns the change status.
    /// </summary>
    public class DecideSilaMaterialPriceChangeCommandHandler : IRequestHandler<DecideSilaMaterialPriceChangeCommand, string>
    {
        private const int MAX_COMMENT_LENGTH = 500;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DecideSilaMaterialPriceChangeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<string> Handle(DecideSilaMaterialPriceChangeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deciding material price change. PriceChangeId: {request.PriceChangeId}, Approve: {request.Approve}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            MaterialPriceChange? change = await _repository.MaterialPriceChange.FindFirstByConditionAsync(
                x => x.Id == request.PriceChangeId && x.BuyerId == buyer.Id && x.IsActive);
            if (change == null)
            {
                _logger.LogError($"Price change not found. PriceChangeId: {request.PriceChangeId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Price change not found.", "Select a price change of this organization.");
            }

            if (change.Status != Common.SILA_PRICE_PENDING_APPROVAL)
            {
                _logger.LogError($"Price change is not pending. PriceChangeId: {change.Id}, Status: {change.Status}");
                throw new BadRequestCustomException("The price change is already decided.", $"It is {change.Status}; refresh the list.");
            }

            if (request.Comment != null && request.Comment.Trim().Length > MAX_COMMENT_LENGTH)
            {
                _logger.LogError($"Price decision comment too long. PriceChangeId: {change.Id}");
                throw new BadRequestCustomException("The comment is too long.", $"Enter at most {MAX_COMMENT_LENGTH} characters.");
            }

            ApprovalDecision decision = await SilaApprovals.DecideAsync(
                _repository, _logger, Common.SILA_REF_MATERIAL_PRICE, change.Id, SilaMaterialPricing.APPROVAL_VERSION,
                request.UserId, request.Approve, request.Comment, cancellationToken);

            if (decision.Outcome == SilaApprovals.OUTCOME_APPROVED)
            {
                ItemBuyerMaster material = await SilaLocationRules.GetMaterialAsync(_repository, _logger, buyer.Id, change.MaterialId);
                Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                    _repository, new[] { material.Id }, cancellationToken);
                SilaMaterialPricing.ApplyApproved(_repository, _logger, change, material, conversions);
                change.Status = Common.SILA_PRICE_APPROVED;
                change.DecidedOn = DateTime.UtcNow;
            }
            else if (decision.Outcome == SilaApprovals.OUTCOME_REJECTED)
            {
                change.Status = Common.SILA_PRICE_REJECTED;
                change.DecidedOn = DateTime.UtcNow;
            }

            _repository.MaterialPriceChange.Update(change);
            await _repository.SaveAsync();

            _logger.LogInfo($"Material price change decided. PriceChangeId: {change.Id}, Level: {decision.Level}, Outcome: {decision.Outcome}, Status: {change.Status}");
            return change.Status;
        }
    }
}
