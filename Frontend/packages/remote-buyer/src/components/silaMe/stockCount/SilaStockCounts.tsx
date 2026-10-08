import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, Pagination, toastService } from "@vosox/shared-ui";
import { getMyLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import {
  SILA_COUNT_TYPES,
  createStockCount,
  getStockCounts,
  type SilaCountType,
  type SilaStockCountListItem,
} from "../../../api/silaMe/silaStockCountApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import { todayInput } from "../movements/movementFormat";
import SilaStockCountSheet from "./SilaStockCountSheet";
import { formatMoney, scBadgeClass, scLabel } from "./stockCountFormat";
import "../silaMeTheme.css";
import "./StockCount.css";

export interface SilaStockCountsProps {
  /** The user may approve submitted counts (APPROVE_SILA_STOCK_COUNT). */
  canApprove: boolean;
  /** Opens this count directly, e.g. one started from an alert. */
  initialCountId?: string | null;
}

const PAGE_SIZE = 50;

const STATUSES = ["IN_PROGRESS", "SUBMITTED", "ENQUIRY_PENDING", "POSTED", "CANCELLED"];

interface NewCountForm {
  locationId: string;
  countType: SilaCountType;
  blindCount: boolean;
  notes: string;
  /** yyyy-mm-dd */
  businessDate: string;
}

const EMPTY_FORM: NewCountForm = { locationId: "", countType: "MONTHLY", blindCount: true, notes: "", businessDate: "" };

/** Stock counts of the user's locations, the new-count dialog and the count sheet. */
const SilaStockCounts: React.FC<SilaStockCountsProps> = ({ canApprove, initialCountId = null }) => {
  const [rows, setRows] = useState<SilaStockCountListItem[]>([]);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openedId, setOpenedId] = useState<string | null>(initialCountId);
  const [creating, setCreating] = useState(false);
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [form, setForm] = useState<NewCountForm>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getStockCounts(status || undefined, undefined, (page - 1) * PAGE_SIZE, PAGE_SIZE));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the stock counts.");
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!creating) return;
    setLocationsError(null);
    getMyLocations()
      .then(setLocations)
      .catch((err: unknown) => setLocationsError(err instanceof Error ? err.message : "Could not load your locations."));
  }, [creating]);

  const openNew = () => {
    setForm({ ...EMPTY_FORM, businessDate: todayInput() });
    setFormError(null);
    setCreating(true);
  };

  const create = async () => {
    if (!form.locationId) {
      setFormError("Select the location to count.");
      return;
    }
    if (!form.businessDate) {
      setFormError("Enter the business date of the count.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const id = await createStockCount({
        locationId: form.locationId,
        countType: form.countType,
        blindCount: form.blindCount,
        notes: form.notes.trim() || null,
        businessDate: form.businessDate,
      });
      toastService.success("Stock count started.");
      setCreating(false);
      setOpenedId(id);
      load();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not start the stock count.");
    } finally {
      setSaving(false);
    }
  };

  if (openedId) {
    return (
      <div className="sila-root sila-me sc-stack">
        <PageHeader className="pud-page-header" title="Stock count" onBack={() => setOpenedId(null)} backLabel="Back to stock counts" />
        <SilaStockCountSheet stockCountId={openedId} canApprove={canApprove} onChanged={load} />
      </div>
    );
  }

  return (
    <div className="sila-root sila-me sc-stack">
      <PageHeader
        className="pud-page-header"
        title="Stock Count"
        description="Monthly, periodic, surprise and ad hoc counts use the materials already assigned to the location."
        actions={<button type="button" className="sila-btn sila-btn--primary" onClick={openNew}>New stock count</button>}
      />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Counts</h2>
          <div className="sila-field sc-filter">
            <label className="sila-label" htmlFor="sc-status-filter">Status</label>
            <select id="sc-status-filter" className="sila-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUSES.map((value) => (
                <option key={value} value={value}>{scLabel(value)}</option>
              ))}
            </select>
          </div>
        </div>
        {loading ? (
          <Loader size={24} message="Loading stock counts..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load stock counts"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title={page > 1 ? "No more stock counts" : "No stock counts yet"} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Count</th>
                  <th scope="col">Type</th>
                  <th scope="col">Property</th>
                  <th scope="col">Location</th>
                  <th scope="col">Business date</th>
                  <th scope="col" className="sila-num">Materials</th>
                  <th scope="col" className="sila-num">Counted</th>
                  <th scope="col" className="sila-num">Matched</th>
                  <th scope="col" className="sila-num">Shortage</th>
                  <th scope="col" className="sila-num">Surplus</th>
                  <th scope="col" className="sila-num">Shortage value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Created by</th>
                  <th scope="col" className="sila-cell-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{row.countNumber}</td>
                    <td>
                      {scLabel(row.countType)}
                      {row.blindCount && <span className="sc-sub">Blind count</span>}
                    </td>
                    <td>{row.propertyName || "—"}</td>
                    <td>{row.locationName || "—"}</td>
                    <td>
                      {row.businessDate ? formatDate(row.businessDate) : "—"}
                      <span className="sc-sub">Started {formatDateTime(row.dateCreated)}</span>
                    </td>
                    <td className="sila-num">{row.totalItems}</td>
                    <td className="sila-num">{row.countedItems}</td>
                    <td className="sila-num">{row.matchedItems ?? 0}</td>
                    <td className="sila-num">{row.shortageItems}</td>
                    <td className="sila-num">{row.surplusItems}</td>
                    <td className="sila-num">
                      {row.shortageValue == null ? "—" : `${row.currency ? `${row.currency} ` : ""}${formatMoney(row.shortageValue)}`}
                    </td>
                    <td><span className={scBadgeClass(row.status)}>{scLabel(row.status)}</span></td>
                    <td>{row.createdByName || "—"}</td>
                    <td className="sila-cell-actions">
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Open ${row.countNumber}`}
                        onClick={() => setOpenedId(row.id)}
                      >
                        {row.status === "IN_PROGRESS" ? "Count" : "Open"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && !error && (page > 1 || rows.length === PAGE_SIZE) && (
          <Pagination
            page={page}
            hasNext={rows.length === PAGE_SIZE}
            onPrevious={() => setPage((current) => Math.max(1, current - 1))}
            onNext={() => setPage((current) => current + 1)}
          />
        )}
      </section>

      <Modal
        isOpen={creating}
        onClose={() => setCreating(false)}
        headerProps={{ heading: "New stock count" }}
        footerProps={{
          secondaryButton: { text: "Cancel", onClick: () => setCreating(false), disabled: saving },
          primaryButton: { text: "Start count", onClick: create, loading: saving },
        }}
      >
        <div className="sila-root sila-me sc-stack">
          {locationsError && <div className="sila-alert sila-alert--danger" role="alert">{locationsError}</div>}
          <div className="sila-field">
            <label className="sila-label" htmlFor="sc-new-location">Location<span className="sila-required">*</span></label>
            <select
              id="sc-new-location"
              className="sila-select"
              value={form.locationId}
              onChange={(event) => setForm({ ...form, locationId: event.target.value })}
            >
              <option value="">Select a location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName} ({location.locationCode}){location.propertyName ? `, ${location.propertyName}` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sc-new-date">Business date<span className="sila-required">*</span></label>
            <input
              id="sc-new-date"
              type="date"
              className="sila-input"
              value={form.businessDate}
              onChange={(event) => setForm({ ...form, businessDate: event.target.value })}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sc-new-type">Count type</label>
            <select
              id="sc-new-type"
              className="sila-select"
              value={form.countType}
              onChange={(event) => setForm({ ...form, countType: event.target.value as SilaCountType })}
            >
              {SILA_COUNT_TYPES.map((type) => (
                <option key={type} value={type}>{scLabel(type)}</option>
              ))}
            </select>
          </div>
          <label className="sc-checkbox">
            <input
              type="checkbox"
              checked={form.blindCount}
              onChange={(event) => setForm({ ...form, blindCount: event.target.checked })}
            />
            Blind count (counters do not see the system quantity)
          </label>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sc-new-notes">Notes</label>
            <textarea
              id="sc-new-notes"
              className="sila-textarea"
              rows={3}
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
            />
          </div>
          {formError && <div className="sila-alert sila-alert--danger" role="alert">{formError}</div>}
        </div>
      </Modal>
    </div>
  );
};

export default SilaStockCounts;
