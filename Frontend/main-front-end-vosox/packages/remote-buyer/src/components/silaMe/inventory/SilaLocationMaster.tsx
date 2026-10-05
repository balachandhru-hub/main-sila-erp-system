import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import { getOutlets, type Outlet } from "../../../api/outletApi";
import { getProperties, type Property } from "../../../api/propertyApi";
import {
  SILA_LOCATION_TYPES,
  deactivateLocation,
  getLocations,
  silaLabel,
  type SilaLocation,
} from "../../../api/silaMe/silaInventoryApi";
import { downloadLocationExcel } from "../../../api/silaMe/silaInventoryControlApi";
import SilaLocationForm from "./SilaLocationForm";
import SilaLocationImportDialog from "./SilaLocationImportDialog";
import SilaLocationUsersDialog from "./SilaLocationUsersDialog";
import SilaLocationStockingDialog from "./SilaLocationStockingDialog";
import "../silaMeTheme.css";
import "./SilaInventory.css";

interface SilaLocationMasterProps {
  /** Create, edit, assign users, stocking levels, deactivate. */
  canManage: boolean;
}

type Dialog =
  | { kind: "form"; location: SilaLocation | null }
  | { kind: "users"; location: SilaLocation }
  | { kind: "stocking"; location: SilaLocation }
  | { kind: "deactivate"; location: SilaLocation }
  | { kind: "import" };

const typeBadge = (type: string): string =>
  type === "STORE" ? "sila-badge--info" : type === "VENUE" ? "sila-badge--neutral" : "sila-badge--accent";

