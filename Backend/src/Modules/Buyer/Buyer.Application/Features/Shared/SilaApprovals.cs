using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The SILA ME approval engine on top of the existing approval flows (MasterApprovalFlow + ApprovalFlowUserMapping):
    /// picks the most specific active flow of a type for a scope (store/outlet, then property, then company code, then all),
    /// copies its ordered users into SilaApprovalStep rows of the document version, and records decisions strictly in order.
    /// </summary>
    public static class SilaApprovals
    {
        public const string OUTCOME_PENDING = "PENDING";
        public const string OUTCOME_APPROVED = "APPROVED";
        public const string OUTCOME_REJECTED = "REJECTED";
        private const string STEP_CANCELLED = "CANCELLED";

        /// <summary>The most specific active flow of the type for the scope. None is a 400 that says which flow to create.</summary>
        public static async Task<MasterApprovalFlow> ResolveFlowAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, string approvalType, ApprovalScope scope, CancellationToken cancellationToken)
        {
            List<MasterApprovalFlow> flows = await repository.MasterApprovalFlow
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Type != null && x.Type.ToUpper() == approvalType)
                .OrderByDescending(x => x.DateCreated)
                .ToListAsync(cancellationToken);

            MasterApprovalFlow? flow =
                flows.FirstOrDefault(x => scope.LocationId != null && x.ScopeId == scope.LocationId
                    && (x.ScopeKind == Common.SILA_SCOPE_OUTLET || x.ScopeKind == Common.SILA_SCOPE_STORE))
                ?? flows.FirstOrDefault(x => scope.PropertyId != null && x.ScopeKind == Common.SILA_SCOPE_PROPERTY && x.ScopeId == scope.PropertyId)
                ?? flows.FirstOrDefault(x => !string.IsNullOrWhiteSpace(scope.CompanyCode) && x.ScopeKind == Common.SILA_SCOPE_COMPANY_CODE
                    && string.Equals(x.ScopeCode, scope.CompanyCode, StringComparison.OrdinalIgnoreCase))
                ?? flows.FirstOrDefault(x => string.IsNullOrWhiteSpace(x.ScopeKind) || x.ScopeKind == Common.SILA_SCOPE_ALL);

            if (flow == null)
            {
                logger.LogError($"No approval flow. BuyerId: {buyerId}, Type: {approvalType}");
                throw new BadRequestCustomException(
                    "No approval flow is configured.",
                    $"Create an approval flow of type {approvalType} in Approval Management.");
            }

            return flow;
        }

        /// <summary>
        /// Starts the approval of a document version: resolves the flow and adds one PENDING step per approver, in order.
        /// The caller saves.
        /// </summary>
        public static async Task<List<SilaApprovalStep>> StartAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            string approvalType,
            string referenceType,
            Guid referenceId,
            int version,
            ApprovalScope scope,
            CancellationToken cancellationToken)
        {
            bool alreadyPending = await repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == referenceType && x.ReferenceId == referenceId && x.Version == version
                    && x.IsActive && x.Status == Common.SILA_APPROVAL_PENDING)
                .AnyAsync(cancellationToken);
            if (alreadyPending)
            {
                logger.LogError($"Approval already pending. ReferenceType: {referenceType}, ReferenceId: {referenceId}, Version: {version}");
                throw new ConflictCustomException("Approval is already pending.", "Wait for the approvers to decide on this version.");
            }

            MasterApprovalFlow flow = await ResolveFlowAsync(repository, logger, buyerId, approvalType, scope, cancellationToken);
            List<ApprovalFlowUserMapping> users = await repository.ApprovalFlowUserMapping
                .FindByCondition(x => x.ApprovalFlowId == flow.Id && x.IsActive)
                .OrderBy(x => x.Order)
                .ToListAsync(cancellationToken);
            if (users.Count == 0)
            {
                logger.LogError($"Approval flow has no approvers. ApprovalFlowId: {flow.Id}");
                throw new BadRequestCustomException("The approval flow has no approvers.", $"Add approvers to the approval flow {flow.ApprovalName}.");
            }

            List<SilaApprovalStep> steps = users.Select((user, index) => new SilaApprovalStep
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                ApprovalType = approvalType,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                Version = version,
                UserId = user.UserId,
                Order = index + 1,
                Status = Common.SILA_APPROVAL_PENDING,
                IsActive = true
            }).ToList();
            repository.SilaApprovalStep.CreateRange(steps);
            return steps;
        }

        /// <summary>
        /// Records the user's decision on the current level. Only the approver of the first pending level may act;
        /// a rejection cancels the remaining levels. The caller saves.
        /// </summary>
        public static async Task<ApprovalDecision> DecideAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            string referenceType,
            Guid referenceId,
            int version,
            Guid userId,
            bool approve,
            string? comment,
            CancellationToken cancellationToken)
        {
            List<SilaApprovalStep> steps = await repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == referenceType && x.ReferenceId == referenceId && x.Version == version && x.IsActive)
                .OrderBy(x => x.Order)
                .ToListAsync(cancellationToken);
            SilaApprovalStep? current = steps.FirstOrDefault(x => x.Status == Common.SILA_APPROVAL_PENDING);
            if (current == null)
            {
                logger.LogError($"Nothing to approve. ReferenceType: {referenceType}, ReferenceId: {referenceId}, Version: {version}");
                throw new BadRequestCustomException("Nothing is waiting for approval.", "This version has no pending approval.");
            }

            if (current.UserId != userId)
            {
                bool laterLevel = steps.Any(x => x.UserId == userId && x.Status == Common.SILA_APPROVAL_PENDING);
                logger.LogError($"Not the user's turn. ReferenceId: {referenceId}, UserId: {userId}, CurrentLevel: {current.Order}");
                if (laterLevel)
                {
                    throw new BadRequestCustomException("Earlier approval levels are still pending.", "Approvers act in the configured order.");
                }

                throw new ForBiddenCustomException("You are not an approver of this document.", "Only the configured approvers can decide.");
            }

            if (!approve && string.IsNullOrWhiteSpace(comment))
            {
                logger.LogError($"Rejection without comment. ReferenceId: {referenceId}, UserId: {userId}");
                throw new BadRequestCustomException("A comment is required.", "Say why you reject it.");
            }

            current.Status = approve ? Common.SILA_APPROVAL_APPROVED : Common.SILA_APPROVAL_REJECTED;
            current.Comment = comment?.Trim();
            current.ActedOn = DateTime.UtcNow;
            repository.SilaApprovalStep.Update(current);

            if (!approve)
            {
                List<SilaApprovalStep> remaining = steps.Where(x => x.Id != current.Id && x.Status == Common.SILA_APPROVAL_PENDING).ToList();
                foreach (SilaApprovalStep step in remaining)
                {
                    step.Status = STEP_CANCELLED;
                }

                repository.SilaApprovalStep.UpdateRange(remaining);
                return new ApprovalDecision { Outcome = OUTCOME_REJECTED, Level = current.Order };
            }

            bool last = steps.All(x => x.Id == current.Id || x.Status == Common.SILA_APPROVAL_APPROVED);
            return new ApprovalDecision { Outcome = last ? OUTCOME_APPROVED : OUTCOME_PENDING, Level = current.Order };
        }

        /// <summary>Ids of the documents of the type whose current pending level is the user's.</summary>
        public static async Task<List<Guid>> PendingForUserAsync(
            IRepositoryWrapper repository, Guid buyerId, string referenceType, Guid userId, CancellationToken cancellationToken)
        {
            List<SilaApprovalStep> pending = await repository.SilaApprovalStep
                .FindByCondition(x => x.BuyerId == buyerId && x.ReferenceType == referenceType && x.IsActive && x.Status == Common.SILA_APPROVAL_PENDING)
                .ToListAsync(cancellationToken);
            return pending
                .GroupBy(x => new { x.ReferenceId, x.Version })
                .Select(group => group.OrderBy(x => x.Order).First())
                .Where(x => x.UserId == userId)
                .Select(x => x.ReferenceId)
                .Distinct()
                .ToList();
        }

        /// <summary>The approval trail of a document, every version, oldest first.</summary>
        public static Task<List<SilaApprovalStep>> TrailAsync(
            IRepositoryWrapper repository, string referenceType, Guid referenceId, CancellationToken cancellationToken)
        {
            return repository.SilaApprovalStep
                .FindByCondition(x => x.ReferenceType == referenceType && x.ReferenceId == referenceId && x.IsActive)
                .OrderBy(x => x.Version)
                .ThenBy(x => x.Order)
                .ToListAsync(cancellationToken);
        }
    }
}
