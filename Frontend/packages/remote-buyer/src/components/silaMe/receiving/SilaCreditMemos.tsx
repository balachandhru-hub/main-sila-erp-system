import React, { useCallback, useState } from "react";
import { PageHeader } from "@vosox/shared-ui";
import { getCreditMemos, type SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaCreditMemoDialog from "./SilaCreditMemoDialog";
import { formatAmount, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

export interface SilaCreditMemoSearchIntent {
  status?: string;
  creditMemoId?: string;
}

let pendingSearch: SilaCreditMemoSearchIntent = {};

export const queueSilaCreditMemoSearch = (intent: SilaCreditMemoSearchIntent): void => {
  pendingSearch = intent;
};

const takeSilaCreditMemoSearch = (): SilaCreditMemoSearchIntent => {
  const current = pendingSearch;
  pendingSearch = {};
  return current;
};

const STATUSES = ["IN_PROGRESS", "FAILED", "POSTED", "DRAFT", "READY_TO_POST", "POSTING", "ERP_POSTING_FAILED", "POSTING_UNKNOWN"];

interface SilaCreditMemosProps {
  canPost: boolean;
}

const SilaCreditMemos: React.FC<SilaCreditMemosProps> = ({ canPost }) => {
  const [intent] = useState(takeSilaCreditMemoSearch);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(intent.status ?? "");
  const [openId, setOpenId] = useState<string | null>(intent.creditMemoId ?? null);
  const [creating, setCreating] = useState(false);
  const term = useDebounced(search);
  const load = useCallback((page: SilaPage) => getCreditMemos(term, status, page), [term, status]);
  const list = usePagedList(load, "Could not load the credit memos.");

  const close = useCallback(() => {
    setOpenId(null);
    setCreating(false);
    list.reload();
  }, [list]);

  return (
    <div className="sila-me srcv-page">
      <PageHeader
        className="pud-page-header"
        title="Credit memos"
        description="Search credit memos by number, invoice, supplier, PO or SAP document."
        actions={canPost ? (
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setCreating(true)}>
            New credit memo
          </button>
        ) : undefined}
      />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-cm-search">Search</label>
            <input
              id="srcv-cm-search"
              className="sila-input"
              type="search"
              placeholder="Credit memo, invoice, supplier, PO or SAP"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-cm-status">Status</label>
            <select id="srcv-cm-status" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((code) => <option key={code} value={code}>{receivingLabel(code)}</option>)}
            </select>
          </div>
        </div>
        <PagedListBody list={list} noun="credit memos" emptyTitle="No credit memos yet" emptyDescription="Posted and draft credit memos will appear in this search.">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Credit memo</th>
                  <th scope="col">Reference invoice</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">PO</th>
                  <th scope="col">Gross</th>
                  <th scope="col">SAP</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.creditMemoNumber || "Credit memo"}</span>
                      <span className="srcv-sub">Created {formatDate(row.createdOn)}</span>
                    </td>
                    <td>
                      {row.referenceSupplierInvoiceNumber || "—"}
                      {row.referenceErpInvoiceId && <span className="srcv-sub">Invoice SAP {row.referenceErpInvoiceId}</span>}
                    </td>
                    <td>{row.supplierName || "—"}</td>
                    <td>{row.poNumber || "—"}</td>
                    <td>{formatAmount(row.grossAmount, row.currency)}</td>
                    <td>
                      {row.erpReference ? `SAP ${row.erpReference}` : "—"}
                      {row.fiscalYear && <span className="srcv-sub">{row.fiscalYear}</span>}
                    </td>
                    <td>
                      <span className={receivingBadgeClass(row.status)}>{receivingLabel(row.status)}</span>
                    </td>
                    <td>
                      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setOpenId(row.id)}>
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
      {(openId || creating) && (
        <SilaCreditMemoDialog
          creditMemoId={openId}
          onClose={close}
          onChanged={list.reload}
        />
      )}
    </div>
  );
};

export default SilaCreditMemos;
