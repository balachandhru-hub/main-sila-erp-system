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
import { createQuickTransfer, createTransfer } from "../../../api/silaMe/silaMovementsApi";
import SilaLiveDecisionPanel from "./SilaLiveDecisionPanel";
import "../silaMeTheme.css";
import "./SilaInventory.css";

const byCode = (locations: SilaLocation[], type: string): SilaLocation | undefined => locations
  .filter((location) => location.locationType === type)
  .sort((a, b) => a.locationCode.localeCompare(b.locationCode))[0];

/** Opens on the user's assigned store or outlet. One assignment wins; otherwise a store, then an outlet. */
const homeLocation = (locations: SilaLocation[]): SilaLocation | undefined => {
  const assigned = locations.filter((location) => location.assigned);
  const pool = assigned.length > 0 ? assigned : locations;
  const stocked = pool.filter((location) => location.locationType !== "VENUE");
  if (stocked.length === 1) return stocked[0];
  return byCode(stocked, "STORE") ?? byCode(stocked, "OUTLET") ?? pool[0];
};

/** Transfer destination: the user's outlet, or the home location when they have no outlet. */
const destinationLocation = (locations: SilaLocation[]): SilaLocation | undefined => {
  const assigned = locations.filter((location) => location.assigned);
  const pool = assigned.length > 0 ? assigned : locations;
  return byCode(pool, "OUTLET") ?? homeLocation(locations);
};

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
 * Stock at the signed-in user's assigned store or outlet. Removing the location searches a material
 * across every location they can open. Quick ITO and ITO send that stock to their outlet.
 */
