import React, { useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
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
import { createTransfer } from "../../../api/silaMe/silaMovementsApi";
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
  const [pickingId, setPickingId] = useState<string | null>(null);

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

  // The right panel is for picking a source. Empty locations stay off it.
  const sourceRows = (detail?.locations ?? []).filter(
    (row) => row.onHandQty !== 0 || row.inTransitQty !== 0 || (row.reservedQty ?? 0) !== 0 || row.locationId === currentLocationId,
  );

  const pickSource = async (row: SilaLiveInventoryLocation) => {
    if (!canTransfer || !detail) return;
    if (!currentLocationId) {
      toastService.error("Select a transfer location first.");
      return;
    }
    if (row.locationId === currentLocationId) {
      toastService.error("Pick a different location as the source.");
      return;
    }
    const transferable = row.transferableQty ?? 0;
    if (!row.transferEnabled || transferable <= 0) {
      toastService.error(`${row.locationName} has no transferable stock.`);
      return;
    }
    const required = Number(requiredQty) || 0;
    const wanted = (detail.shortage ?? 0) > 0 ? (detail.shortage as number) : required > 0 ? required : 1;
    const quantity = Math.min(wanted, transferable);
    setPickingId(row.locationId);
    try {
      await createTransfer({
        fromLocationId: row.locationId,
        toLocationId: currentLocationId,
        reason: `Transfer from ${row.locationName}`,
        requiredBy: null,
        items: [{ materialId: detail.materialId, quantity, uom: null }],
      });
      toastService.success(`Transfer of ${formatQty(quantity)} ${detail.baseUom} from ${row.locationName} raised.`);
      setDetailKey((key) => key + 1);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not request the transfer.");
    } finally {
      setPickingId(null);
    }
  };

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
        description="Pick a material on the left. Click a location on the right to raise a transfer into the transfer location."
      />

      <div className="sinv-live-editor">
        <div className="sinv-live-stack">
          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Material search</h2>
            </div>
            <div className="sinv-filters">
              <div className="sila-field sinv-grow">
                <label className="sila-label" htmlFor="sinv-live-search">Search material</label>
                <input
                  id="sinv-live-search"
                  className="sila-input"
                  type="search"
                  placeholder="Material ID, name or barcode"
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
                  onChange={(event) => {
                    const value = event.target.value;
                    setLocationId(value);
                    if (value) setCurrentLocationId(value);
                  }}
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
                <ul className="sinv-pick-list">
                  {rows.map((row) => (
                    <li key={row.materialId}>
                      <button
                        type="button"
                        className={`sinv-pick${row.materialId === selectedId ? " sinv-pick--active" : ""}`}
                        aria-label={`Show stock per location of ${row.materialCode}`}
                        onClick={() => openDetail(row.materialId)}
                      >
                        <span>
                          <strong>{row.materialCode}</strong>
                          <span className="sinv-sub">{row.description}</span>
                        </span>
                        <em>{formatQty(row.onHandQty)} {row.baseUom}</em>
                      </button>
                    </li>
                  ))}
                </ul>
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

          {selectedId && detail && (
            <section className="sila-card">
              <div className="sila-card-header">
                <h2 className="sila-card-title">{detail.materialCode} · {detail.description}</h2>
                <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={() => setSelectedId(null)}>
                  Close
                </button>
              </div>
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
            </section>
          )}
        </div>

        <section className="sila-card" aria-live="polite">
          <div className="sila-card-header">
            <h2 className="sila-card-title">Availability by location</h2>
          </div>
          {!selectedId ? (
            <EmptyState title="Select a material" description="Location availability and transfer sources show here." />
          ) : detailLoading && !detail ? (
            <Loader size={24} message="Loading stock..." />
          ) : detailError ? (
            <EmptyState variant="error" title="Couldn't load the stock" description={detailError} />
          ) : !detail || sourceRows.length === 0 ? (
            <EmptyState title="No stock in your property" description="No location of your property holds this material." />
          ) : (
            <>
              <p className="sila-help sinv-pick-hint">Click a location with transferable stock to raise a transfer into the transfer location.</p>
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Location</th>
                      <th scope="col">Type</th>
                      <th scope="col">Property</th>
                      <th scope="col" className="sinv-num">On hand</th>
                      <th scope="col" className="sinv-num">Available</th>
                      <th scope="col" className="sinv-num">Transferable</th>
                      <th scope="col">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows.map((row) => {
                      const status = stockStatus(row);
                      const canPick = canTransfer && row.transferEnabled && (row.transferableQty ?? 0) > 0 && row.locationId !== currentLocationId;
                      return (
                        <tr
                          key={row.locationId}
                          className={canPick ? "sinv-row-button" : undefined}
                          onClick={canPick ? () => pickSource(row) : undefined}
                        >
                          <td>
                            <span className="sila-cell-strong">{row.locationName}</span>
                            <span className="sinv-sub">
                              {row.locationCode}
                              {pickingId === row.locationId ? " · Raising transfer..." : ""}
                            </span>
                          </td>
                          <td>{silaLabel(row.locationType)}</td>
                          <td>
                            {row.propertyName || "—"}
                            {row.propertyCode && <span className="sinv-sub">{row.propertyCode}</span>}
                          </td>
                          <td className="sinv-num">{formatQty(row.onHandQty)}</td>
                          <td className="sinv-num">{formatQty(row.availableQty ?? row.onHandQty)}</td>
                          <td className="sinv-num">{row.transferableQty ? formatQty(row.transferableQty) : "—"}</td>
                          <td><span className={`sila-badge ${status.badge}`}>{status.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default SilaLiveInventory;
