using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Tests.Support;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;

namespace Buyer.Tests.Shared
{
    /// <summary>The SILA ME approval engine against an in-memory RepositoryContext and the real RepositoryWrapper.</summary>
    public class SilaApprovalsTests
    {
        private const string TYPE = Common.SILA_APPROVAL_TYPE_RECIPE;
        private const string REFERENCE = "RECIPE";
        private const string COMPANY_CODE = "1000";

        private static readonly Guid BuyerId = Guid.NewGuid();
        private static readonly Guid LocationId = Guid.NewGuid();
        private static readonly Guid PropertyId = Guid.NewGuid();

        private static MasterApprovalFlow Flow(string name, string? scopeKind, Guid? scopeId = null, string? scopeCode = null, Guid? buyerId = null, string type = TYPE)
        {
            return new MasterApprovalFlow
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId ?? BuyerId,
                ApprovalCode = name,
                ApprovalName = name,
                Type = type,
                Currency = "AED",
                ScopeKind = scopeKind,
                ScopeId = scopeId,
                ScopeCode = scopeCode,
                IsActive = true
            };
        }

        private static ApprovalScope FullScope()
        {
            return new ApprovalScope { LocationId = LocationId, PropertyId = PropertyId, CompanyCode = COMPANY_CODE };
        }

        private static async Task<string> ResolveName(TestDatabase db, ApprovalScope scope)
        {
            MasterApprovalFlow flow = await SilaApprovals.ResolveFlowAsync(db.Repository, db.Logger, BuyerId, TYPE, scope, CancellationToken.None);
            return flow.ApprovalName;
        }

        [Fact]
        public async Task ResolveFlow_PrefersStoreOrOutletThenPropertyThenCompanyCodeThenAll()
        {
            using TestDatabase db = new TestDatabase();
            db.Seed(
                Flow("all", Common.SILA_SCOPE_ALL),
                Flow("company", Common.SILA_SCOPE_COMPANY_CODE, scopeCode: COMPANY_CODE),
                Flow("property", Common.SILA_SCOPE_PROPERTY, PropertyId),
                Flow("store", Common.SILA_SCOPE_STORE, LocationId));

            Assert.Equal("store", await ResolveName(db, FullScope()));
            Assert.Equal("property", await ResolveName(db, new ApprovalScope { LocationId = Guid.NewGuid(), PropertyId = PropertyId, CompanyCode = COMPANY_CODE }));
            Assert.Equal("company", await ResolveName(db, new ApprovalScope { LocationId = Guid.NewGuid(), PropertyId = Guid.NewGuid(), CompanyCode = COMPANY_CODE }));
            Assert.Equal("all", await ResolveName(db, new ApprovalScope { LocationId = Guid.NewGuid(), PropertyId = Guid.NewGuid(), CompanyCode = "2000" }));
            Assert.Equal("all", await ResolveName(db, new ApprovalScope()));
        }

        [Fact]
        public async Task ResolveFlow_OutletScopeMatchesTheLocation_AndCompanyCodeIsCaseInsensitive()
        {
            using TestDatabase db = new TestDatabase();
            db.Seed(
                Flow("company", Common.SILA_SCOPE_COMPANY_CODE, scopeCode: "abc"),
                Flow("outlet", Common.SILA_SCOPE_OUTLET, LocationId));

            Assert.Equal("outlet", await ResolveName(db, new ApprovalScope { LocationId = LocationId, CompanyCode = "ABC" }));
            Assert.Equal("company", await ResolveName(db, new ApprovalScope { LocationId = Guid.NewGuid(), CompanyCode = "ABC" }));
        }

        [Fact]
        public async Task ResolveFlow_EmptyScopeKindCountsAsAll()
        {
            using TestDatabase db = new TestDatabase();
            db.Seed(Flow("legacy", null));
            Assert.Equal("legacy", await ResolveName(db, FullScope()));
        }

