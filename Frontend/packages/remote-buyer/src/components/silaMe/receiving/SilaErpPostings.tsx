import React, { useCallback, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { getErpPostings, reprocessErpPosting, type SilaErpPosting, type SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaReconcileDialog from "./SilaReconcileDialog";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaErpPostingsProps {
  /** MANAGE_SILA_ERP_POSTING: may send FAILED or SKIPPED postings again and reconcile UNKNOWN ones. */
  canReprocess: boolean;
}

const STATUSES = ["PENDING", "POSTED", "FAILED", "SKIPPED", "UNKNOWN"];

/**
 * Inventory documents and invoices queued for the ERP, with their outcome; failed or skipped ones can be sent again, and
 * UNKNOWN ones (no clear ERP answer) are reconciled after checking the ERP.
 */
const SilaErpPostings: React.FC<SilaErpPostingsProps> = ({ canReprocess }) => {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [reconciling, setReconciling] = useState<SilaErpPosting | null>(null);
  const load = useCallback((page: SilaPage) => getErpPostings(status, term, page), [status, term]);
  const list = usePagedList(load, "Could not load the ERP postings.");

  const handleReprocess = async (postingId: string, reference: string) => {
    setReprocessingId(postingId);
    try {
      await reprocessErpPosting(postingId);
      toastService.success(`${reference} is queued and will be sent within a minute.`);
      list.reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reprocess the posting.");
    } finally {
      setReprocessingId(null);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader className="pud-page-header" title="ERP postings" />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-erp-status">Status</label>
            <select id="srcv-erp-status" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((code) => <option key={code} value={code}>{receivingLabel(code)}</option>)}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-erp-search">Search</label>
            <input id="srcv-erp-search" className="sila-input" type="search" placeholder="Document or ERP reference" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
        </div>
        <PagedListBody list={list} noun="ERP postings" emptyTitle="No ERP postings">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Document</th>
                  <th scope="col">Movement</th>
                  <th scope="col">Location / company code</th>
                  <th scope="col">Created</th>
                  <th scope="col">Status</th>
                  <th scope="col">Attempts</th>
                  <th scope="col">ERP reference / error</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => {
                  const canSendAgain = canReprocess && (row.status === "FAILED" || row.status === "SKIPPED");
                  return (
                    <tr key={row.id}>
                      <td>
                        <span className="sila-cell-strong">{row.referenceNumber}</span>
                        <span className="srcv-sub">{receivingLabel(row.referenceType)}</span>
                      </td>
                      <td>{receivingLabel(row.movementType)}</td>
                      <td>
                        {row.locationName || "—"}
                        {row.companyCode && <span className="srcv-sub">Company code {row.companyCode}</span>}
                      </td>
                      <td>{formatDateTime(row.createdOn)}</td>
                      <td>
                        <span className={receivingBadgeClass(row.status)}>{receivingLabel(row.status)}</span>
                        {row.postedOn && <span className="srcv-sub">{formatDateTime(row.postedOn)}</span>}
                      </td>
                      <td>{row.attempts}</td>
                      <td>
                        {row.erpReference && <span className="sila-cell-strong">{row.erpReference}</span>}
                        {row.errorMessage && <span className="srcv-error">{row.errorMessage}</span>}
                        {!row.erpReference && !row.errorMessage && "—"}
                      </td>
                      <td>
                        {canReprocess && row.status === "UNKNOWN" && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`Reconcile ${row.referenceNumber}`}
                            disabled={reprocessingId !== null}
                            onClick={() => setReconciling(row)}
                          >
                            Reconcile
                          </button>
                        )}
                        {canSendAgain && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`Reprocess ${row.referenceNumber}`}
                            disabled={reprocessingId !== null}
                            onClick={() => handleReprocess(row.id, row.referenceNumber)}
                          >
                            {reprocessingId === row.id ? "Queuing..." : "Reprocess"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
      {reconciling && (
        <SilaReconcileDialog
          posting={reconciling}
          onClose={() => setReconciling(null)}
          onReconciled={() => {
            setReconciling(null);
            list.reload();
          }}
        />
      )}
    </div>
  );
};

export default SilaErpPostings;
