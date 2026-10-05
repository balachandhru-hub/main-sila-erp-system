import React, { useEffect, useState } from "react";
import { Card, KpiCard, PageHeader } from "@vosox/shared-ui";
import { getPurchaseOrders } from "../../api/purchaseOrderApi";
import RecentPurchaseOrderList from "../dashboard/RecentPurchaseOrderList";
import { useAttention } from "../dashboard/attention/useAttention";
import { formatCount } from "../dashboard/attention/attentionSources";
import type { BucketRole } from "../dashboard/attention/suggestedActions";
import { statusLabel } from "../weeklyBucket/weeklyBucketStatus";
import "./Purchasing.css";

interface PurchasingDashboardProps {
  currentUserId: string | null;
  hasSilaMe: boolean;
  /** How the user works with the weekly bucket; null when the role has no weekly bucket screen. */
  bucketRole: BucketRole;
  /** Class prefix of the hosting dashboard's recent-PO styles ("pud" buyer, "bad" administrator). */
  classPrefix: string;
  onNavigate: (navKey: string) => void;
}

/** Orders read to count the open ones (the purchase order list API returns at most 100 per call). */
const OPEN_PO_CHECK = 100;
const CLOSED_PO_STATUSES = ["RECEIVED", "CLOSED", "CANCELLED", "COMPLETED"];

/** Landing page of Purchasing: open POs, weekly bucket status, pending approvals and the newest POs. */
const PurchasingDashboard: React.FC<PurchasingDashboardProps> = ({ currentUserId, hasSilaMe, bucketRole, classPrefix, onNavigate }) => {
  const attention = useAttention({ currentUserId, hasSilaMe });
  const [openOrders, setOpenOrders] = useState<string | null>(null);
  const [ordersError, setOrdersError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPurchaseOrders("buyer", OPEN_PO_CHECK)
      .then((orders) => {
        if (!active) return;
        const open = orders.filter((order) => !CLOSED_PO_STATUSES.includes((order.status ?? "").toUpperCase())).length;
        setOpenOrders(orders.length >= OPEN_PO_CHECK ? `${open}+` : String(open));
      })
      .catch((err: unknown) => {
        if (active) setOrdersError(err instanceof Error ? err.message : "Could not load purchase orders.");
      });
    return () => {
      active = false;
    };
  }, []);

  const latestBucket = attention.buckets?.[0];
  const awaitingApproval = attention.buckets?.filter((bucket) => bucket.status === "PENDING_APPROVAL").length ?? 0;
  const pendingForMe = attention.approvals.reduce((sum, approval) => sum + approval.count, 0);
  const bucketNav = bucketRole ? "weeklyBucket" : "weeklyBucketApprovals";

  return (
    <div className="pdash-page">
      <PageHeader
        title="Purchasing"
        description="Catalog requests, weekly buckets and the purchase orders created in your ERP."
        actions={
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => onNavigate("product")}>
            Browse catalog
          </button>
        }
      />

      <div className="pdash-kpis">
        <KpiCard
          label="Open purchase orders"
          value={ordersError ? "—" : openOrders ?? "…"}
          loading={openOrders === null && !ordersError}
          meta={ordersError ?? "Not yet fully received"}
          tone={ordersError ? "danger" : "primary"}
          linkText="View purchase orders"
          onClick={() => onNavigate("purchaseOrders")}
        />
        <KpiCard
          label="Weekly bucket"
          value={attention.buckets === null ? "—" : latestBucket ? statusLabel(latestBucket.status) : "None yet"}
          loading={attention.loading}
          meta={
            attention.buckets === null
              ? "Could not load weekly buckets"
              : latestBucket
                ? `${latestBucket.bucketCode}${latestBucket.propertyName ? ` · ${latestBucket.propertyName}` : ""}`
                : "Nothing requested this week"
          }
          linkText="Open weekly bucket"
          onClick={() => onNavigate(bucketNav)}
        />
        <KpiCard
          label="Buckets awaiting approval"
          value={attention.buckets === null ? "—" : formatCount(awaitingApproval)}
          loading={attention.loading}
          tone={awaitingApproval > 0 ? "warning" : "neutral"}
          linkText="Weekly bucket approvals"
          onClick={() => onNavigate("weeklyBucketApprovals")}
        />
        <KpiCard
          label="Waiting for your approval"
          value={formatCount(pendingForMe)}
          loading={attention.loading}
          tone={pendingForMe > 0 ? "warning" : "success"}
          meta={attention.approvals.map((approval) => `${approval.label}: ${formatCount(approval.count)}`).join(" · ") || "Nothing pending"}
          linkText={pendingForMe > 0 ? "Review" : undefined}
          onClick={pendingForMe > 0 ? () => onNavigate(attention.approvals[0].navKey) : undefined}
        />
      </div>

      <div className="pdash-panels">
        <Card
          title="Recent purchase orders"
          subtitle="Orders created in your ERP"
          actions={
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => onNavigate("purchaseOrders")}>
              View all
            </button>
          }
        >
          <RecentPurchaseOrderList side="buyer" classPrefix={classPrefix} />
        </Card>
        <Card title="Purchasing screens" subtitle="Everything under Purchasing">
          <div className="pdash-links">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("product")}>Product Catalog</button>
            {(bucketRole === "requester" || bucketRole === "reviewer") && (
              <>
                <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("wishlist")}>Wishlist</button>
                <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("cart")}>Cart</button>
              </>
            )}
            {bucketRole && (
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("weeklyBucket")}>Weekly Bucket</button>
            )}
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("purchaseOrders")}>Purchase Orders</button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default PurchasingDashboard;
