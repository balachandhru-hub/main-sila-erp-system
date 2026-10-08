import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, PageHeader, Pagination } from "@vosox/shared-ui";
import { getLocations, getMyLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import {
  getTransfers,
  type SilaTransferFilters,
  type SilaTransferListItem,
  type SilaTransferTab,
} from "../../../api/silaMe/silaMovementsApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import SilaTransferDetail from "./SilaTransferDetail";
import SilaTransferForm from "./SilaTransferForm";
import { formatValue, movementBadgeClass, movementLabel, relationshipLabel } from "./movementFormat";
import "../silaMeTheme.css";
import "./SilaMovements.css";

interface SilaTransfersProps {
  /** Shows the "To approve" tab and the approve / reject / dispatch actions. */
  canApprove: boolean;
}

const TABS: { key: SilaTransferTab; label: string; approverOnly?: boolean }[] = [
  { key: "mine", label: "My requests" },
  { key: "to-approve", label: "To approve", approverOnly: true },
  { key: "in-transit", label: "In transit" },
  { key: "completed", label: "Completed" },
];

const PAGE_SIZE = 50;

const EMPTY_FILTERS: SilaTransferFilters = { mode: "", fromLocationId: "", toLocationId: "", propertyId: "", fromDate: "", toDate: "" };

const EMPTY_TEXT: Record<SilaTransferTab, string> = {
  mine: "You have not requested any transfer.",
  "to-approve": "No transfer waits for your approval or dispatch.",
  "in-transit": "Nothing is on its way to your locations.",
  completed: "No completed transfers yet.",
};

/** Internal transfer orders between the locations of one property. */
const SilaTransfers: React.FC<SilaTransfersProps> = ({ canApprove }) => {
  const [tab, setTab] = useState<SilaTransferTab>("mine");
  const [rows, setRows] = useState<SilaTransferListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [myLocationIds, setMyLocationIds] = useState<string[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [form, setForm] = useState<"standard" | "quick" | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState<SilaTransferFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getTransfers(tab, { ...filters, index: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the transfers.");
    } finally {
      setLoading(false);
    }
  }, [tab, filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Locations for the new-transfer forms.
  useEffect(() => {
    let active = true;
    Promise.all([getLocations(), getMyLocations()])
      .then(([all, mine]) => {
        if (!active) return;
        setLocations(all.filter((location) => location.transferEnabled));
        setMyLocationIds(mine.map((location) => location.id));
      })
      .catch((err: unknown) => {
        if (active) setLocationsError(err instanceof Error ? err.message : "Could not load the locations.");
      });
    return () => {
      active = false;
    };
  }, []);

  const properties = useMemo(() => {
    const byId = new Map<string, string>();
    locations.forEach((location) => byId.set(location.propertyId, location.propertyName));
    return Array.from(byId, ([id, name]) => ({ id, name }));
  }, [locations]);

  // Any filter or tab change starts again from the first page.
  const setFilter = (key: keyof SilaTransferFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setPage(1);
  };

  const selectTab = (key: SilaTransferTab) => {
    setTab(key);
    setPage(1);
  };

  const closeForm = useCallback(() => setForm(null), []);
  const closeDetail = useCallback(() => setOpenId(null), []);

  const afterCreate = (transferId: string) => {
    setForm(null);
    load();
    setOpenId(transferId || null);
  };

  const formsDisabled = Boolean(locationsError) || locations.length === 0;

  return (
    <div className="sila-me smov-page">
      <PageHeader
        className="pud-page-header"
        title="Internal transfers"
        description="One internal transfer order (ITO) for every location relationship. Standard and quick transfers share the same document and ledger."
        actions={
          <div className="sila-btn-group">
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              disabled={formsDisabled || myLocationIds.length === 0}
              onClick={() => setForm("quick")}
            >
              Quick transfer
            </button>
            <button type="button" className="sila-btn sila-btn--primary" disabled={formsDisabled} onClick={() => setForm("standard")}>
              New transfer
            </button>
          </div>
        }
      />

      {locationsError && (
        <div className="sila-alert sila-alert--warning" role="alert">
          New transfers are unavailable: {locationsError}
        </div>
      )}

      <section className="sila-card">
        <div className="sila-tabs" role="tablist" aria-label="Transfer lists">
          {TABS.filter((item) => canApprove || !item.approverOnly).map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              className="sila-tab"
              aria-selected={tab === item.key}
              onClick={() => selectTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="smov-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-ito-mode">Mode</label>
            <select id="smov-ito-mode" className="sila-select" value={filters.mode} onChange={(event) => setFilter("mode", event.target.value)}>
              <option value="">All modes</option>
              <option value="STANDARD">Standard</option>
              <option value="QUICK">Quick</option>
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-ito-property">Property</label>
            <select id="smov-ito-property" className="sila-select" value={filters.propertyId} onChange={(event) => setFilter("propertyId", event.target.value)}>
              <option value="">All properties</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>{property.name}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-ito-from">From</label>
            <select id="smov-ito-from" className="sila-select" value={filters.fromLocationId} onChange={(event) => setFilter("fromLocationId", event.target.value)}>
              <option value="">Any source</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.locationName}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-ito-to">To</label>
            <select id="smov-ito-to" className="sila-select" value={filters.toLocationId} onChange={(event) => setFilter("toLocationId", event.target.value)}>
              <option value="">Any destination</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.locationName}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-ito-date-from">Requested from</label>
            <input id="smov-ito-date-from" type="date" className="sila-input" value={filters.fromDate} onChange={(event) => setFilter("fromDate", event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-ito-date-to">Requested to</label>
            <input id="smov-ito-date-to" type="date" className="sila-input" value={filters.toDate} onChange={(event) => setFilter("toDate", event.target.value)} />
          </div>
        </div>

        {loading ? (
          <Loader size={24} message="Loading transfers..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the transfers"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No transfers" description={page > 1 ? "No more transfers." : EMPTY_TEXT[tab]} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">ITO number</th>
                  <th scope="col">Mode</th>
                  <th scope="col">From</th>
                  <th scope="col">To</th>
                  <th scope="col">Relationship</th>
                  <th scope="col">Requested</th>
                  <th scope="col">Required by</th>
                  <th scope="col" className="smov-num">Lines</th>
                  <th scope="col" className="smov-num">Value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Requested by</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{row.itoNumber}</td>
                    <td>{movementLabel(row.mode)}</td>
                    <td>{row.fromLocationName || "—"}</td>
                    <td>{row.toLocationName || "—"}</td>
                    <td>{relationshipLabel(row.transferRelationship)}</td>
                    <td>{formatDateTime(row.requestedOn)}</td>
                    <td>{formatDate(row.requiredBy)}</td>
                    <td className="smov-num">{row.lineCount}</td>
                    <td className="smov-num">{formatValue(row.totalValue, row.currency)}</td>
                    <td><span className={movementBadgeClass(row.status)}>{movementLabel(row.status)}</span></td>
                    <td>{row.requestedByName || row.requestedBy}</td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        onClick={() => setOpenId(row.id)}
                        aria-label={`Open ${row.itoNumber}`}
                      >
                        Open
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

      {form && (
        <SilaTransferForm
          quick={form === "quick"}
          locations={locations}
          myLocationIds={myLocationIds}
          onClose={closeForm}
          onCreated={afterCreate}
        />
      )}

      {openId && <SilaTransferDetail transferId={openId} canApprove={canApprove} onClose={closeDetail} onChanged={load} />}
    </div>
  );
};

export default SilaTransfers;
