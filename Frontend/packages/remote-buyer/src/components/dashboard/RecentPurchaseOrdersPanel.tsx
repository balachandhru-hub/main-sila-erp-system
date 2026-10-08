import React from "react";
import RecentPurchaseOrderList from "./RecentPurchaseOrderList";

/** Dashboard panel listing the buyer's newest purchase orders. */
const RecentPurchaseOrdersPanel: React.FC = () => (
  <section className="pud-panel">
    <div className="pud-panel-header">
      <div>
        <h2 className="pud-panel-title">Recent Purchase Orders</h2>
        <div className="pud-panel-subtitle">Orders created in your ERP</div>
      </div>
    </div>
    <RecentPurchaseOrderList side="buyer" classPrefix="pud" />
  </section>
);

export default RecentPurchaseOrdersPanel;
