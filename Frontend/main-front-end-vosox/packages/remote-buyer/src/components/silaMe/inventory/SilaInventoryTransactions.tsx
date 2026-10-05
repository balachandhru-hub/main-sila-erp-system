import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader } from "@vosox/shared-ui";
import {
  SILA_TRANSACTION_TYPES,
  formatQty,
  getInventoryTransactions,
  getMyLocations,
  silaLabel,
  type SilaInventoryTransaction,
  type SilaLocation,
} from "../../../api/silaMe/silaInventoryApi";
import "../silaMeTheme.css";
import "./SilaInventory.css";

const PAGE_SIZE = 50;

const formatDate = (value: string | null | undefined): string => (value ? new Date(value).toLocaleDateString() : "—");

/** The inventory ledger of the caller's locations, newest first. */
const SilaInventoryTransactions: React.FC = () => {
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [locationId, setLocationId] = useState("");
  const [type, setType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<SilaInventoryTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getMyLocations()
      .then((data) => {
        if (active) setLocations(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load your locations.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getInventoryTransactions({
      locationId: locationId || undefined,
      type: type || undefined,
      from: from || undefined,
      to: to || undefined,
      index: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        if (active) setRows(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the inventory transactions.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [locationId, type, from, to, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // Any filter change starts again from the first page.
  const filterSetter = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setPage(0);
  };

  return (
    <div className="sila-me sinv-page">
      <PageHeader className="pud-page-header" title="Inventory Transactions" description="The read-only inventory ledger of your locations, newest first." />

      <section className="sila-card">
        <div className="sinv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-txn-location">Location</label>
            <select
              id="sinv-txn-location"
              className="sila-select"
              value={locationId}
              onChange={(event) => filterSetter(setLocationId)(event.target.value)}
            >
              <option value="">All my locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName} ({location.locationCode})
                </option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-txn-type">Transaction type</label>
            <select
              id="sinv-txn-type"
              className="sila-select"
              value={type}
              onChange={(event) => filterSetter(setType)(event.target.value)}
            >
              <option value="">All types</option>
              {SILA_TRANSACTION_TYPES.map((option) => (
                <option key={option} value={option}>{silaLabel(option)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-txn-from">From</label>
            <input
              id="sinv-txn-from"
              className="sila-input"
              type="date"
              value={from}
              onChange={(event) => filterSetter(setFrom)(event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-txn-to">To</label>
            <input
              id="sinv-txn-to"
              className="sila-input"
              type="date"
              value={to}
              onChange={(event) => filterSetter(setTo)(event.target.value)}
            />
          </div>
        </div>
        {loading ? (
          <Loader size={24} message="Loading transactions..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the transactions"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={reload}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title={page > 0 ? "No more transactions" : "No transactions found"} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Transaction</th>
                  <th scope="col">Date</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Material</th>
                  <th scope="col" className="sinv-num">Quantity</th>
                  <th scope="col" className="sinv-num">Value</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{row.transactionNumber}</td>
                    <td>{formatDate(row.businessDate)}</td>
                    <td>
                      <span className={`sila-badge ${row.direction === "IN" ? "sila-badge--success" : "sila-badge--warning"}`}>
                        {row.direction}
                      </span>
                      <span className="sinv-sub">{silaLabel(row.transactionType)}</span>
                    </td>
                    <td>
                      {row.locationName || "—"}
                      <span className="sinv-sub">{row.locationCode}</span>
                    </td>
                    <td>
                      {row.materialCode || "—"}
                      <span className="sinv-sub">{row.materialDescription}</span>
                    </td>
                    <td className="sinv-num">
                      {row.direction === "OUT" ? "-" : ""}{formatQty(row.quantity)} {row.baseUom}
                      {row.enteredUom && row.enteredUom !== row.baseUom && (
                        <span className="sinv-sub">{formatQty(row.enteredQuantity)} {row.enteredUom}</span>
                      )}
                    </td>
                    <td className="sinv-num">{formatQty(row.value)}</td>
                    <td>
                      {row.referenceNumber || silaLabel(row.referenceType)}
                      {row.referenceNumber && <span className="sinv-sub">{silaLabel(row.referenceType)}</span>}
                      {row.reason && <span className="sinv-sub">{row.reason}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && (page > 0 || rows.length === PAGE_SIZE) && (
          <div className="sinv-pager">
            <span>Page {page + 1}</span>
            <div className="sinv-inline">
              <button
                type="button"
                className="sila-btn sila-btn--secondary sila-btn--sm"
                disabled={page === 0 || loading}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--secondary sila-btn--sm"
                disabled={rows.length < PAGE_SIZE || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default SilaInventoryTransactions;
