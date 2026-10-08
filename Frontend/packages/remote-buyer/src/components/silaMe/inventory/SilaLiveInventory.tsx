import React, { useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader } from "@vosox/shared-ui";
import {
  SILA_LIVE_PAGE_SIZE,
  formatQty,
  getLiveInventoryDetail,
  getMyLocations,
  searchLiveInventory,
  silaLabel,
  type SilaLiveInventoryDetail,
  type SilaLiveInventoryLocation,
  type SilaLiveInventoryRow,
  type SilaLocation,
} from "../../../api/silaMe/silaInventoryApi";
import SilaLiveDecisionPanel from "./SilaLiveDecisionPanel";
import "../silaMeTheme.css";
import "./SilaInventory.css";

const MIN_SEARCH = 2;

const STATUS_TEXT: Record<string, string> = {
  NEGATIVE: "Negative",
  OUT: "Out of stock",
  LOW: "Low stock",
  HEALTHY: "Healthy",
  EXCESS: "Excess stock",
  IN_STOCK: "In stock",
};

const STATUS_BADGE: Record<string, string> = {
  NEGATIVE: "sila-badge--danger",
  OUT: "sila-badge--danger",
  LOW: "sila-badge--warning",
  HEALTHY: "sila-badge--success",
  EXCESS: "sila-badge--info",
  IN_STOCK: "sila-badge--success",
};

interface SilaLiveInventoryProps {
  /** MANAGE_SILA_TRANSFER: request and quick transfers from the recommendation. */
  canTransfer?: boolean;
  /** REQUEST_SILA_PURCHASE: raise purchase requests from the recommendation. */
  canRequestPurchase?: boolean;
  /** Search text to start with, e.g. from the control center search box. */
  initialSearch?: string;
}

/**
 * Searches stock across the caller's locations; a material shows its stock per location within the property and the
 * next actions for the quantity required at the caller's location.
 */
