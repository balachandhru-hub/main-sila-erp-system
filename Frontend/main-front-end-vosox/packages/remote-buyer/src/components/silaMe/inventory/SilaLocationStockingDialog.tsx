import React, { Fragment, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  formatQty,
  getLocationMaterials,
  searchMaterials,
  setLocationMaterials,
  type SilaLocation,
  type SilaMaterial,
  type SilaMonthlyThreshold,
} from "../../../api/silaMe/silaInventoryApi";
import SilaMonthlyThresholdGrid, { MONTHS, monthName, type MonthlyTexts } from "./SilaMonthlyThresholdGrid";

interface SilaLocationStockingDialogProps {
  location: SilaLocation;
  onClose: () => void;
}

/** A stocking row being edited; levels kept as typed text. */
interface StockingRow {
  materialId: string;
  materialCode: string;
  description: string;
  baseUom: string;
  onHandQty: number;
  minimumStock: string;
  parLevel: string;
  reorderPoint: string;
  maximumStock: string;
  safetyStock: string;
  /** REGULAR | ON_DEMAND */
  stockingType: string;
  /** Month overrides as typed text. */
  months: MonthlyTexts;
}

type LevelField = "minimumStock" | "parLevel" | "reorderPoint" | "maximumStock" | "safetyStock";

const LEVELS: { field: LevelField; label: string }[] = [
  { field: "minimumStock", label: "Minimum stock" },
  { field: "parLevel", label: "Par level" },
  { field: "reorderPoint", label: "Reorder point" },
  { field: "maximumStock", label: "Maximum stock" },
  { field: "safetyStock", label: "Safety stock" },
];

const STOCKING_TYPES = [
  { value: "REGULAR", label: "Regular" },
  { value: "ON_DEMAND", label: "On demand" },
];

const toText = (value: number | null | undefined): string => (value === null || value === undefined ? "" : String(value));

/** Empty is "not set"; anything else must be a number of zero or more. */
const toLevel = (text: string): number | null | "invalid" => {
  if (!text.trim()) return null;
  const value = Number(text);
  return Number.isFinite(value) && value >= 0 ? value : "invalid";
};

const toMonths = (thresholds: SilaMonthlyThreshold[] | undefined): MonthlyTexts => {
  const months: MonthlyTexts = {};
  (thresholds ?? []).forEach((threshold) => {
    months[threshold.month] = { minimumStock: toText(threshold.minimumStock), reorderPoint: toText(threshold.reorderPoint) };
  });
  return months;
};

/** The month overrides to save, or "invalid" when a value is not a number of zero or more. */
const fromMonths = (months: MonthlyTexts): SilaMonthlyThreshold[] | "invalid" => {
  const result: SilaMonthlyThreshold[] = [];
  for (const month of MONTHS) {
    const texts = months[month];
    if (!texts) continue;
    const minimumStock = toLevel(texts.minimumStock);
    const reorderPoint = toLevel(texts.reorderPoint);
    if (minimumStock === "invalid" || reorderPoint === "invalid") return "invalid";
    if (minimumStock !== null || reorderPoint !== null) result.push({ month, minimumStock, reorderPoint });
  }
  return result;
};

