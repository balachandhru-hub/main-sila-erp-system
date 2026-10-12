import React, { useCallback, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { getGoodsReceipts, reprocessErpPosting, type SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaGoodsReceiptDialog from "./SilaGoodsReceiptDialog";
import SilaReceiveGoodsDialog from "./SilaReceiveGoodsDialog";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaGoodsReceiptsProps {
  /** POST_SILA_GRN: may receive goods. */
  canPost: boolean;
  /** MANAGE_SILA_ERP_POSTING: may reprocess failed S4 posts. */
  canReprocess?: boolean;
}

/** Goods receipts (GRN): step 1 stock, step 2 S4, with reprocess for failed ERP posts. */
const SilaGoodsReceipts: React.FC<SilaGoodsReceiptsProps> = ({ canPost, canReprocess = false }) => {
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const term = useDebounced(search);
  const [receiving, setReceiving] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const load = useCallback(
    (page: SilaPage) => getGoodsReceipts({ search: term, fromDate, toDate }, page),
    [term, fromDate, toDate],
  );
  const list = usePagedList(load, "Could not load the goods receipts.");
  const closeReceive = useCallback(() => setReceiving(false), []);
  const closeDetail = useCallback(() => setOpenId(null), []);

  const handlePosted = (goodsReceiptId: string) => {
    setReceiving(false);
    list.reload();
    setOpenId(goodsReceiptId);
  };

  const handleReprocess = async (postingId: string, grnNumber: string) => {
    setReprocessingId(postingId);
    try {
      await reprocessErpPosting(postingId);
      toastService.success(`${grnNumber} sent to S4 again.`);
      list.reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reprocess the posting.");
    } finally {
      setReprocessingId(null);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader
        className="pud-page-header"
        title="Goods receipts"
        description="Step 1 updates SILA stock for inventory materials. Step 2 posts those lines to S4. Reprocess failed S4 posts without changing stock."
        actions={canPost ? (
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setReceiving(true)}>Receive goods</button>
        ) : undefined}
      />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-grn-search">Search</label>
            <input id="srcv-grn-search" className="sila-input" type="search" placeholder="GRN, PO or delivery note" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-grn-from">From</label>
            <input id="srcv-grn-from" className="sila-input" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-grn-to">To</label>
            <input id="srcv-grn-to" className="sila-input" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </div>
        </div>
        <PagedListBody list={list} noun="goods receipts" emptyTitle="No goods receipts yet" emptyDescription="Posted receiving activity from the operation will appear here.">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">GRN</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Purchase order</th>
                  <th scope="col">ERP document</th>
                  <th scope="col">Received at</th>
                  <th scope="col">Lines</th>
                  <th scope="col">S4 status</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => {
                  const erpStatus = (row.erpStatus ?? "").toUpperCase();
                  const canSendAgain = canReprocess && !!row.erpPostingId && (erpStatus === "FAILED" || erpStatus === "SKIPPED");
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="sila-cell-strong">{row.grnNumber}</span>
                        <span className="srcv-sub">{row.locationName || "—"}</span>
                        {row.deliveryNote && <span className="srcv-sub">Delivery note {row.deliveryNote}</span>}
                      </td>
                      <td>{row.supplierName || "—"}</td>
                      <td>{row.poNumber}</td>
                      <td>{row.erpReference || "—"}</td>
                      <td>{formatDateTime(row.receivedOn)}</td>
                      <td>{row.lineCount}</td>
                      <td><span className={receivingBadgeClass(row.erpStatus ?? row.status)}>{receivingLabel(row.erpStatus ?? (row.erpPostingId ? row.status : "N/A"))}</span></td>
                      <td>
                        <div className="srcv-actions">
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Open goods receipt ${row.grnNumber}`} onClick={() => setOpenId(row.id)}>
                            Open
                          </button>
                          {canSendAgain && (
                            <button
                              type="button"
                              className="sila-btn sila-btn--secondary sila-btn--sm"
                              aria-label={`Reprocess ${row.grnNumber}`}
                              disabled={reprocessingId !== null}
                              onClick={() => handleReprocess(row.erpPostingId!, row.grnNumber)}
                            >
                              {reprocessingId === row.erpPostingId ? "Sending…" : "Reprocess"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
      {receiving && <SilaReceiveGoodsDialog onClose={closeReceive} onPosted={handlePosted} />}
      {openId && (
        <SilaGoodsReceiptDialog
          goodsReceiptId={openId}
          canReprocess={canReprocess}
          onClose={closeDetail}
          onChanged={list.reload}
        />
      )}
    </div>
  );
};

export default SilaGoodsReceipts;
