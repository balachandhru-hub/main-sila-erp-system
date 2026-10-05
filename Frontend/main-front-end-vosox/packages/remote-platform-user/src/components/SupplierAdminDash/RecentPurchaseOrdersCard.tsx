import React from "react";
import RecentPurchaseOrderList from "../../../../remote-buyer/src/components/dashboard/RecentPurchaseOrderList";

/** Dashboard card listing the newest purchase orders buyers have placed with this supplier. */
const RecentPurchaseOrdersCard: React.FC = () => {
  return (
    <section className="sad-panel">
      <div className="sad-panel-header">
        <div>
          <h2 className="sad-panel-title">Recent Purchase Orders</h2>
          <div className="sad-panel-subtitle">Orders placed with you by buyers</div>
        </div>
      </div>
      <RecentPurchaseOrderList side="supplier" classPrefix="sad" />
    </section>
  );
};

export default RecentPurchaseOrdersCard;
