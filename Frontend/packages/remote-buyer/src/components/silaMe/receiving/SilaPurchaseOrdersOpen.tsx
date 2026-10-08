import React, { useCallback, useState } from "react";
import { PageHeader } from "@vosox/shared-ui";
import { getOpenPurchaseOrders, type SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaPurchaseOrderDialog from "./SilaPurchaseOrderDialog";
import { formatAmount, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

/** Purchase orders with quantity still to receive, searched by PO number or supplier, with their lines. */
const SilaPurchaseOrdersOpen: React.FC = () => {
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [openId, setOpenId] = useState<string | null>(null);
  const load = useCallback((page: SilaPage) => getOpenPurchaseOrders(term, page), [term]);
  const list = usePagedList(load, "Could not load the open purchase orders.");
  const closeDetail = useCallback(() => setOpenId(null), []);

  return (
    <div className="sila-me srcv-page">
      <PageHeader className="pud-page-header" title="Open purchase orders" description="Orders with quantity still to receive, by PO number or supplier." />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-po-search">Search</label>
            <input
              id="srcv-po-search"
              className="sila-input"
              type="search"
              placeholder="PO number or supplier"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
        </div>
        <PagedListBody list={list} noun="open purchase orders" emptyTitle="No open purchase orders" emptyDescription="Orders with quantity still to receive appear here once they are imported or read from the ERP.">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">PO number</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Order date</th>
                  <th scope="col">Expected delivery</th>
                  <th scope="col">Open lines</th>
                  <th scope="col">Total</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.poNumber}</span>
                      <span className="srcv-sub">{row.lineCount} line item{row.lineCount === 1 ? "" : "s"}</span>
                    </td>
                    <td>{row.entityCode || "—"}</td>
                    <td>{row.supplierName || "—"}</td>
                    <td>{formatDate(row.orderDate)}</td>
                    <td>{row.deliveryDate ? formatDate(row.deliveryDate) : "—"}</td>
                    <td>{row.openLineCount} / {row.lineCount}</td>
                    <td>
                      {formatAmount(row.totalAmount, row.currency)}
                      {row.totalOrderedQuantity != null && <span className="srcv-sub">{row.totalOrderedQuantity.toLocaleString()} ordered</span>}
                    </td>
                    <td><span className={receivingBadgeClass(row.status)}>{receivingLabel(row.status)}</span></td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Open purchase order ${row.poNumber}`}
                        onClick={() => setOpenId(row.id)}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
      {openId && <SilaPurchaseOrderDialog purchaseOrderId={openId} onClose={closeDetail} />}
    </div>
  );
};

export default SilaPurchaseOrdersOpen;