const SilaLiveInventory: React.FC<SilaLiveInventoryProps> = ({ canTransfer = true, canRequestPurchase = false, initialSearch = "" }) => {
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [locationId, setLocationId] = useState("");
  const [rows, setRows] = useState<SilaLiveInventoryRow[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SilaLiveInventoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [currentLocationId, setCurrentLocationId] = useState("");
  const [requiredQty, setRequiredQty] = useState("");
  const [detailKey, setDetailKey] = useState(0);

  useEffect(() => {
    let active = true;
    getMyLocations()
      .then((data) => {
        if (active) setLocations(data);
      })
      .catch((err: unknown) => {
        if (active) setLocationsError(err instanceof Error ? err.message : "Could not load your locations.");
      });
    return () => {
      active = false;
    };
  }, []);

  const canSearch = search.trim().length >= MIN_SEARCH || Boolean(locationId);

  // Searches shortly after the user stops typing.
  useEffect(() => {
    if (!canSearch) {
      setRows([]);
      setHasMore(false);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const data = await searchLiveInventory(search, locationId || null, 0);
        if (!active) return;
        setRows(data);
        setHasMore(data.length === SILA_LIVE_PAGE_SIZE);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Could not search the inventory.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, locationId, canSearch]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const data = await searchLiveInventory(search, locationId || null, rows.length);
      setRows((current) => [...current, ...data]);
      setHasMore(data.length === SILA_LIVE_PAGE_SIZE);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not search the inventory.");
    } finally {
      setLoadingMore(false);
    }
  };

  const openDetail = (materialId: string) => {
    if (materialId !== selectedId) setDetail(null);
    setSelectedId(materialId);
  };

  // The detail reloads when the material, the location it is needed at or the required quantity changes.
  useEffect(() => {
    if (!selectedId) return;
    let active = true;
    setDetailError(null);
    setDetailLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const required = Number(requiredQty);
        const data = await getLiveInventoryDetail(selectedId, {
          requiredQty: Number.isFinite(required) && required > 0 ? required : undefined,
          currentLocationId: currentLocationId || undefined,
        });
        if (active) setDetail(data);
      } catch (err: unknown) {
        if (active) setDetailError(err instanceof Error ? err.message : "Could not load the stock of the material.");
      } finally {
        if (active) setDetailLoading(false);
      }
    }, 400);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [selectedId, currentLocationId, requiredQty, detailKey]);

  const stockLocations = locations.filter((location) => location.locationType !== "VENUE");

  const stockStatus = (row: SilaLiveInventoryLocation): { label: string; badge: string } => {
    if (row.stockStatus) {
      const badge = STATUS_BADGE[row.stockStatus] ?? "sila-badge--info";
      return { label: STATUS_TEXT[row.stockStatus] ?? silaLabel(row.stockStatus), badge };
    }
    if (row.onHandQty < 0) return { label: "Negative", badge: "sila-badge--danger" };
    if (row.onHandQty === 0) return { label: "Out of stock", badge: "sila-badge--danger" };
    if (row.minimumStock !== null && row.minimumStock !== undefined && row.onHandQty <= row.minimumStock) {
      return { label: "Low stock", badge: "sila-badge--warning" };
    }
    return { label: "In stock", badge: "sila-badge--success" };
  };

  return (
    <div className="sila-me sinv-page">
      <PageHeader
        className="pud-page-header"
        title="Live Inventory"
        description="Quantities come from the inventory ledger. Recommendations never auto-create transfers or purchase requests."
      />

      <section className="sila-card">
        <div className="sinv-filters">
          <div className="sila-field sinv-grow">
            <label className="sila-label" htmlFor="sinv-live-search">Search material</label>
            <input
              id="sinv-live-search"
              className="sila-input"
              type="search"
              placeholder="Code, description or barcode"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-live-location">Location</label>
            <select
              id="sinv-live-location"
              className="sila-select"
              value={locationId}
              onChange={(event) => setLocationId(event.target.value)}
            >
              <option value="">All my locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName} ({location.locationCode})
                </option>
              ))}
            </select>
            {locationsError && <span className="sila-error-text">{locationsError}</span>}
          </div>
        </div>
        {!canSearch ? (
          <EmptyState title="Search inventory" description={`Type at least ${MIN_SEARCH} characters or pick a location.`} />
        ) : loading ? (
          <Loader size={24} message="Searching..." />
        ) : error ? (
          <EmptyState variant="error" title="Couldn't search the inventory" description={error} />
        ) : rows.length === 0 ? (
          <EmptyState title="No materials found" />
        ) : (
          <>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Material</th>
                    <th scope="col">Base unit</th>
                    <th scope="col" className="sinv-num">On hand</th>
                    <th scope="col" className="sinv-num">In transit</th>
                    <th scope="col" className="sinv-num">Locations</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.materialId}
                      className={`sinv-row-button${row.materialId === selectedId ? " sinv-row-selected" : ""}`}
                      onClick={() => openDetail(row.materialId)}
                    >
                      <td>
                        <button
                          type="button"
                          className="sila-btn sila-btn--ghost sila-btn--sm"
                          aria-label={`Show stock per location of ${row.materialCode}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openDetail(row.materialId);
                          }}
                        >
                          {row.materialCode}
                        </button>
                        <span className="sinv-sub">{row.description}</span>
                      </td>
                      <td>{row.baseUom}</td>
                      <td className="sinv-num">{formatQty(row.onHandQty)}</td>
                      <td className="sinv-num">{formatQty(row.inTransitQty)}</td>
                      <td className="sinv-num">{row.locationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {hasMore && (
              <div className="sinv-pager">
                <span>{rows.length} materials</span>
                <button
                  type="button"
                  className="sila-btn sila-btn--secondary sila-btn--sm"
                  disabled={loadingMore}
                  onClick={loadMore}
                >
                  {loadingMore ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {selectedId && (
        <section className="sila-card" aria-live="polite">
          <div className="sila-card-header">
            <h2 className="sila-card-title">
              {detail ? `${detail.materialCode} · ${detail.description}` : "Availability by location"}
            </h2>
            <button
              type="button"
              className="sila-btn sila-btn--ghost sila-btn--sm"
              onClick={() => setSelectedId(null)}
            >
              Close
            </button>
          </div>
          {detail && (
            <SilaLiveDecisionPanel
              detail={detail}
              locations={stockLocations}
              currentLocationId={currentLocationId}
              requiredQty={requiredQty}
              onCurrentLocationChange={setCurrentLocationId}
              onRequiredQtyChange={setRequiredQty}
              canTransfer={canTransfer}
              canRequestPurchase={canRequestPurchase}
              onChanged={() => setDetailKey((key) => key + 1)}
            />
          )}
          {detailLoading && !detail ? (
            <Loader size={24} message="Loading stock..." />
          ) : detailError ? (
            <EmptyState variant="error" title="Couldn't load the stock" description={detailError} />
          ) : !detail || detail.locations.length === 0 ? (
            <EmptyState title="No stock in your property" description="No location of your property holds or stocks this material." />
          ) : (
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Location</th>
                    <th scope="col">Type</th>
                    <th scope="col">Property</th>
                    <th scope="col" className="sinv-num">On hand ({detail.baseUom})</th>
                    <th scope="col" className="sinv-num">Reserved</th>
                    <th scope="col" className="sinv-num">Available</th>
                    <th scope="col" className="sinv-num">In transit</th>
                    <th scope="col" className="sinv-num">Minimum stock</th>
                    <th scope="col" className="sinv-num">Transferable qty</th>
                    <th scope="col">Stock status</th>
                    <th scope="col">Stocking</th>
                    <th scope="col">Transfers</th>
                    <th scope="col">Last movement</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.locations.map((row) => {
                    const status = stockStatus(row);
                    return (
                      <tr key={row.locationId}>
                        <td>
                          <span className="sila-cell-strong">{row.locationName}</span>
                          <span className="sinv-sub">
                            {row.locationCode}
                            {row.isMine ? " · My location" : ""}
                          </span>
                        </td>
                        <td>{silaLabel(row.locationType)}</td>
                        <td>
                          {row.propertyName || "—"}
                          {row.propertyCode && <span className="sinv-sub">{row.propertyCode}</span>}
                        </td>
                        <td className="sinv-num">{formatQty(row.onHandQty)}</td>
                        <td className="sinv-num">{formatQty(row.reservedQty ?? 0)}</td>
                        <td className="sinv-num">{formatQty(row.availableQty ?? row.onHandQty)}</td>
                        <td className="sinv-num">{formatQty(row.inTransitQty)}</td>
                        <td className="sinv-num">{formatQty(row.minimumStock)}</td>
                        <td className="sinv-num">
                          {row.transferableQty ? formatQty(row.transferableQty) : "—"}
                          {row.transferableBasis && <span className="sinv-sub">{row.transferableBasis}</span>}
                        </td>
                        <td><span className={`sila-badge ${status.badge}`}>{status.label}</span></td>
                        <td>
                          {row.stockingStatus === "NOT_STOCKED" ? (
                            <span className="sila-badge sila-badge--neutral">Not stocked</span>
                          ) : row.stockingStatus ? (
                            <>
                              {silaLabel(row.stockingStatus)}
                              {row.stockingType && <span className="sinv-sub">{silaLabel(row.stockingType)}</span>}
                            </>
                          ) : "—"}
                        </td>
                        <td>{row.transferEnabled ? "Enabled" : "Disabled"}</td>
                        <td>{row.lastMovementOn ? new Date(row.lastMovementOn).toLocaleDateString() : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default SilaLiveInventory;