/** The materials a location keeps, their minimum stock, par level and reorder point, and optional month overrides. */
const SilaLocationStockingDialog: React.FC<SilaLocationStockingDialogProps> = ({ location, onClose }) => {
  const [rows, setRows] = useState<StockingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SilaMaterial[]>([]);
  const [searching, setSearching] = useState(false);
  const [openMonths, setOpenMonths] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLocationMaterials(location.id)
      .then((data) => {
        if (!active) return;
        setRows(
          data.map((row) => ({
            materialId: row.materialId,
            materialCode: row.materialCode,
            description: row.description,
            baseUom: row.baseUom,
            onHandQty: row.onHandQty,
            minimumStock: toText(row.minimumStock),
            parLevel: toText(row.parLevel),
            reorderPoint: toText(row.reorderPoint),
            maximumStock: toText(row.maximumStock),
            safetyStock: toText(row.safetyStock),
            stockingType: row.stockingType || "REGULAR",
            months: toMonths(row.monthlyThresholds),
          })),
        );
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : "Could not load the stocking levels.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [location.id]);

  // Material search for adding rows, shortly after the user stops typing.
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const found = await searchMaterials(term);
        if (active) setResults(found);
      } catch (err: unknown) {
        if (active) toastService.error(err instanceof Error ? err.message : "Could not search the materials.");
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [search]);

  const addMaterial = (material: SilaMaterial) => {
    setRows((current) =>
      current.some((row) => row.materialId === material.id)
        ? current
        : [
            ...current,
            {
              materialId: material.id,
              materialCode: material.materialCode,
              description: material.description,
              baseUom: material.baseUom,
              onHandQty: 0,
              minimumStock: "",
              parLevel: "",
              reorderPoint: "",
              maximumStock: "",
              safetyStock: "",
              stockingType: "REGULAR",
              months: {},
            },
          ],
    );
  };

  const setLevel = (materialId: string, field: LevelField, value: string) =>
    setRows((current) => current.map((row) => (row.materialId === materialId ? { ...row, [field]: value } : row)));

  const removeRow = (materialId: string) => setRows((current) => current.filter((row) => row.materialId !== materialId));

  const setMonths = (materialId: string, months: MonthlyTexts) =>
    setRows((current) => current.map((row) => (row.materialId === materialId ? { ...row, months } : row)));

  const overrideCount = (row: StockingRow): number => {
    const months = fromMonths(row.months);
    return months === "invalid" ? 0 : months.length;
  };

  const handleSave = async () => {
    const items = rows.map((row) => ({
      materialId: row.materialId,
      minimumStock: toLevel(row.minimumStock),
      parLevel: toLevel(row.parLevel),
      reorderPoint: toLevel(row.reorderPoint),
      maximumStock: toLevel(row.maximumStock),
      safetyStock: toLevel(row.safetyStock),
      stockingType: row.stockingType,
      monthlyThresholds: fromMonths(row.months),
    }));
    const invalid = items.find((item) =>
      [item.minimumStock, item.parLevel, item.reorderPoint, item.maximumStock, item.safetyStock].includes("invalid"),
    );
    if (invalid) {
      const row = rows.find((candidate) => candidate.materialId === invalid.materialId);
      toastService.error(`Enter zero or a positive number for ${row?.materialCode ?? "the material"}.`);
      return;
    }
    const invalidMonths = items.find((item) => item.monthlyThresholds === "invalid");
    if (invalidMonths) {
      const row = rows.find((candidate) => candidate.materialId === invalidMonths.materialId);
      toastService.error(`Enter zero or a positive number in the monthly levels of ${row?.materialCode ?? "the material"}.`);
      setOpenMonths(invalidMonths.materialId);
      return;
    }

    setSaving(true);
    try {
      await setLocationMaterials(
        location.id,
        items.map((item) => ({
          materialId: item.materialId,
          minimumStock: item.minimumStock as number | null,
          parLevel: item.parLevel as number | null,
          reorderPoint: item.reorderPoint as number | null,
          maximumStock: item.maximumStock as number | null,
          safetyStock: item.safetyStock as number | null,
          stockingType: item.stockingType,
          monthlyThresholds: item.monthlyThresholds as SilaMonthlyThreshold[],
        })),
      );
      toastService.success("Stocking levels saved.");
      onClose();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save the stocking levels.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="xl"
      headerProps={{ heading: "Stocking levels", subHeading: `${location.locationName} (${location.locationCode})` }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: saving },
        primaryButton: { text: "Save", onClick: handleSave, loading: saving, disabled: loading || Boolean(error) },
      }}
    >
      <div className="sila-root sila-me sinv-dialog">
        {loading ? (
          <Loader size={24} message="Loading stocking levels..." />
        ) : error ? (
          <EmptyState variant="error" title="Couldn't load the stocking levels" description={error} />
        ) : (
          <>
            <p className="sila-help">Adding a material authorizes stocking it here. It does not create quantity.</p>
            <div className="sila-field">
              <label className="sila-label" htmlFor="sinv-stock-search">Add material</label>
              <input
                id="sinv-stock-search"
                className="sila-input"
                type="search"
                placeholder="Code, description or barcode"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            {search.trim().length >= 2 && (
              searching ? (
                <Loader size={20} message="Searching..." />
              ) : results.length === 0 ? (
                <span className="sila-help">No materials found.</span>
              ) : (
                <div className="sila-table-wrap">
                  <table className="sila-table">
                    <thead>
                      <tr>
                        <th scope="col">Material</th>
                        <th scope="col">Base unit</th>
                        <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.slice(0, 8).map((material) => {
                        const added = rows.some((row) => row.materialId === material.id);
                        return (
                          <tr key={material.id}>
                            <td>
                              <span className="sila-cell-strong">{material.materialCode}</span>
                              <span className="sinv-sub">{material.description}</span>
                            </td>
                            <td>{material.baseUom}</td>
                            <td className="sila-cell-actions">
                              <button
                                type="button"
                                className="sila-btn sila-btn--secondary sila-btn--sm"
                                disabled={added}
                                aria-label={`Add ${material.materialCode}`}
                                onClick={() => addMaterial(material)}
                              >
                                {added ? "Added" : "Add"}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {rows.length === 0 ? (
              <EmptyState title="No stocking levels yet" />
            ) : (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Material</th>
                      <th scope="col" className="sinv-num">On hand</th>
                      {LEVELS.map((level) => (
                        <th key={level.field} scope="col" className="sinv-num">{level.label}</th>
                      ))}
                      <th scope="col">Stocking type</th>
                      <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <Fragment key={row.materialId}>
                      <tr>
                        <td>
                          <span className="sila-cell-strong">{row.materialCode}</span>
                          <span className="sinv-sub">{row.description}</span>
                        </td>
                        <td className="sinv-num">{formatQty(row.onHandQty)} {row.baseUom}</td>
                        {LEVELS.map((level) => (
                          <td key={level.field} className="sinv-num">
                            <input
                              className="sila-input sinv-qty-input"
                              type="number"
                              min={0}
                              step="any"
                              aria-label={`${level.label} of ${row.materialCode} in ${row.baseUom}`}
                              value={row[level.field]}
                              onChange={(event) => setLevel(row.materialId, level.field, event.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <select
                            className="sila-select"
                            aria-label={`Stocking type of ${row.materialCode}`}
                            value={row.stockingType}
                            onChange={(event) =>
                              setRows((current) =>
                                current.map((item) => (item.materialId === row.materialId ? { ...item, stockingType: event.target.value } : item)),
                              )
                            }
                          >
                            {STOCKING_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="sila-cell-actions">
                          <div className="sinv-inline">
                            <button
                              type="button"
                              className="sila-btn sila-btn--secondary sila-btn--sm"
                              aria-expanded={openMonths === row.materialId}
                              aria-label={`Monthly levels of ${row.materialCode}`}
                              onClick={() => setOpenMonths((current) => (current === row.materialId ? null : row.materialId))}
                            >
                              Monthly{overrideCount(row) > 0 ? ` (${overrideCount(row)})` : ""}
                            </button>
                            <button
                              type="button"
                              className="sila-btn sila-btn--ghost sila-btn--sm"
                              aria-label={`Remove ${row.materialCode}`}
                              onClick={() => removeRow(row.materialId)}
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                      {openMonths === row.materialId && (
                        <tr>
                          <td colSpan={LEVELS.length + 4}>
                            <p className="sila-help">
                              Month overrides of {row.materialCode} ({row.baseUom}); an empty month uses the levels above.
                              Current month: {monthName(new Date().getMonth() + 1)}.
                            </p>
                            <SilaMonthlyThresholdGrid
                              materialCode={row.materialCode}
                              uom={row.baseUom}
                              months={row.months}
                              onChange={(months) => setMonths(row.materialId, months)}
                            />
                          </td>
                        </tr>
                      )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaLocationStockingDialog;
