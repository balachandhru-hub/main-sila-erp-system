import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader } from "@vosox/shared-ui";
import { getMaterialsPage, SILA_PRICE_STATUSES, type SilaMaterial } from "../../../api/silaMe/silaInventoryApi";
import SilaMaterialDialog from "./SilaMaterialDialog";
import SilaMaterialPricePanel from "../materials/SilaMaterialPricePanel";
import SilaMaterialExcelPanel from "../materials/SilaMaterialExcelPanel";
import SilaMaterialErpPullPanel from "../materials/SilaMaterialErpPullPanel";
import SilaPriceStatusBadge from "../materials/SilaPriceStatusBadge";
import { codeLabel, formatPrice, priceStatusLabel } from "../materials/materialFormat";
import "../silaMeTheme.css";
import "./SilaInventory.css";

interface SilaMaterialInventoryProps {
  /** Edit inventory fields and UOM conversions (MANAGE_SILA_LOCATION). */
  canManage: boolean;
  /** Request price changes, import the material Excel file and pull materials from the ERP (MANAGE_SILA_MASTER_DATA). */
  canManageMasterData?: boolean;
}

const PAGE_SIZE = 25;

/** Item Master materials with their inventory fields, approved price and price status, and UOM conversions. */
const SilaMaterialInventory: React.FC<SilaMaterialInventoryProps> = ({ canManage, canManageMasterData = false }) => {
  const [search, setSearch] = useState("");
  const [inventoryOnly, setInventoryOnly] = useState(false);
  const [priceStatus, setPriceStatus] = useState("");
  const [pricing, setPricing] = useState<SilaMaterial | null>(null);
  const [page, setPage] = useState(0);
  const [materials, setMaterials] = useState<SilaMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [editing, setEditing] = useState<SilaMaterial | null>(null);

  // Searches on the server, shortly after the user stops typing.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const rows = await getMaterialsPage(search, page * PAGE_SIZE, PAGE_SIZE, inventoryOnly, priceStatus);
        if (active) setMaterials(rows);
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Could not load the materials.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search, inventoryOnly, priceStatus, page, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);
  const closeDialog = useCallback(() => setEditing(null), []);
  const afterSave = useCallback(() => {
    setEditing(null);
    reload();
  }, [reload]);
  const closePricing = useCallback(() => setPricing(null), []);
  const afterPriceSubmit = useCallback(() => {
    setPricing(null);
    reload();
  }, [reload]);

  return (
    <div className="sila-me sinv-page">
      <PageHeader
        className="pud-page-header"
        title="Material Master"
        description="Item Master materials with their inventory controls, approved unit price and UOM conversions. Price changes go through approval."
      />

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Item Master inventory</h2>
          <SilaMaterialExcelPanel
            canImport={canManageMasterData}
            search={search}
            priceStatus={priceStatus}
            inventoryOnly={inventoryOnly}
            onImported={reload}
          />
        </div>
        <div className="sinv-filters">
          <div className="sila-field sinv-grow">
            <label className="sila-label" htmlFor="sinv-mat-search">Search</label>
            <input
              id="sinv-mat-search"
              className="sila-input"
              type="search"
              placeholder="Code, description or barcode"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(0);
              }}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="sinv-mat-price-status">Price status</label>
            <select
              id="sinv-mat-price-status"
              className="sila-input"
              value={priceStatus}
              onChange={(event) => {
                setPriceStatus(event.target.value);
                setPage(0);
              }}
            >
              <option value="">All</option>
              {SILA_PRICE_STATUSES.map((status) => <option key={status} value={status}>{priceStatusLabel(status)}</option>)}
            </select>
          </div>
          <label className="sila-choice">
            <input
              type="checkbox"
              checked={inventoryOnly}
              onChange={(event) => {
                setInventoryOnly(event.target.checked);
                setPage(0);
              }}
            />
            Inventory items only
          </label>
        </div>
        {loading ? (
          <Loader size={24} message="Loading materials..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the materials"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={reload}>Try again</button>}
          />
        ) : materials.length === 0 ? (
          <EmptyState title={page > 0 ? "No more materials" : "No materials found"} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col">Material group</th>
                  <th scope="col">Base UOM</th>
                  <th scope="col" className="sinv-num">Unit price</th>
                  <th scope="col">Price status</th>
                  <th scope="col">Barcode</th>
                  <th scope="col">Inventory</th>
                  <th scope="col">Conversions</th>
                  <th scope="col">Valuation</th>
                  <th scope="col">Source</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td>
                      <span className="sila-cell-strong">{material.materialCode}</span>
                      <span className="sinv-sub">{material.description}</span>
                    </td>
                    <td>{material.materialGroup || "—"}</td>
                    <td>{material.baseUom}</td>
                    <td className="sinv-num">
                      {material.unitCost === null || material.unitCost === undefined
                        ? <span className="sila-me-flag sila-me-flag--bad">Price missing</span>
                        : formatPrice(material.unitCost, material.currency, material.approvedPriceUom || material.baseUom)}
                      {material.proposedUnitCost !== null && material.proposedUnitCost !== undefined && (
                        <span className="sinv-sub">
                          Proposed {formatPrice(material.proposedUnitCost, material.currency, material.proposedPriceUom || material.baseUom)}
                        </span>
                      )}
                    </td>
                    <td><SilaPriceStatusBadge status={material.priceStatus} /></td>
                    <td>{material.barcode || "—"}</td>
                    <td>
                      {material.isInventoryItem
                        ? <span className="sila-badge sila-badge--success">{codeLabel(material.inventoryType || "STOCK")}</span>
                        : <span className="sila-badge sila-badge--neutral">{material.inventoryType ? codeLabel(material.inventoryType) : "No"}</span>}
                      {(material.batchManaged || material.expiryManaged || material.serialManaged) && (
                        <span className="sinv-sub">
                          {[material.batchManaged && "Batch", material.expiryManaged && "Expiry", material.serialManaged && "Serial"]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                      {material.expiryManaged && <span className="sinv-sub">Shelf life {material.shelfLifeDays ?? "—"} days</span>}
                    </td>
                    <td>
                      {material.conversions.length === 0
                        ? "—"
                        : material.conversions.map((conversion) => (
                            <span key={`${conversion.fromUom}-${conversion.toUom}`} className="sinv-sub">
                              1 {conversion.fromUom} = {conversion.factor} {conversion.toUom}
                            </span>
                          ))}
                    </td>
                    <td>
                      {material.priceControl ? (material.priceControl === "S" ? "Standard price" : "Moving average") : "—"}
                      {(material.valuationClass || material.materialType) && (
                        <span className="sinv-sub">{[material.valuationClass, material.materialType].filter(Boolean).join(" · ")}</span>
                      )}
                      {material.companyCode && <span className="sinv-sub">Company {material.companyCode}</span>}
                    </td>
                    <td>
                      {material.source === "ERP" ? "ERP" : "Item Master"}
                      {material.updatedAt && <span className="sinv-sub">Updated {new Date(material.updatedAt).toLocaleDateString()}</span>}
                    </td>
                    <td className="sila-cell-actions">
                      <div className="sinv-inline">
                        <button
                          type="button"
                          className="sila-btn sila-btn--secondary sila-btn--sm"
                          aria-label={`Unit price of ${material.materialCode}`}
                          onClick={() => setPricing(material)}
                        >
                          {canManageMasterData ? "Update unit price" : "Price"}
                        </button>
                        {canManage && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`Edit ${material.materialCode}`}
                            onClick={() => setEditing(material)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!error && (page > 0 || materials.length === PAGE_SIZE) && (
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
                disabled={materials.length < PAGE_SIZE || loading}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>

      {canManageMasterData && <SilaMaterialErpPullPanel onPulled={reload} />}

      {editing && <SilaMaterialDialog material={editing} onClose={closeDialog} onSaved={afterSave} />}
      {pricing && (
        <SilaMaterialPricePanel
          material={pricing}
          canRequest={canManageMasterData}
          onClose={closePricing}
          onSubmitted={afterPriceSubmit}
        />
      )}
    </div>
  );
};

export default SilaMaterialInventory;
