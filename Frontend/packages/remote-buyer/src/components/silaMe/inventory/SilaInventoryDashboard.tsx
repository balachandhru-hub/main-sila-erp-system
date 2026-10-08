import React, { useCallback, useEffect, useState } from "react";
import { BarList, ChartCard, EmptyState, KpiCard, Loader, PageHeader } from "@vosox/shared-ui";
import { formatQty, getMyLocations, silaLabel, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import {
  getInventoryDashboard,
  type SilaDashboardFilter,
  type SilaInventoryDashboard as Dashboard,
} from "../../../api/silaMe/silaInventoryControlApi";
import SilaDashboardActions from "./SilaDashboardActions";
import SilaDashboardReplenishment from "./SilaDashboardReplenishment";
import SilaDashboardSearch, { type SilaDashboardTarget } from "./SilaDashboardSearch";
import SilaStockHealthCard from "./SilaStockHealthCard";
import "../silaMeTheme.css";
import "./SilaInventory.css";

interface SilaInventoryDashboardProps {
  /** MANAGE_SILA_TRANSFER: raise replenishment transfers. */
  canTransfer?: boolean;
  /** REQUEST_SILA_PURCHASE: raise purchase requests. */
  canRequestPurchase?: boolean;
  /**
   * Opens Live Inventory (with the header search query, to pass on as SilaLiveInventory initialSearch) or the
   * transfers screen. Without it the header search and shortcuts are hidden.
   */
  onNavigate?: (key: SilaDashboardTarget, query?: string) => void;
}

const money = (value: number, currency?: string | null): string =>
  `${currency ? `${currency} ` : ""}${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

/** Inventory control center of the caller's stores and outlets, narrowed by location, type and material group. */
const SilaInventoryDashboard: React.FC<SilaInventoryDashboardProps> = ({ canTransfer = true, canRequestPurchase = false, onNavigate }) => {
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [filter, setFilter] = useState<SilaDashboardFilter>({});
  const [groupInput, setGroupInput] = useState("");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    getMyLocations()
      .then((data) => {
        if (active) setLocations(data);
      })
      .catch(() => {
        // The picker stays empty; the dashboard itself still loads for all the caller's locations.
        if (active) setLocations([]);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getInventoryDashboard(filter)
      .then((data) => {
        if (active) setDashboard(data);
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the inventory dashboard.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [filter, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const currency = dashboard?.currency;
  const note = (key: string) => dashboard?.kpis.notes?.find((item) => item.key === key);
  const kpiValue = (key: string, value: string | number) => (note(key)?.configured === false ? "Not configured" : value);

  return (
    <div className="sila-me sinv-page">
      <PageHeader
        className="pud-page-header"
        title="Inventory Control Center"
        description="Real-time stock visibility, replenishment, transfers and inventory exceptions."
        actions={onNavigate ? <SilaDashboardSearch onNavigate={onNavigate} canTransfer={canTransfer} /> : undefined}
      />

      <section className="sila-card">
        <div className="sinv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-dash-location">Location</label>
            <select
              id="sinv-dash-location"
              className="sila-select"
              value={filter.locationId ?? ""}
              onChange={(event) => setFilter((current) => ({ ...current, locationId: event.target.value || undefined }))}
            >
              <option value="">All my locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.locationName} ({location.locationCode}){location.locationType === "VENUE" ? " · venue" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-dash-date">Business date</label>
            <input
              id="sinv-dash-date"
              type="date"
              className="sila-input"
              value={filter.businessDate ?? ""}
              onChange={(event) => setFilter((current) => ({ ...current, businessDate: event.target.value || undefined }))}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-dash-type">Location type</label>
            <select
              id="sinv-dash-type"
              className="sila-select"
              value={filter.locationType ?? ""}
              onChange={(event) => setFilter((current) => ({ ...current, locationType: event.target.value || undefined }))}
            >
              <option value="">Stores and outlets</option>
              <option value="STORE">Stores</option>
              <option value="OUTLET">Outlets</option>
            </select>
          </div>
          <form
            className="sinv-inline"
            onSubmit={(event) => {
              event.preventDefault();
              setFilter((current) => ({ ...current, materialGroup: groupInput.trim() || undefined }));
            }}
          >
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-dash-group">Material group</label>
              <input
                id="sinv-dash-group"
                className="sila-input"
                value={groupInput}
                maxLength={100}
                onChange={(event) => setGroupInput(event.target.value)}
              />
            </div>
            <button type="submit" className="sila-btn sila-btn--secondary">Apply</button>
          </form>
          <button type="button" className="sila-btn sila-btn--ghost" disabled={loading} onClick={reload}>
            Refresh
          </button>
        </div>
      </section>

      {loading && !dashboard ? (
        <Loader size={24} message="Loading the dashboard..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the dashboard"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={reload}>Try again</button>}
        />
      ) : !dashboard ? null : (
        <>
          <div className="sila-kpi-grid">
            <KpiCard label="Stock value" value={kpiValue("STOCK_VALUE", money(dashboard.kpis.stockValue, currency))} meta={note("STOCK_VALUE")?.note} tone="primary" />
            <KpiCard
              label="Low stock"
              value={kpiValue("LOW_STOCK", dashboard.kpis.lowStock)}
              meta={note("LOW_STOCK")?.note}
              tone={dashboard.kpis.lowStock > 0 ? "warning" : "success"}
            />
            <KpiCard
              label="Out of stock"
              value={kpiValue("OUT_OF_STOCK", dashboard.kpis.outOfStock)}
              meta={note("OUT_OF_STOCK")?.note}
              tone={dashboard.kpis.outOfStock > 0 ? "danger" : "success"}
            />
            <KpiCard
              label="Negative stock"
              value={dashboard.kpis.negativeStock}
              meta={note("NEGATIVE_STOCK")?.note}
              tone={dashboard.kpis.negativeStock > 0 ? "danger" : "neutral"}
            />
            <KpiCard label="Open transfers" value={dashboard.kpis.openTransfers} meta={note("OPEN_TRANSFERS")?.note} />
            <KpiCard label="Open counts" value={dashboard.kpis.openCounts} meta={note("OPEN_COUNTS")?.note} />
            <KpiCard
              label="Open alerts"
              value={dashboard.kpis.openAlerts}
              meta={note("OPEN_ALERTS")?.note}
              tone={dashboard.kpis.openAlerts > 0 ? "warning" : "neutral"}
            />
          </div>

          <div className="sila-dash-grid">
            <div className="sila-span-6">
              <SilaStockHealthCard health={dashboard.health} month={dashboard.month} />
            </div>
            <div className="sila-span-6">
              <ChartCard
                title="Transfer Center"
                empty={dashboard.transferStages.every((stage) => stage.count === 0)}
                emptyText="No transfers currently in transit."
              >
                <BarList
                  preserveOrder
                  items={dashboard.transferStages.map((stage) => ({ key: stage.status, label: stage.label || silaLabel(stage.status), value: stage.count }))}
                />
              </ChartCard>
            </div>
          </div>

          <SilaDashboardActions actions={dashboard.actions} canRequestPurchase={canRequestPurchase} canTransfer={canTransfer} onChanged={reload} />
          <SilaDashboardReplenishment
            rows={dashboard.replenishment}
            canTransfer={canTransfer}
            canRequestPurchase={canRequestPurchase}
            onChanged={reload}
          />

          <div className="sila-dash-grid">
            <div className="sila-span-6">
              <ChartCard
                title="Inventory Movement Today"
                empty={dashboard.movementToday.every((bucket) => bucket.count === 0)}
                emptyText="No inventory movements today."
              >
                <BarList
                  preserveOrder
                  items={dashboard.movementToday.map((bucket) => ({
                    key: bucket.key,
                    label: bucket.label,
                    value: bucket.count,
                    display:
                      bucket.configured === false
                        ? "Not configured"
                        : bucket.count === 0
                          ? "No activity"
                          : `${bucket.count} ${bucket.count === 1 ? "movement" : "movements"}`,
                    detail: bucket.value ? money(bucket.value, currency) : bucket.note,
                  }))}
                />
              </ChartCard>
            </div>
            <div className="sila-span-6">
              <ChartCard
                title="Inventory by Location"
                empty={dashboard.valueByLocation.length === 0}
                emptyText="No inventory value for the selected context."
              >
                <BarList
                  items={dashboard.valueByLocation.map((row) => ({
                    key: row.aggregated ? "other-locations" : row.locationId,
                    label: row.locationName,
                    value: row.value,
                    display: `${money(row.value, currency)} · ${row.sharePercent}%`,
                    detail: row.aggregated ? "Aggregated" : `${row.locationCode} · ${silaLabel(row.locationType)}`,
                  }))}
                />
              </ChartCard>
            </div>
            <div className="sila-span-12">
              <ChartCard
                title="Top Consumption"
                subtitle="Last 7 days"
                empty={dashboard.topConsumption.length === 0}
                emptyText="No consumption transactions in the last 7 days."
              >
                <BarList
                  items={dashboard.topConsumption.map((row) => ({
                    key: row.materialId,
                    label: `${row.materialCode} · ${row.materialName}`,
                    value: row.value > 0 ? row.value : row.quantity,
                    display: `${formatQty(row.quantity)} ${row.uom}`,
                    detail: [row.value > 0 ? money(row.value, currency) : null, row.locationName].filter(Boolean).join(" · ") || undefined,
                  }))}
                />
              </ChartCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SilaInventoryDashboard;