const SilaLiveInventory: React.FC<SilaLiveInventoryProps> = ({ canTransfer = true, canRequestPurchase = false, initialSearch = "" }) => {
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [search, setSearch] = useState(initialSearch);
  const [locationQuery, setLocationQuery] = useState("");
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
        if (!active) return;
        setLocations(data);
        const home = homeLocation(data);
        const destination = destinationLocation(data);
        if (home) setLocationId(home.id);
        if (destination) setCurrentLocationId(destination.id);
      })
      .catch((err: unknown) => {
        if (active) setLocationsError(err instanceof Error ? err.message : "Could not load your locations.");
      });
    return () => {
      active = false;
    };
  }, []);

  const materialTerm = search.trim();
  const canSearch = Boolean(locationId) || materialTerm.length >= 2;

  // A location lists its stock immediately. Without one, a material search of two characters lists stock everywhere.
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
        if (!locationId) {
          setSelectedId(data.length === 1 ? data[0].materialId : null);
          if (data.length !== 1) setDetail(null);
        }
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Could not search the inventory.");
      } finally {
        if (active) setLoading(false);
      }
    }, locationId ? 100 : 300);
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
  const currentLocation = locations.find((location) => location.id === locationId);
  const destination = locations.find((location) => location.id === currentLocationId);
  const locationTerm = locationQuery.trim().toUpperCase();
  const locationMatches = locationTerm.length === 0
    ? []
    : locations
      .filter((location) => location.id !== locationId
        && `${location.locationCode} ${location.locationName} ${location.propertyName ?? ""}`.toUpperCase().includes(locationTerm))
      .slice(0, 8);

  const chooseLocation = (id: string) => {
    setLocationId(id);
    setLocationQuery("");
  };

  const clearLocation = () => {
    setLocationId("");
    setLocationQuery("");
    setRows([]);
    setSelectedId(null);
    setDetail(null);
  };

  // The right panel is for picking a source. Empty locations stay off it.
  const sourceRows = (detail?.locations ?? []).filter(
    (row) => row.onHandQty !== 0 || row.inTransitQty !== 0 || (row.reservedQty ?? 0) !== 0 || row.locationId === currentLocationId,
  );

  const sendTransfer = async (row: SilaLiveInventoryLocation, quick: boolean) => {
    if (!canTransfer || !detail) return;
    const destination = locations.find((location) => location.id === currentLocationId);
    if (!destination) {
      toastService.error("Choose the outlet that should receive the stock.");
      return;
    }
    if (row.locationId === destination.id) return;
    const transferable = row.transferableQty ?? 0;
    if (!row.transferEnabled || transferable <= 0) {
      toastService.error(`${row.locationName} has no transferable stock.`);
      return;
    }
    const required = Number(requiredQty) || 0;
    const wanted = (detail.shortage ?? 0) > 0 ? (detail.shortage as number) : required > 0 ? required : 1;
    const quantity = Math.min(wanted, transferable);
    setPickingId(`${row.locationId}:${quick ? "quick" : "ito"}`);
    try {
      const payload = {
        fromLocationId: row.locationId,
        toLocationId: destination.id,
        reason: quick ? "Guest service" : `Transfer from ${row.locationName}`,
        requiredBy: null,
        items: [{ materialId: detail.materialId, quantity, uom: null }],
      };
      if (quick) await createQuickTransfer(payload);
      else await createTransfer(payload);
      toastService.success(`${quick ? "Quick ITO" : "ITO"} of ${formatQty(quantity)} ${detail.baseUom} from ${row.locationName} to ${destination.locationCode} raised.`);
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
        description="Stock opens at your assigned store or outlet. Remove the location to search a material everywhere you can open it. Quick ITO and ITO send that stock to your outlet."
      />

      <div className="sinv-live-editor">
        <div className="sinv-live-stack">
          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Your location</h2>
            </div>
            <div className="sinv-filters">
              <div className="sila-field sinv-grow">
                <span className="sila-label">Showing stock at</span>
                {currentLocation ? (
                  <span className="sila-cell-strong">
                    {currentLocation.locationCode} · {currentLocation.locationName}
                    <span className="sinv-sub">{silaLabel(currentLocation.locationType)} · {currentLocation.propertyName}</span>
                    <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={clearLocation}>
                      Remove location
                    </button>
                  </span>
                ) : locations.length === 0 ? (
                  <span className="sila-help">{locationsError ?? "Loading your location..."}</span>
                ) : (
                  <span className="sila-help">All locations. Search a material to see its stock everywhere you can open.</span>
                )}
              </div>
              <div className="sila-field sinv-grow">
                <label className="sila-label" htmlFor="sinv-live-destination">Transfer to</label>
                <select
                  id="sinv-live-destination"
                  className="sila-select"
                  value={currentLocationId}
                  onChange={(event) => setCurrentLocationId(event.target.value)}
                >
                  {stockLocations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.locationCode} · {location.locationName}
                    </option>
                  ))}
                </select>
                {destination && <span className="sinv-sub">Receives the transfer. Starts as your outlet.</span>}
              </div>
              {locations.length > 1 && (
                <div className="sila-field sinv-grow">
                  <label className="sila-label" htmlFor="sinv-live-location">Search location</label>
                  <input
                    id="sinv-live-location"
                    className="sila-input"
                    type="search"
                    placeholder="Code, name or property"
                    value={locationQuery}
                    onChange={(event) => setLocationQuery(event.target.value)}
                  />
                </div>
              )}
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
            </div>
            {locationMatches.length > 0 && (
              <ul className="sinv-pick-list">
                {locationMatches.map((location) => (
                  <li key={location.id}>
                    <button type="button" className="sinv-pick" onClick={() => chooseLocation(location.id)}>
                      <span>
                        <strong>{location.locationCode}</strong>
                        <span className="sinv-sub">{location.locationName} · {silaLabel(location.locationType)} · {location.propertyName}</span>
                      </span>
                      <em>Use</em>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {locations.length > 1 && (
              <p className="sila-help sinv-pick-hint">Search a location to see stock at another outlet or property.</p>
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
            <span className="sila-help">
              {currentLocation ? `${currentLocation.locationCode} · ${currentLocation.propertyName}` : "All locations"}
            </span>
          </div>
          {!canSearch ? (
            locations.length === 0 && !locationsError ? (
              <Loader size={24} message="Loading your location..." />
            ) : (
              <EmptyState
                title={locationsError ? "Couldn't load your locations" : "Search a material"}
                description={locationsError ?? "Remove the location, then enter a material to see its stock at every location you can open."}
              />
            )
          ) : loading ? (
            <Loader size={24} message="Loading stock..." />
          ) : error ? (
            <EmptyState variant="error" title="Couldn't load the stock" description={error} />
          ) : rows.length === 0 ? (
            <EmptyState title="No materials found" description="This location has no stock matching the search." />
          ) : (
            <>
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col">Description</th>
                      <th scope="col" className="sinv-num">On hand</th>
                      <th scope="col" className="sinv-num">In transit</th>
                      {!locationId && <th scope="col" className="sinv-num">Locations</th>}
                      <th scope="col">UOM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.materialId}
                        className={`sinv-row-button${row.materialId === selectedId ? " sinv-row-selected" : ""}`}
                        onClick={() => openDetail(row.materialId)}
                      >
                        <td><span className="sila-cell-strong">{row.materialCode}</span></td>
                        <td>{row.description}</td>
                        <td className="sinv-num">{formatQty(row.onHandQty)}</td>
                        <td className="sinv-num">{formatQty(row.inTransitQty)}</td>
                        {!locationId && <td className="sinv-num">{row.locationCount}</td>}
                        <td>{row.baseUom}</td>
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
          {selectedId && (detailLoading && !detail ? (
            <Loader size={24} message="Loading other locations..." />
          ) : detailError ? (
            <EmptyState variant="error" title="Couldn't load the stock" description={detailError} />
          ) : detail && sourceRows.length > 0 && (
            <>
              <p className="sila-help sinv-pick-hint">
                {detail.materialCode} wherever it is in stock. Quick ITO or ITO sends it to {destination?.locationCode ?? "the transfer location"}.
              </p>
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
                      {canTransfer && <th scope="col">Transfer</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sourceRows.map((row) => {
                      const status = stockStatus(row);
                      const canPick = row.transferEnabled && (row.transferableQty ?? 0) > 0 && row.locationId !== currentLocationId;
                      return (
                        <tr key={row.locationId}>
                          <td>
                            <span className="sila-cell-strong">{row.locationName}</span>
                            <span className="sinv-sub">{row.locationCode}</span>
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
                          {canTransfer && (
                            <td>
                              {canPick && (
                                <span className="sinv-inline">
                                  <button
                                    type="button"
                                    className="sila-btn sila-btn--primary sila-btn--sm"
                                    disabled={pickingId !== null}
                                    onClick={() => sendTransfer(row, true)}
                                  >
                                    {pickingId === `${row.locationId}:quick` ? "Working..." : "Quick ITO"}
                                  </button>
                                  <button
                                    type="button"
                                    className="sila-btn sila-btn--secondary sila-btn--sm"
                                    disabled={pickingId !== null}
                                    onClick={() => sendTransfer(row, false)}
                                  >
                                    {pickingId === `${row.locationId}:ito` ? "Working..." : "ITO"}
                                  </button>
                                </span>
                              )}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ))}
        </section>
      </div>
    </div>
  );
};

export default SilaLiveInventory;