        [Fact]
        public async Task ResolveFlow_IgnoresInactiveOtherTypeAndOtherBuyerFlows_ThenIsBadRequest()
        {
            using TestDatabase db = new TestDatabase();
            MasterApprovalFlow inactive = Flow("inactive", Common.SILA_SCOPE_ALL);
            inactive.IsActive = false;
            db.Seed(
                inactive,
                Flow("other type", Common.SILA_SCOPE_ALL, type: Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE),
                Flow("other buyer", Common.SILA_SCOPE_ALL, buyerId: Guid.NewGuid()));

            await Assert.ThrowsAsync<BadRequestCustomException>(() =>
                SilaApprovals.ResolveFlowAsync(db.Repository, db.Logger, BuyerId, TYPE, FullScope(), CancellationToken.None));
        }

        [Fact]
        public async Task ResolveFlow_TypeIsMatchedCaseInsensitively()
        {
            using TestDatabase db = new TestDatabase();
            db.Seed(Flow("lower", Common.SILA_SCOPE_ALL, type: TYPE.ToLowerInvariant()));
            Assert.Equal("lower", await ResolveName(db, FullScope()));
        }

        /// <summary>Seeds an ALL flow with the approvers in order and starts the approval of version 1 of a document.</summary>
        private static async Task<Guid> StartApproval(TestDatabase db, params Guid[] approvers)
        {
            MasterApprovalFlow flow = Flow("flow", Common.SILA_SCOPE_ALL);
            List<object> rows = new List<object> { flow };
            // Seeded in reverse on purpose: the engine orders the levels by ApprovalFlowUserMapping.Order.
            rows.AddRange(approvers.Select((user, index) => (object)new ApprovalFlowUserMapping
            {
                Id = Guid.NewGuid(),
                ApprovalFlowId = flow.Id,
                UserId = user,
                Order = (index + 1) * 10,
                IsActive = true
            }).Reverse());
            db.Seed(rows.ToArray());

            Guid referenceId = Guid.NewGuid();
            List<SilaApprovalStep> steps = await SilaApprovals.StartAsync(db.Repository, db.Logger, BuyerId, TYPE, REFERENCE, referenceId, 1, FullScope(), CancellationToken.None);
            Assert.Equal(approvers, steps.Select(x => x.UserId));
            Assert.Equal(Enumerable.Range(1, approvers.Length), steps.Select(x => x.Order));
            Assert.All(steps, x => Assert.Equal(Common.SILA_APPROVAL_PENDING, x.Status));
            await db.Repository.SaveAsync();
            db.Context.ChangeTracker.Clear();
            return referenceId;
        }

        private static async Task<ApprovalDecision> Decide(TestDatabase db, Guid referenceId, Guid userId, bool approve, string? comment = null)
        {
            ApprovalDecision decision = await SilaApprovals.DecideAsync(db.Repository, db.Logger, REFERENCE, referenceId, 1, userId, approve, comment, CancellationToken.None);
            await db.Repository.SaveAsync();
            db.Context.ChangeTracker.Clear();
            return decision;
        }

        private static List<string> Statuses(TestDatabase db, Guid referenceId)
        {
            return db.Context.SilaApprovalStep.AsNoTracking()
                .Where(x => x.ReferenceId == referenceId)
                .OrderBy(x => x.Order)
                .Select(x => x.Status)
                .ToList();
        }

        [Fact]
        public async Task Start_WhilePending_IsConflict()
        {
            using TestDatabase db = new TestDatabase();
            Guid referenceId = await StartApproval(db, Guid.NewGuid());
            await Assert.ThrowsAsync<ConflictCustomException>(() =>
                SilaApprovals.StartAsync(db.Repository, db.Logger, BuyerId, TYPE, REFERENCE, referenceId, 1, FullScope(), CancellationToken.None));
        }

        [Fact]
        public async Task Start_FlowWithoutApprovers_IsBadRequest()
        {
            using TestDatabase db = new TestDatabase();
            db.Seed(Flow("empty", Common.SILA_SCOPE_ALL));
            await Assert.ThrowsAsync<BadRequestCustomException>(() =>
                SilaApprovals.StartAsync(db.Repository, db.Logger, BuyerId, TYPE, REFERENCE, Guid.NewGuid(), 1, FullScope(), CancellationToken.None));
        }

