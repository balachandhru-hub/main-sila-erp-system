import React from "react";
import RecentPurchaseOrderList from "../../../../remote-buyer/src/components/dashboard/RecentPurchaseOrderList";

/** Dashboard card listing the newest purchase orders buyers have placed with this supplier. */
const RecentPurchaseOrdersCard: React.FC = () => {
  return (
    <section className="sila-card pud-dash-card">
      <div className="sila-card-header">
        <div>
          <h2 className="sila-card-title">Recent Purchase Orders</h2>
          <p className="sila-card-subtitle">Orders placed with you by buyers</p>
        </div>
      </div>
      <RecentPurchaseOrderList side="supplier" classPrefix="pud" />
    </section>
  );
};

export default RecentPurchaseOrdersCard;
