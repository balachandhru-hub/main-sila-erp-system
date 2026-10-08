import React from "react";
import { BuyerAnalytics, FilePlusIcon } from "@vosox/shared-ui";
import RecentRfqsPanel from "./RecentRfqsPanel";
import RecentPurchaseOrdersPanel from "./RecentPurchaseOrdersPanel";
import SupplierMatchmaker from "./SupplierMatchmaker";
import type { MatchCard } from "./types";

interface DashboardHomeProps {
  /** "Needs your attention" (approvals, alerts, next actions), shown before the numbers. */
  attention?: React.ReactNode;
  analytics: React.ComponentProps<typeof BuyerAnalytics>["state"];
  rfqs: any[];
  loadingRfqs: boolean;
  rfqsError: string | null;
  visibleRfqCount: number;
  onCreateRfq: () => void;
  onViewRfqs: () => void;
  onOpenRfq: (rfqId: string) => void;
  onViewProfile: (card: MatchCard) => void;
}

/** The buyer's landing page: what needs attention, analytics, recent RFQs and POs, and the supplier matchmaker. */
const DashboardHome: React.FC<DashboardHomeProps> = ({
  attention,
  analytics,
  rfqs,
  loadingRfqs,
  rfqsError,
  visibleRfqCount,
  onCreateRfq,
  onViewRfqs,
  onOpenRfq,
  onViewProfile,
}) => (
  <>
    <div className="pud-dashboard-header sila-page-header">
      <div>
        <h1 className="pud-title">Buyer Operations Command</h1>
        <p className="pud-subtitle">Real-time procurement tracking, bid submittals, and transaction monitoring.</p>
      </div>
      <div className="pud-dashboard-actions">
        <button
          type="button"
          className="pud-btn-create-rfq"
          onClick={onCreateRfq}
        >
          <FilePlusIcon />
          <span>Create RFQ</span>
        </button>
      </div>
    </div>

    {attention && <div className="pud-attention">{attention}</div>}

    <BuyerAnalytics
      state={analytics}
      onViewRfqs={onViewRfqs}
      onOpenRfq={onOpenRfq}
    />

    <div className="pud-panels">
      <RecentRfqsPanel
        rfqs={rfqs}
        visibleCount={visibleRfqCount}
        loading={loadingRfqs}
        error={rfqsError}
        onOpenRfq={onOpenRfq}
        onViewAll={onViewRfqs}
      />
      <RecentPurchaseOrdersPanel />
    </div>

    <SupplierMatchmaker onViewProfile={onViewProfile} />
  </>
);

export default DashboardHome;
