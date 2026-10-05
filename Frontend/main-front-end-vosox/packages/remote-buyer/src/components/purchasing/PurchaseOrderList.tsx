import React, { useCallback } from "react";
import { PageHeader, StatusBadge } from "@vosox/shared-ui";
import { getPurchaseOrders, type PurchaseOrderListItem } from "../../api/purchaseOrderApi";
import type { SilaPage } from "../../api/silaMe/silaReceivingApi";
import { formatDate, formatPrice } from "../cart/lineFormat";
import PagedListBody from "../silaMe/receiving/PagedListBody";
import { usePagedList } from "../silaMe/receiving/usePagedList";
import "./Purchasing.css";

/** The organization's purchase orders (created in the ERP from weekly buckets and RFQs), newest first, paged. */
const PurchaseOrderList: React.FC = () => {
  const load = useCallback((page: SilaPage) => getPurchaseOrders("buyer", page.limit, page.index), []);
  const list = usePagedList<PurchaseOrderListItem>(load, "Could not load purchase orders.");

  return (
    <div className="pdash-page">
      <PageHeader title="Purchase Orders" description="Orders created in your ERP, newest first." />
      <section className="sila-card">
        <PagedListBody list={list} noun="purchase orders" emptyTitle="No purchase orders yet">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">PO number</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Weekly bucket</th>
                  <th scope="col">Plant</th>
                  <th scope="col">Order date</th>
                  <th scope="col">Status</th>
                  <th scope="col">Items</th>
                  <th scope="col">Total</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((order) => (
                  <tr key={order.id}>
                    <td className="sila-cell-strong"><span className="sila-ref">{order.poNumber}</span></td>
                    <td>{order.supplierName || "—"}</td>
                    <td>{order.bucketCode || "—"}</td>
                    <td>{order.plantCode || "—"}</td>
                    <td>{formatDate(order.orderDate)}</td>
                    <td><StatusBadge status={order.status} size="sm" /></td>
                    <td>{order.itemCount}</td>
                    <td>{formatPrice(order.totalAmount, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
    </div>
  );
};

export default PurchaseOrderList;
