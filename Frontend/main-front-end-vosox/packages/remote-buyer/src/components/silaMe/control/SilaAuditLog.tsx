import React, { useCallback, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { getAuditLog, type SilaAuditEvent, type SilaAuditFilter } from "../../../api/silaMe/silaControlApi";
import type { SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import PagedListBody from "../receiving/PagedListBody";
import { usePagedList } from "../receiving/usePagedList";
import { scLabel } from "../stockCount/stockCountFormat";
import "../silaMeTheme.css";
import "../stockCount/StockCount.css";
import "./SilaControl.css";

const REFERENCE_TYPES: { value: string; label: string }[] = [
  { value: "STOCK_COUNT", label: "Stock count" },
  { value: "ENQUIRY", label: "Shortage enquiry" },
  { value: "PHYSICAL_INVENTORY", label: "Physical inventory" },
  { value: "ALERT", label: "Alert" },
  { value: "ITO", label: "Transfer" },
  { value: "GOODS_ISSUE", label: "Goods issue" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "GRN", label: "Goods receipt" },
  { value: "RECIPE", label: "Recipe" },
  { value: "MATERIAL_PRICE", label: "Material price" },
  { value: "PURCHASE_REQUEST", label: "Purchase request" },
  { value: "INVOICE", label: "Invoice" },
  { value: "MASTER_DATA", label: "Master data" },
];

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const typeLabel = (value: string): string => REFERENCE_TYPES.find((type) => type.value === value)?.label ?? scLabel(value);

interface Draft {
  referenceType: string;
  referenceId: string;
  from: string;
  to: string;
}

const EMPTY_DRAFT: Draft = { referenceType: "", referenceId: "", from: "", to: "" };

/** Who did what and when in SILA ME (counts, enquiries, alerts, physical inventories, transfers...). Gated by VIEW_SILA_AUDIT. */
const SilaAuditLog: React.FC = () => {
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [filter, setFilter] = useState<SilaAuditFilter>({});
  const [actor, setActor] = useState<{ id: string; name: string } | null>(null);

  const loadPage = useCallback(
    (page: SilaPage) => getAuditLog({ ...filter, actor: actor?.id }, page),
    [filter, actor],
  );
  const list = usePagedList(loadPage, "Could not load the audit log.");

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    const referenceId = draft.referenceId.trim();
    if (referenceId && !GUID.test(referenceId)) {
      toastService.error("Reference id must be the full id of a document.");
      return;
    }
    if (draft.from && draft.to && draft.from > draft.to) {
      toastService.error("The From date must be on or before the To date.");
      return;
    }
    setFilter({ referenceType: draft.referenceType, referenceId, from: draft.from, to: draft.to });
  };

  const showDocument = (event: SilaAuditEvent) => {
    setDraft({ ...draft, referenceType: event.referenceType, referenceId: event.referenceId });
    setFilter({ ...filter, referenceType: event.referenceType, referenceId: event.referenceId });
  };

  const clear = () => {
    setDraft(EMPTY_DRAFT);
    setFilter({});
    setActor(null);
  };

  return (
    <div className="sila-root sila-me sctl-stack">
      <PageHeader className="pud-page-header" title="Audit Log" />

      <section className="sila-card">
        <form className="sila-card-body sctl-filters" onSubmit={apply}>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sal-type">Document type</label>
            <select id="sal-type" className="sila-select" value={draft.referenceType} onChange={(e) => setDraft({ ...draft, referenceType: e.target.value })}>
              <option value="">All types</option>
              {REFERENCE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sal-reference">Document id</label>
            <input id="sal-reference" className="sila-input" autoComplete="off" value={draft.referenceId} onChange={(e) => setDraft({ ...draft, referenceId: e.target.value })} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sal-from">From</label>
            <input id="sal-from" type="date" className="sila-input" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sal-to">To</label>
            <input id="sal-to" type="date" className="sila-input" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </div>
          <div className="sctl-filter-actions">
            <button type="submit" className="sila-btn sila-btn--primary" disabled={list.loading}>Apply</button>
            <button type="button" className="sila-btn sila-btn--secondary" onClick={clear}>Clear</button>
          </div>
        </form>
        {actor && (
          <div className="sila-card-body">
            <span className="sctl-chip">
              User: {actor.name}
              <button type="button" className="sctl-link" aria-label={`Remove the user filter ${actor.name}`} onClick={() => setActor(null)}>
                Remove
              </button>
            </span>
          </div>
        )}
      </section>

      <section className="sila-card">
        <PagedListBody list={list} noun="audit events" emptyTitle="No events match the filters">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Document</th>
                  <th scope="col">Action</th>
                  <th scope="col">Details</th>
                  <th scope="col">User</th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => {
                  const name = row.actorName || (row.actorUserId === "00000000-0000-0000-0000-000000000000" ? "System" : "Unknown user");
                  return (
                    <tr key={row.id}>
                      <td>{formatDateTime(row.dateCreated)}</td>
                      <td>
                        <button
                          type="button"
                          className="sctl-link"
                          aria-label={`Show every event of ${row.referenceNumber ?? typeLabel(row.referenceType)}`}
                          onClick={() => showDocument(row)}
                        >
                          {row.referenceNumber || row.referenceId.slice(0, 8)}
                        </button>
                        <span className="sc-sub">{typeLabel(row.referenceType)}</span>
                      </td>
                      <td>{scLabel(row.action)}</td>
                      <td><span className="sctl-comment">{row.comment || "—"}</span></td>
                      <td>
                        <button
                          type="button"
                          className="sctl-link"
                          aria-label={`Show the events of ${name}`}
                          onClick={() => setActor({ id: row.actorUserId, name })}
                        >
                          {name}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
    </div>
  );
};

export default SilaAuditLog;