        [Fact]
        public async Task Decide_LevelsInOrder_LastApprovalIsApproved()
        {
            using TestDatabase db = new TestDatabase();
            Guid first = Guid.NewGuid();
            Guid second = Guid.NewGuid();
            Guid referenceId = await StartApproval(db, first, second);

            ApprovalDecision one = await Decide(db, referenceId, first, true);
            Assert.Equal(SilaApprovals.OUTCOME_PENDING, one.Outcome);
            Assert.Equal(1, one.Level);
            Assert.False(one.IsFinal);

            ApprovalDecision two = await Decide(db, referenceId, second, true, " ok ");
            Assert.Equal(SilaApprovals.OUTCOME_APPROVED, two.Outcome);
            Assert.Equal(2, two.Level);
            Assert.True(two.IsFinal);
            Assert.Equal(new[] { Common.SILA_APPROVAL_APPROVED, Common.SILA_APPROVAL_APPROVED }, Statuses(db, referenceId));

            await Assert.ThrowsAsync<BadRequestCustomException>(() =>
                SilaApprovals.DecideAsync(db.Repository, db.Logger, REFERENCE, referenceId, 1, second, true, null, CancellationToken.None));
        }

        [Fact]
        public async Task Decide_LaterLevelBeforeItsTurn_IsBadRequest_AndStranger_IsForbidden()
        {
            using TestDatabase db = new TestDatabase();
            Guid first = Guid.NewGuid();
            Guid second = Guid.NewGuid();
            Guid referenceId = await StartApproval(db, first, second);

            await Assert.ThrowsAsync<BadRequestCustomException>(() =>
                SilaApprovals.DecideAsync(db.Repository, db.Logger, REFERENCE, referenceId, 1, second, true, null, CancellationToken.None));
            await Assert.ThrowsAsync<ForBiddenCustomException>(() =>
                SilaApprovals.DecideAsync(db.Repository, db.Logger, REFERENCE, referenceId, 1, Guid.NewGuid(), true, null, CancellationToken.None));
            Assert.Equal(new[] { Common.SILA_APPROVAL_PENDING, Common.SILA_APPROVAL_PENDING }, Statuses(db, referenceId));
        }

        [Fact]
        public async Task Decide_RejectionNeedsComment_AndCancelsTheRemainingLevels()
        {
            using TestDatabase db = new TestDatabase();
            Guid first = Guid.NewGuid();
            Guid second = Guid.NewGuid();
            Guid third = Guid.NewGuid();
            Guid referenceId = await StartApproval(db, first, second, third);

            await Assert.ThrowsAsync<BadRequestCustomException>(() =>
                SilaApprovals.DecideAsync(db.Repository, db.Logger, REFERENCE, referenceId, 1, first, false, "  ", CancellationToken.None));
            db.Context.ChangeTracker.Clear();

            await Decide(db, referenceId, first, true);
            ApprovalDecision rejected = await Decide(db, referenceId, second, false, "Too expensive");
            Assert.Equal(SilaApprovals.OUTCOME_REJECTED, rejected.Outcome);
            Assert.Equal(2, rejected.Level);
            Assert.True(rejected.IsFinal);
            Assert.Equal(new[] { Common.SILA_APPROVAL_APPROVED, Common.SILA_APPROVAL_REJECTED, "CANCELLED" }, Statuses(db, referenceId));
        }

        [Fact]
        public async Task PendingForUser_ListsOnlyDocumentsWhoseCurrentLevelIsTheUsers()
        {
            using TestDatabase db = new TestDatabase();
            Guid first = Guid.NewGuid();
            Guid second = Guid.NewGuid();
            Guid referenceId = await StartApproval(db, first, second);

            Assert.Equal(new[] { referenceId }, await SilaApprovals.PendingForUserAsync(db.Repository, BuyerId, REFERENCE, first, CancellationToken.None));
            Assert.Empty(await SilaApprovals.PendingForUserAsync(db.Repository, BuyerId, REFERENCE, second, CancellationToken.None));

            await Decide(db, referenceId, first, true);
            Assert.Empty(await SilaApprovals.PendingForUserAsync(db.Repository, BuyerId, REFERENCE, first, CancellationToken.None));
            Assert.Equal(new[] { referenceId }, await SilaApprovals.PendingForUserAsync(db.Repository, BuyerId, REFERENCE, second, CancellationToken.None));
        }
    }
}
