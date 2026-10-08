import React, { useEffect, useState } from "react";
import { CalendarIcon, EmptyState, Loader, StatusBadge } from "@vosox/shared-ui";
import { getPurchaseOrders, type PurchaseOrderListItem, type PurchaseOrderSide } from "../../api/purchaseOrderApi";
import { formatDate, formatPrice } from "../cart/lineFormat";

interface RecentPurchaseOrderListProps {
  /** The buyer's own orders, or the orders addressed to the signed-in supplier. */
  side: PurchaseOrderSide;
  /** Class prefix of the dashboard that shows the list ("pud", "bad", "sad"). */
  classPrefix: string;
}

const RECENT_COUNT = 5;

/** The newest purchase orders of a dashboard's "Recent Purchase Orders" panel. */
const RecentPurchaseOrderList: React.FC<RecentPurchaseOrderListProps> = ({ side, classPrefix }) => {
  const [orders, setOrders] = useState<PurchaseOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPurchaseOrders(side, RECENT_COUNT)
      .then((result) => {
        if (active) setOrders(result);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load purchase orders.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [side]);

  if (loading) return <Loader size={24} message="Loading purchase orders..." />;
  if (error) return <EmptyState variant="error" title="Couldn't load purchase orders" description={error} />;
  if (orders.length === 0) return <EmptyState title="No purchase orders yet" />;

  return (
    <div className={`${classPrefix}-panel-list`}>
      {orders.map((order) => (
        <div className={`${classPrefix}-po-row`} key={order.id}>
          <div className={`${classPrefix}-po-info`}>
            <div className={`${classPrefix}-po-meta`}>
              <span className={`${classPrefix}-po-code sila-ref`}>{order.poNumber}</span>
              <StatusBadge status={order.status} size="sm" />
            </div>
            <div className={`${classPrefix}-po-company`}>
              {(side === "buyer" ? order.supplierName : order.buyerName) || "—"}
            </div>
            <div className={`${classPrefix}-po-date`}><CalendarIcon /> Order Date: {formatDate(order.orderDate)}</div>
          </div>
          <div className={`${classPrefix}-po-right`}>
            <div className={`${classPrefix}-po-amount`}>{formatPrice(order.totalAmount, order.currency)}</div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentPurchaseOrderList;
