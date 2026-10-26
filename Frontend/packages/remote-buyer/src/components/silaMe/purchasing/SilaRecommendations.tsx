import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, KpiCard, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import { formatQty } from "../../../api/silaMe/silaInventoryApi";
import {
  acceptPurchaseRecommendations,
  getPurchaseRecommendations,
  type SilaPurchaseRecommendation,
  type SilaPurchaseRecommendationList,
} from "../../../api/silaMe/silaInventoryControlApi";
import "../silaMeTheme.css";
import "../receiving/SilaReceiving.css";

interface SilaRecommendationsProps {
  readOnly?: boolean;
  onOpenPurchaseRequests?: () => void;
}

const reasonLabel = (reason: string): string => {
  if (reason === "STOCK_OUT") return "Stock-out";
  if (reason === "BELOW_MINIMUM") return "Below minimum";
  if (reason === "BELOW_PAR") return "Below par";
  return reason;
};

const lineKey = (row: SilaPurchaseRecommendation): string => `${row.locationId}:${row.materialId}`;

const SilaRecommendations: React.FC<SilaRecommendationsProps> = ({ readOnly = false, onOpenPurchaseRequests }) => {
  const [data, setData] = useState<SilaPurchaseRecommendationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [addToBucket, setAddToBucket] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getPurchaseRecommendations()
      .then((result) => {
        setData(result);
        setQty(Object.fromEntries(result.items.map((row) => [lineKey(row), String(row.recommendedQty)])));
        setSelected(new Set(result.items.filter((row) => row.canAddToPo && !row.duplicateBlocked).map(lineKey)));
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load recommendations."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = data?.items ?? [];
  const chosen = useMemo(() => items.filter((row) => selected.has(lineKey(row))), [items, selected]);

  const toggle = (row: SilaPurchaseRecommendation) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(lineKey(row))) next.delete(lineKey(row));
      else next.add(lineKey(row));
      return next;
    });
  };

  const exclude = (row: SilaPurchaseRecommendation) => {
    setSelected((current) => {
      const next = new Set(current);
      next.delete(lineKey(row));
      return next;
    });
  };

  const addSelected = async () => {
    if (readOnly || chosen.length === 0) return;
    const lines = chosen.map((row) => ({
      materialId: row.materialId,
      locationId: row.locationId,
      quantity: Number(qty[lineKey(row)] ?? row.recommendedQty),
      uom: row.purchaseUom,
    })).filter((line) => line.quantity > 0);
    if (lines.length === 0) {
      toastService.error("Enter a quantity greater than zero for each selected line.");
      return;
    }
    setSaving(true);
    try {
      const result = await acceptPurchaseRecommendations(lines, addToBucket);
      const created = result.lines.filter((line) => line.requestNumber).length;
      const failed = result.lines.filter((line) => line.error);
      toastService.success(
        addToBucket
          ? `Added ${created} recommendation${created === 1 ? "" : "s"} to the current purchase bucket.`
          : `Raised ${created} purchase request${created === 1 ? "" : "s"}.`,
      );
      if (failed.length > 0) {
        toastService.error(failed.map((line) => line.error).filter(Boolean).slice(0, 2).join(" "));
      }
      load();
    } catch (caught: unknown) {
      toastService.error(caught instanceof Error ? caught.message : "Could not add the recommendations.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader
        className="pud-page-header"
        title="Purchase recommendations"
        description="Stock-out and below-minimum materials. Review quantity and supplier, then add selected lines to the existing purchase path. Nothing is ordered automatically."
      />
      {loading && <Loader size={24} message="Loading recommendations…" />}
      {error && <p className="srcv-error" role="alert">{error}</p>}
      {!loading && data && (
        <>
          <div className="sila-kpi-grid">
            <KpiCard label="Stock-out" value={data.stockOut} tone={data.stockOut > 0 ? "danger" : undefined} />
            <KpiCard label="Below minimum" value={data.belowMinimum} tone="warning" />
            <KpiCard label="Recommended purchase" value={data.recommendedPurchase} />
            <KpiCard
              label="Estimated recommended value"
              value={data.estimatedValue == null ? "—" : `${data.estimatedCurrency ?? ""} ${data.estimatedValue}`.trim()}
            />
          </div>

          {data.skipped.length > 0 && (
            <section className="sila-card">
              <h2 className="sila-form-section-title">Missing configuration</h2>
              <p className="srcv-sub">These rows were not recommended. Required stocking or UOM data is missing.</p>
              <ul className="srcv-task-list">
                {data.skipped.slice(0, 12).map((row, index) => (
                  <li key={`${row.locationId}-${row.materialId}-${index}`} className="srcv-task">
                    <div>
                      <strong>{row.materialCode || "Material"}</strong>
                      <span className="srcv-sub">{row.locationName || "—"} · {row.reason}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-form-section-title">Review recommendations</h2>
              {!readOnly && (
                <label className="srcv-sub">
                  <input type="checkbox" checked={addToBucket} onChange={(event) => setAddToBucket(event.target.checked)} />
                  {" "}Add selected lines to the current PO bucket
                </label>
              )}
            </div>
            {items.length === 0 ? (
              <EmptyState title="No purchase recommendations." description="No material in your scope is below its stocking threshold after current stock and open PO quantity." />
            ) : (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      {!readOnly && <th scope="col">Select</th>}
                      <th>Material</th>
                      <th>Location</th>
                      <th>Reason</th>
                      <th className="sinv-num">Stock</th>
                      <th className="sinv-num">Min / Par</th>
                      <th className="sinv-num">Open PO</th>
                      <th className="sinv-num">Recommended</th>
                      <th>Supplier</th>
                      <th>Price</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const key = lineKey(row);
                      return (
                        <tr key={key}>
                          {!readOnly && (
                            <td>
                              <input
                                type="checkbox"
                                aria-label={`Select ${row.materialName}`}
                                checked={selected.has(key)}
                                disabled={row.duplicateBlocked}
                                onChange={() => toggle(row)}
                              />
                            </td>
                          )}
                          <td>
                            <strong>{row.materialCode}</strong>
                            <div className="srcv-sub">{row.materialName}</div>
                          </td>
                          <td>{row.locationName}</td>
                          <td>{reasonLabel(row.reason)}</td>
                          <td className="sinv-num">{formatQty(row.currentStock)} {row.baseUom}</td>
                          <td className="sinv-num">{formatQty(row.minimumStock ?? row.reorderPoint)} / {formatQty(row.parLevel)}</td>
                          <td className="sinv-num">{formatQty(row.openPoQty)}</td>
                          <td className="sinv-num">
                            {readOnly ? (
                              <>{formatQty(row.recommendedQty)} {row.purchaseUom}</>
                            ) : (
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={qty[key] ?? ""}
                                onChange={(event) => setQty((current) => ({ ...current, [key]: event.target.value }))}
                                aria-label={`Quantity for ${row.materialCode}`}
                              />
                            )}
                            <div className="srcv-sub">{row.purchaseUom}</div>
                          </td>
                          <td>
                            {row.supplierName || "—"}
                            {row.configurationIssue && <div className="srcv-sub">{row.configurationIssue}</div>}
                            {row.duplicateBlocked && <div className="srcv-sub">{row.openPurchaseRequestNumber} already open</div>}
                          </td>
                          <td>
                            {row.unitPrice == null ? "—" : `${row.currency ?? ""} ${row.unitPrice}`.trim()}
                            {row.estimatedValue != null && <div className="srcv-sub">Est. {row.currency ?? ""} {row.estimatedValue}</div>}
                          </td>
                          <td>
                            {!readOnly && selected.has(key) && (
                              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => exclude(row)}>Exclude</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="srcv-actions">
              {!readOnly && (
                <button type="button" className="sila-btn sila-btn--primary" disabled={saving || chosen.length === 0} onClick={addSelected}>
                  {saving ? "Adding…" : `Add selected to PO (${chosen.length})`}
                </button>
              )}
              {onOpenPurchaseRequests && (
                <button type="button" className="sila-btn sila-btn--secondary" onClick={onOpenPurchaseRequests}>Purchase requests</button>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default SilaRecommendations;
