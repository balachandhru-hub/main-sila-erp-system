import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import { searchMaterials, type SilaMaterial } from "../../../api/silaMe/silaInventoryApi";
import {
  approveStockCount,
  cancelStockCount,
  getStockCount,
  identifyBarcode,
  submitStockCount,
  type SilaStockCountDetail,
  type SilaStockCountItem,
} from "../../../api/silaMe/silaStockCountApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import CountEntryDialog, { type CountTarget } from "./CountEntryDialog";
import CountLinePhotos from "./CountLinePhotos";
import CountLineReviewDialog from "./CountLineReviewDialog";
import "../silaMeTheme.css";
import "../control/SilaControl.css";
import { formatMoney, formatQty, formatVariance, scBadgeClass, scLabel } from "./stockCountFormat";

interface SilaStockCountSheetProps {
  stockCountId: string;
  canApprove: boolean;
  /** Called after submit, approve or cancel so the list can refresh. */
  onChanged: () => void;
}

/** Shown instead of book quantities while a blind count hides them. */
const HIDDEN = "Hidden";

type Confirming = "submit" | "approve" | "cancel" | null;

const fromItem = (item: SilaStockCountItem, method: CountTarget["method"]): CountTarget => ({
  itemId: item.id,
  materialId: item.materialId,
  materialCode: item.materialCode,
  materialName: item.materialName,
  baseUom: item.baseUom,
  uoms: item.uoms,
  systemQty: item.systemQty,
  countedQty: item.countedQty,
  method,
});

const fromMaterial = (material: SilaMaterial): CountTarget => {
  const uoms = [material.baseUom, ...material.conversions.flatMap((conversion) => [conversion.fromUom, conversion.toUom])]
    .map((uom) => uom.trim().toUpperCase())
    .filter((uom, index, all) => uom !== "" && all.indexOf(uom) === index);
  return {
    itemId: null,
    materialId: material.id,
    materialCode: material.materialCode,
    materialName: material.description,
    baseUom: material.baseUom,
    uoms,
    method: "SEARCH",
  };
};