/** The inventory locations (venues, stores and outlets) of every property, with Excel template, export and import. */
const SilaLocationMaster: React.FC<SilaLocationMasterProps> = ({ canManage }) => {
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [outlets, setOutlets] = useState<Outlet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [propertyFilter, setPropertyFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ACTIVE" | "INACTIVE" | "ALL">("ACTIVE");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"TABLE" | "TREE">("TABLE");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deactivating, setDeactivating] = useState(false);
  const [downloading, setDownloading] = useState<"template" | "export" | null>(null);

  const download = async (kind: "template" | "export") => {
    setDownloading(kind);
    try {
      await downloadLocationExcel(kind);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not download the file.");
    } finally {
      setDownloading(null);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [locationRows, propertyRows, outletRows] = await Promise.all([
        getLocations(statusFilter),
        canManage ? getProperties() : Promise.resolve<Property[]>([]),
        canManage ? getOutlets() : Promise.resolve<Outlet[]>([]),
      ]);
      setLocations(locationRows);
      setProperties(propertyRows);
      setOutlets(outletRows);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the locations.");
    } finally {
      setLoading(false);
    }
  }, [canManage, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const closeDialog = useCallback(() => setDialog(null), []);

  const afterSave = useCallback(() => {
    setDialog(null);
    load();
  }, [load]);

  // Property names come from the locations so the filter also works without the properties API.
  const propertyOptions = useMemo(() => {
    const names = new Map<string, string>();
    locations.forEach((location) => names.set(location.propertyId, location.propertyName || "—"));
    return Array.from(names.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [locations]);

  const term = search.trim().toLowerCase();
  const visible = locations.filter(
    (location) =>
      (!propertyFilter || location.propertyId === propertyFilter) &&
      (!typeFilter || location.locationType === typeFilter) &&
      (!term || location.locationCode.toLowerCase().includes(term) || location.locationName.toLowerCase().includes(term)),
  );

  // Tree view: property, then its venues with their stores and outlets, then the locations without a venue.
  const tree = (() => {
    const visibleIds = new Set(visible.map((location) => location.id));
    const byName = (a: SilaLocation, b: SilaLocation) => a.locationName.localeCompare(b.locationName);
    const rows: { property: string; propertyId: string; items: { location: SilaLocation; depth: number }[] }[] = [];
    propertyOptions.forEach(([propertyId, propertyName]) => {
      const inProperty = visible.filter((location) => location.propertyId === propertyId);
      if (inProperty.length === 0) return;
      const items: { location: SilaLocation; depth: number }[] = [];
      const childrenOf = (venueId: string) => inProperty.filter((location) => location.parentLocationId === venueId).sort(byName);
      inProperty
        .filter((location) => location.locationType === "VENUE")
        .sort(byName)
        .forEach((venue) => {
          items.push({ location: venue, depth: 0 });
          childrenOf(venue.id).forEach((child) => items.push({ location: child, depth: 1 }));
        });
      inProperty
        .filter(
          (location) =>
            location.locationType !== "VENUE" && (!location.parentLocationId || !visibleIds.has(location.parentLocationId)),
        )
        .sort(byName)
        .forEach((location) => items.push({ location, depth: 0 }));
      rows.push({ property: propertyName, propertyId, items });
    });
    return rows;
  })();

  const handleDeactivate = async (location: SilaLocation) => {
    setDeactivating(true);
    try {
      await deactivateLocation(location.id);
      toastService.success(`${location.locationName} deactivated.`);
      setDialog(null);
      load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not deactivate the location.");
    } finally {
      setDeactivating(false);
    }
  };

  const renderRow = (location: SilaLocation, depth = 0) => (
    <tr key={location.id}>
      <td className={depth > 0 ? "sinv-tree-child" : undefined}>
        <span className="sila-cell-strong">{location.locationName}</span>
        <span className="sinv-sub">
          {location.locationCode}
          {location.locationType === "OUTLET" && location.outletName ? ` · ${location.outletName}` : ""}
          {location.locationType === "STORE" && location.storeCategory ? ` · ${silaLabel(location.storeCategory)}` : ""}
        </span>
        {location.description && <span className="sinv-sub">{location.description}</span>}
      </td>
      <td>
        <span className={`sila-badge ${typeBadge(location.locationType)}`}>
          {silaLabel(location.locationType)}
        </span>
      </td>
      <td>
        {location.propertyName || "—"}
        {location.companyCode && <span className="sinv-sub">{location.companyCode}</span>}
      </td>
      <td>{location.parentLocationName || "—"}</td>
      <td>{location.storageLocationCode || "—"}</td>
      <td>{location.glAccount || "—"}</td>
      <td>{location.costCenter || "—"}</td>
      <td>{location.profitCenter || "—"}</td>
      <td>{location.transferEnabled ? "Yes" : "No"}</td>
      <td>{location.salesEnabled ? "Yes" : "No"}</td>
      <td>{location.inventoryEnabled === false ? "No" : "Yes"}</td>
      <td>{location.consumptionEnabled === false ? "No" : "Yes"}</td>
      <td className="sinv-num">{location.userCount ?? 0}</td>
      <td>
        <span className={`sila-badge ${location.status === "INACTIVE" ? "sila-badge--neutral" : "sila-badge--success"}`}>
          {location.status === "INACTIVE" ? "Inactive" : "Active"}
        </span>
      </td>
      {canManage && location.status === "INACTIVE" && <td />}
      {canManage && location.status !== "INACTIVE" && (
        <td className="sila-cell-actions">
          <div className="sinv-inline">
            <button
              type="button"
              className="sila-btn sila-btn--secondary sila-btn--sm"
              aria-label={`Edit ${location.locationName}`}
              onClick={() => setDialog({ kind: "form", location })}
            >
              Edit
            </button>
            <button
              type="button"
              className="sila-btn sila-btn--secondary sila-btn--sm"
              aria-label={`Assign users to ${location.locationName}`}
              onClick={() => setDialog({ kind: "users", location })}
            >
              Users
            </button>
            {location.locationType !== "VENUE" && (
              <button
                type="button"
                className="sila-btn sila-btn--secondary sila-btn--sm"
                aria-label={`Stocking levels of ${location.locationName}`}
                onClick={() => setDialog({ kind: "stocking", location })}
              >
                Stocking levels
              </button>
            )}
            <button
              type="button"
              className="sila-btn sila-btn--ghost sila-btn--sm"
              aria-label={`Deactivate ${location.locationName}`}
              onClick={() => setDialog({ kind: "deactivate", location })}
            >
              Deactivate
            </button>
          </div>
        </td>
      )}
    </tr>
  );

  if (loading) return <Loader size={24} message="Loading locations..." />;
  if (error) {
    return (
      <EmptyState
        variant="error"
        title="Couldn't load the locations"
        description={error}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
      />
    );
  }

  return (
    <div className="sila-me sinv-page">
      <PageHeader
        className="pud-page-header"
        title="Location Master"
        description="Venues, stores and outlets hang under a property. Stores and outlets may sit in a venue of the same property."
      />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Locations</h2>
          {canManage && (
            <div className="sinv-inline">
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--sm"
                disabled={downloading !== null}
                onClick={() => download("template")}
              >
                {downloading === "template" ? "Downloading..." : "Template"}
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--sm"
                disabled={downloading !== null}
                onClick={() => download("export")}
              >
                {downloading === "export" ? "Exporting..." : "Export"}
              </button>
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setDialog({ kind: "import" })}>
                Import
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--primary sila-btn--sm"
                onClick={() => setDialog({ kind: "form", location: null })}
              >
                New location
              </button>
            </div>
          )}
        </div>
        <div className="sinv-filters">
          <div className="sila-field sinv-grow">
            <label className="sila-label" htmlFor="sinv-loc-search">Search</label>
            <input
              id="sinv-loc-search"
              className="sila-input"
              type="search"
              placeholder="Location code or name"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-loc-property">Property</label>
            <select
              id="sinv-loc-property"
              className="sila-select"
              value={propertyFilter}
              onChange={(event) => setPropertyFilter(event.target.value)}
            >
              <option value="">All properties</option>
              {propertyOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-loc-type">Type</label>
            <select
              id="sinv-loc-type"
              className="sila-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {SILA_LOCATION_TYPES.map((type) => (
                <option key={type} value={type}>{silaLabel(type)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-loc-status">Status</label>
            <select
              id="sinv-loc-status"
              className="sila-select"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ACTIVE" | "INACTIVE" | "ALL")}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ALL">All</option>
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-loc-view">View</label>
            <select
              id="sinv-loc-view"
              className="sila-select"
              value={view}
              onChange={(event) => setView(event.target.value === "TREE" ? "TREE" : "TABLE")}
            >
              <option value="TABLE">Table</option>
              <option value="TREE">Tree</option>
            </select>
          </div>
        </div>
        {visible.length === 0 ? (
          <EmptyState
            title={locations.length === 0 ? "No locations yet" : "No locations match the filters"}
            description={locations.length === 0 ? "Create a property first, then add venues, stores and outlets." : undefined}
          />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Location</th>
                  <th scope="col">Type</th>
                  <th scope="col">Property</th>
                  <th scope="col">Venue</th>
                  <th scope="col">SAP storage location</th>
                  <th scope="col">GL account</th>
                  <th scope="col">Cost centre</th>
                  <th scope="col">Profit centre</th>
                  <th scope="col">Transfers</th>
                  <th scope="col">Sales</th>
                  <th scope="col">Inventory</th>
                  <th scope="col">Consumption</th>
                  <th scope="col" className="sinv-num">Users</th>
                  <th scope="col">Status</th>
                  {canManage && <th scope="col"><span className="sila-visually-hidden">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {view === "TREE"
                  ? tree.map((group) => (
                      <React.Fragment key={group.propertyId}>
                        <tr className="sinv-tree-group">
                          <th scope="colgroup" colSpan={canManage ? 15 : 14}>{group.property}</th>
                        </tr>
                        {group.items.map((item) => renderRow(item.location, item.depth))}
                      </React.Fragment>
                    ))
                  : visible.map((location) => renderRow(location))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {dialog?.kind === "form" && (
        <SilaLocationForm
          location={dialog.location}
          properties={properties}
          outlets={outlets}
          locations={locations}
          onClose={closeDialog}
          onSaved={afterSave}
        />
      )}
      {dialog?.kind === "import" && <SilaLocationImportDialog onClose={closeDialog} onImported={afterSave} />}
      {dialog?.kind === "users" && (
        <SilaLocationUsersDialog location={dialog.location} onClose={closeDialog} onSaved={afterSave} />
      )}
      {dialog?.kind === "stocking" && (
        <SilaLocationStockingDialog location={dialog.location} onClose={closeDialog} />
      )}
      {dialog?.kind === "deactivate" && (
        <Modal
          isOpen
          onClose={closeDialog}
          variant="warning"
          size="sm"
          headerProps={{ heading: "Deactivate location" }}
          bodyProps={{
            content: `Deactivate ${dialog.location.locationName} (${dialog.location.locationCode})?`,
            contentDescription: "Only a location without stock can be deactivated.",
          }}
          footerProps={{
            secondaryButton: { text: "Cancel", variant: "secondary", onClick: closeDialog, disabled: deactivating },
            primaryButton: { text: "Deactivate", onClick: () => handleDeactivate(dialog.location), loading: deactivating },
          }}
        />
      )}
    </div>
  );
};

export default SilaLocationMaster;
