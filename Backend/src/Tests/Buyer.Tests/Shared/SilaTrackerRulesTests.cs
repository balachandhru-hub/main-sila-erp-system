using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;

namespace Buyer.Tests.Shared
{
    /// <summary>
    /// The tracker decides the failed stage from the records that already exist, and it does not call SAP again
    /// after the ERP document is known.
    /// </summary>
    public class SilaTrackerRulesTests
    {
        [Fact]
        public void Posting_FailedErp_ReprocessesFromErp()
        {
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPosting(Common.SILA_POSTING_FAILED, 1, null);

            Assert.Equal(SilaTrackerRules.SUCCESS, stages.Receive);
            Assert.Equal(SilaTrackerRules.FAILED, stages.Erp);
            Assert.Equal(SilaTrackerRules.NOT_STARTED, stages.Local);
            Assert.Equal(SilaTrackerRules.OVERALL_FAILED, stages.Overall);
            Assert.Equal(SilaTrackerRules.FROM_ERP, stages.ReprocessFrom);
            Assert.True(stages.ErpCallAllowed);
        }

        [Fact]
        public void Posting_LocalFailure_DoesNotCallErp()
        {
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPosting(Common.SILA_POSTING_FAILED_LOCAL, 1, "5000123456/2026");

            Assert.Equal(SilaTrackerRules.SUCCESS, stages.Erp);
            Assert.Equal(SilaTrackerRules.FAILED, stages.Local);
            Assert.Equal(SilaTrackerRules.OVERALL_FAILED_LOCAL, stages.Overall);
            Assert.Equal(SilaTrackerRules.FROM_LOCAL, stages.ReprocessFrom);
            Assert.False(stages.ErpCallAllowed);
        }

        [Fact]
        public void Posting_Unknown_IsReconciledRatherThanResent()
        {
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPosting(Common.SILA_POSTING_UNKNOWN, 1, null);

            Assert.Equal(SilaTrackerRules.UNKNOWN, stages.Erp);
            Assert.Equal(SilaTrackerRules.OVERALL_UNKNOWN, stages.Overall);
            Assert.Equal(SilaTrackerRules.ACTION_RECONCILE, stages.Action);
            Assert.False(stages.ErpCallAllowed);
        }

        [Fact]
        public void Pos_MatchFailure_StaysLocal()
        {
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPos(Common.SILA_POS_FAILED, Common.SILA_POS_STEP_MATCH, null);

            Assert.Equal(SilaTrackerRules.NOT_STARTED, stages.Erp);
            Assert.Equal(SilaTrackerRules.FAILED, stages.Local);
            Assert.Equal(SilaTrackerRules.FROM_LOCAL, stages.ReprocessFrom);
            Assert.False(stages.ErpCallAllowed);
        }

        [Fact]
        public void Pos_PostingFailure_ContinuesAtErp()
        {
            SilaTrackerRules.Stages posting = SilaTrackerRules.OfPosting(Common.SILA_POSTING_FAILED, 1, null);
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPos(Common.SILA_POS_FAILED, Common.SILA_POS_STEP_POST, posting);

            Assert.Equal(SilaTrackerRules.FAILED, stages.Erp);
            Assert.Equal(SilaTrackerRules.FROM_ERP, stages.ReprocessFrom);
            Assert.True(stages.ErpCallAllowed);
        }

        [Fact]
        public void Purchase_Unknown_IsNotANormalRetry()
        {
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPurchase(Common.INTEGRATION_UNKNOWN, true, null, 1);

            Assert.Equal(SilaTrackerRules.ACTION_RECONCILE, stages.Action);
            Assert.False(stages.ErpCallAllowed);
        }

        [Fact]
        public void Run_PartialLocalFailure_IsNotSentAgainAutomatically()
        {
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfRun("PARTIAL", 10, 2, "MANUAL");

            Assert.Equal(SilaTrackerRules.SUCCESS, stages.Erp);
            Assert.Equal(SilaTrackerRules.FAILED, stages.Local);
            Assert.Equal(SilaTrackerRules.ACTION_NONE, stages.Action);
            Assert.False(stages.ErpCallAllowed);
        }

        [Fact]
        public void MovementNames_UseTheExistingTransferAndCountTypes()
        {
            Assert.Equal("INTERNAL_TRANSFER_311", SilaTrackerRules.TransactionTypeOfPosting(Common.SILA_REF_ITO, "311"));
            Assert.Equal("PLANT_TRANSFER_301", SilaTrackerRules.TransactionTypeOfPosting(Common.SILA_REF_ITO, "301"));
            Assert.Equal("PHYSICAL_COUNT_SHORTAGE", SilaTrackerRules.TransactionTypeOfPosting(Common.SILA_REF_STOCK_COUNT, "Z02"));
            Assert.Equal("POSITIVE_STOCK_ADJUSTMENT", SilaTrackerRules.TransactionTypeOfPosting(Common.SILA_REF_ADJUSTMENT, "Z01"));
            Assert.Equal(SilaTrackerRules.DATA_MASTER, SilaTrackerRules.DataClassOfProcess("GET_MATERIAL"));
            Assert.Equal(SilaTrackerRules.DIRECTION_INBOUND, SilaTrackerRules.DirectionOfProcess("GET_SUPPLIER"));
            Assert.Equal(SilaTrackerRules.DIRECTION_OUTBOUND, SilaTrackerRules.DirectionOfProcess("POST_PO"));
        }
    }
}