/** Count sheet of one stock count: scan or search a material, enter the counted quantity, submit, approve or cancel. */
const SilaStockCountSheet: React.FC<SilaStockCountSheetProps> = ({ stockCountId, canApprove, onChanged }) => {
  const [count, setCount] = useState<SilaStockCountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scanText, setScanText] = useState("");
  const [scanning, setScanning] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SilaMaterial[] | null>(null);
  const [lineFilter, setLineFilter] = useState("");
  const [target, setTarget] = useState<CountTarget | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [countMissingAsZero, setCountMissingAsZero] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reviewing, setReviewing] = useState<SilaStockCountItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setCount(await getStockCount(stockCountId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the stock count.");
    } finally {
      setLoading(false);
    }
  }, [stockCountId]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleItems = useMemo(() => {
    const items = count?.items ?? [];
    const text = lineFilter.trim().toLowerCase();
    if (!text) return items;
    return items.filter((item) => `${item.materialCode} ${item.materialName} ${item.barcode ?? ""}`.toLowerCase().includes(text));
  }, [count, lineFilter]);

  if (loading && !count) return <Loader size={24} message="Loading the stock count..." />;

  if (error || !count) {
    return (
      <EmptyState
        variant="error"
        title="Couldn't load the stock count"
        description={error ?? "The stock count was not found."}
        action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
      />
    );
  }

  const inProgress = count.status === "IN_PROGRESS";
  const canApproveNow = canApprove && (count.status === "SUBMITTED" || count.status === "ENQUIRY_PENDING");
  /** A submitted count sent back by the cost controller: only the lines marked Recount can be counted. */
  const reopened = inProgress && Boolean(count.submittedOn);
  const canUploadPhotos = count.status !== "POSTED" && count.status !== "CANCELLED";
  const showActions = inProgress || canApproveNow;

  const scan = async () => {
    if (!scanText.trim()) return;
    setScanning(true);
    try {
      const found = await identifyBarcode(count.id, scanText);
      setTarget(found.item
        ? fromItem(found.item, "BARCODE")
        : {
          itemId: null,
          materialId: found.materialId,
          materialCode: found.materialCode,
          materialName: found.materialName,
          baseUom: found.baseUom,
          uoms: [found.baseUom],
          method: "BARCODE",
        });
      setScanText("");
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "BARCODE NOT MAPPED");
    } finally {
      setScanning(false);
    }
  };

  const search = async () => {
    if (!searchText.trim()) return;
    setSearching(true);
    try {
      setResults(await searchMaterials(searchText));
    } catch (err: unknown) {
      setResults(null);
      toastService.error(err instanceof Error ? err.message : "Could not search the materials.");
    } finally {
      setSearching(false);
    }
  };

  const pickMaterial = (material: SilaMaterial) => {
    const line = count.items.find((item) => item.materialId === material.id);
    setTarget(line ? fromItem(line, "SEARCH") : fromMaterial(material));
    setResults(null);
    setSearchText("");
  };

  const runAction = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      if (confirming === "submit") {
        await submitStockCount(count.id, countMissingAsZero);
        toastService.success("Stock count submitted. Shortages were sent to the location as enquiries.");
      } else if (confirming === "approve") {
        await approveStockCount(count.id);
        toastService.success("Stock count approved. Variances were posted to inventory.");
      } else {
        await cancelStockCount(count.id);
        toastService.success("Stock count cancelled.");
      }
      setConfirming(null);
      await load();
      onChanged();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy(false);
    }
  };

  const confirmTitle = confirming === "submit" ? "Submit count" : confirming === "approve" ? "Approve count" : "Cancel count";

  return (
    <div className="sc-stack">
      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">
            {count.countNumber} <span className={scBadgeClass(count.status)}>{scLabel(count.status)}</span>
          </h2>
          <div className="sc-actions">
            {inProgress && (
              <>
                <button type="button" className="sila-btn sila-btn--primary" onClick={() => setConfirming("submit")}>Submit count</button>
                <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setConfirming("cancel")}>Cancel count</button>
              </>
            )}
            {canApproveNow && (
              <button type="button" className="sila-btn sila-btn--primary" onClick={() => setConfirming("approve")}>Approve and post</button>
            )}
          </div>
        </div>
        <div className="sila-card-body sc-stack">
          <dl className="sila-meta-grid">
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Property</dt>
              <dd className="sila-meta-value">{count.propertyName || "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Location</dt>
              <dd className="sila-meta-value">{count.locationName || "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Business date</dt>
              <dd className="sila-meta-value">{count.businessDate ? formatDate(count.businessDate) : "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Created by</dt>
              <dd className="sila-meta-value">{count.createdByName || "—"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Type</dt>
              <dd className="sila-meta-value">{scLabel(count.countType)}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Blind count</dt>
              <dd className="sila-meta-value">{count.blindCount ? "Yes" : "No"}</dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Started</dt>
              <dd className="sila-meta-value">{formatDateTime(count.dateCreated)}</dd>
            </div>
            {count.submittedOn && (
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Submitted</dt>
                <dd className="sila-meta-value">
                {formatDateTime(count.submittedOn)}
                {count.submittedByName && <span className="sc-sub">{count.submittedByName}</span>}
              </dd>
              </div>
            )}
            {count.approvedOn && (
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Approved</dt>
                <dd className="sila-meta-value">
                {formatDateTime(count.approvedOn)}
                {count.approvedByName && <span className="sc-sub">{count.approvedByName}</span>}
              </dd>
              </div>
            )}
            {count.notes && (
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Notes</dt>
                <dd className="sila-meta-value">{count.notes}</dd>
              </div>
            )}
          </dl>

          <div className="sc-counters" aria-label="Count progress">
            {[
              { label: "Materials", value: String(count.totalItems), book: false },
              { label: "Counted", value: String(count.countedItems), book: false },
              { label: "Remaining", value: String(count.remainingItems), book: false },
              { label: "Matched", value: String(count.matchedItems), book: true },
              { label: "Shortage", value: String(count.shortageItems), book: true },
              { label: "Surplus", value: String(count.surplusItems), book: true },
              { label: "Shortage value", value: `${count.currency ? `${count.currency} ` : ""}${formatMoney(count.shortageValue)}`, book: true },
            ].map((counter) => (
              <div key={counter.label} className="sc-counter">
                {counter.book && !count.canSeeSystemQty ? (
                  <span className="sc-counter-value sc-hidden">{HIDDEN}</span>
                ) : (
                  <span className="sc-counter-value">{counter.value}</span>
                )}
                <span className="sc-counter-label">{counter.label}</span>
              </div>
            ))}
          </div>

          {reopened && (
            <div className="sila-alert sila-alert--warning">
              The cost controller asked for a recount. Count the lines marked Recount, then submit the count again.
            </div>
          )}

          {!count.canSeeSystemQty && (
            <div className="sila-alert sila-alert--warning">Blind count: system quantities are hidden until the count is submitted.</div>
          )}

          {inProgress && !reopened && (
            <div className="sc-finder">
              <form
                className="sila-field"
                onSubmit={(event) => {
                  event.preventDefault();
                  void scan();
                }}
              >
                <label className="sila-label" htmlFor="sc-scan">Scan barcode</label>
                <div className="sc-finder-row">
                  <input
                    id="sc-scan"
                    className="sila-input"
                    value={scanText}
                    autoComplete="off"
                    placeholder="Barcode or material code"
                    onChange={(event) => setScanText(event.target.value)}
                  />
                  <button type="submit" className="sila-btn sila-btn--secondary" disabled={scanning || !scanText.trim()}>
                    {scanning ? "Finding..." : "Find"}
                  </button>
                </div>
              </form>
              <form
                className="sila-field"
                onSubmit={(event) => {
                  event.preventDefault();
                  void search();
                }}
              >
                <label className="sila-label" htmlFor="sc-search">Search material</label>
                <div className="sc-finder-row">
                  <input
                    id="sc-search"
                    className="sila-input"
                    value={searchText}
                    autoComplete="off"
                    placeholder="Name or code"
                    onChange={(event) => setSearchText(event.target.value)}
                  />
                  <button type="submit" className="sila-btn sila-btn--secondary" disabled={searching || !searchText.trim()}>
                    {searching ? "Searching..." : "Search"}
                  </button>
                </div>
                {results && (
                  results.length === 0 ? (
                    <span className="sc-sub">No material found.</span>
                  ) : (
                    <ul className="sc-results" aria-label="Search results">
                      {results.map((material) => (
                        <li key={material.id}>
                          <button type="button" className="sc-result" onClick={() => pickMaterial(material)}>
                            <span>
                              {material.description}
                              <span className="sc-sub">{material.materialCode}</span>
                            </span>
                            <span className="sc-sub">{material.baseUom}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </form>
            </div>
          )}
        </div>
      </section>

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Materials ({count.items.length})</h2>
          <div className="sila-field sc-filter">
            <label className="sila-visually-hidden" htmlFor="sc-line-filter">Filter materials</label>
            <input
              id="sc-line-filter"
              className="sila-input"
              placeholder="Filter materials"
              value={lineFilter}
              onChange={(event) => setLineFilter(event.target.value)}
            />
          </div>
        </div>
        {visibleItems.length === 0 ? (
          <EmptyState title={count.items.length === 0 ? "No materials on this count yet" : "No material matches the filter"} />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col" className="sila-num">System</th>
                  <th scope="col" className="sila-num">Physical</th>
                  <th scope="col" className="sila-num">Variance</th>
                  <th scope="col">UOM</th>
                  <th scope="col" className="sila-num">Value</th>
                  <th scope="col">Status</th>
                  <th scope="col">Review</th>
                  <th scope="col">Enquiry</th>
                  <th scope="col">Photos</th>
                  <th scope="col">Counted</th>
                  <th scope="col">Manager</th>
                  <th scope="col">SAP</th>
                  {showActions && <th scope="col" className="sila-cell-actions">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <span className="sila-cell-strong">{item.materialName}</span>
                      <span className="sc-sub">{item.materialCode}</span>
                    </td>
                    <td className="sila-num">{count.canSeeSystemQty ? formatQty(item.systemQty) : <span className="sc-hidden">{HIDDEN}</span>}</td>
                    <td className="sila-num">{formatQty(item.countedQty)}</td>
                    <td className="sila-num">{count.canSeeSystemQty ? formatVariance(item.varianceQty) : <span className="sc-hidden">{HIDDEN}</span>}</td>
                    <td>{item.baseUom}</td>
                    <td className="sila-num">{count.canSeeSystemQty ? formatMoney(item.varianceValue) : "—"}</td>
                    <td><span className={scBadgeClass(item.status)}>{scLabel(item.status)}</span></td>
                    <td>
                      <div className="sctl-badges">
                        {item.recountRequested && <span className="sila-badge sila-badge--warning">Recount</span>}
                        {item.reviewStatus && <span className={scBadgeClass(item.reviewStatus)}>{scLabel(item.reviewStatus)}</span>}
                        {item.reviewComment && <span className="sc-sub">{item.reviewComment}</span>}
                        {!item.recountRequested && !item.reviewStatus && <span className="sc-sub">—</span>}
                      </div>
                    </td>
                    <td>
                      {item.enquiryNumber ? (
                        <div className="sctl-badges">
                          <span className="sc-sub">{item.enquiryNumber}</span>
                          {item.enquiryStatus && <span className={scBadgeClass(item.enquiryStatus)}>{scLabel(item.enquiryStatus)}</span>}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <CountLinePhotos
                        stockCountId={count.id}
                        itemId={item.id}
                        materialName={item.materialName}
                        photos={item.photos ?? []}
                        canUpload={canUploadPhotos}
                        onUploaded={load}
                      />
                    </td>
                    <td>
                      {formatDateTime(item.countedOn)}
                      {item.countedByName && <span className="sc-sub">{item.countedByName}</span>}
                    </td>
                    <td>{item.manager || "—"}</td>
                    <td>
                      {item.sapStatus ? <span className={scBadgeClass(item.sapStatus)}>{scLabel(item.sapStatus)}</span> : "—"}
                      {item.sapMaterialDocument && <span className="sc-sub">{item.sapMaterialDocument}</span>}
                      {item.sapError && <span className="sc-sub sc-error-text">{item.sapError}</span>}
                    </td>
                    {showActions && (
                      <td className="sila-cell-actions">
                        {inProgress && (!reopened || item.recountRequested) && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`${item.status === "NOT_COUNTED" ? "Count" : "Recount"} ${item.materialName}`}
                            onClick={() => setTarget(fromItem(item, "MANUAL"))}
                          >
                            {item.status === "NOT_COUNTED" ? "Count" : "Recount"}
                          </button>
                        )}
                        {canApproveNow && (
                          <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            aria-label={`Review ${item.materialName}`}
                            onClick={() => setReviewing(item)}
                          >
                            Review
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {target && (
        <CountEntryDialog
          stockCountId={count.id}
          target={target}
          onClose={() => setTarget(null)}
          onSaved={() => {
            setTarget(null);
            load();
          }}
        />
      )}

      {reviewing && (
        <CountLineReviewDialog
          stockCountId={count.id}
          item={reviewing}
          onClose={() => setReviewing(null)}
          onSaved={() => {
            setReviewing(null);
            load();
            onChanged();
          }}
        />
      )}

      <Modal
        isOpen={confirming !== null}
        onClose={() => setConfirming(null)}
        variant={confirming === "cancel" ? "danger" : "default"}
        headerProps={{ heading: `${confirmTitle} ${count.countNumber}` }}
        footerProps={{
          secondaryButton: { text: "Back", onClick: () => setConfirming(null), disabled: busy },
          primaryButton: { text: confirmTitle, onClick: runAction, loading: busy },
        }}
      >
        <div className="sila-root sila-me sc-stack">
          {confirming === "submit" && (
            <>
              <p className="sila-modal-text">
                Counting cannot continue after submitting. Every shortage is sent to the location as an enquiry.
                Inventory changes only when the count is approved.
              </p>
              {count.remainingItems > 0 && (
                <>
                  <div className="sila-alert sila-alert--warning">{count.remainingItems} materials are still not counted.</div>
                  <label className="sc-checkbox">
                    <input type="checkbox" checked={countMissingAsZero} onChange={(event) => setCountMissingAsZero(event.target.checked)} />
                    Record the uncounted materials as counted 0
                  </label>
                </>
              )}
            </>
          )}
          {confirming === "approve" && (
            <p className="sila-modal-text">
              Every variance that was not rejected is posted to inventory as a stock count adjustment and queued for the ERP.
              This cannot be undone.
            </p>
          )}
          {confirming === "cancel" && <p className="sila-modal-text">The count is closed without changing inventory.</p>}
        </div>
      </Modal>
    </div>
  );
};

export default SilaStockCountSheet;
