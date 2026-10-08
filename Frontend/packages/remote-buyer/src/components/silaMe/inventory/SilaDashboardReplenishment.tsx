import React, { useMemo, useState } from "react";
import { EmptyState, toastService } from "@vosox/shared-ui";
import { formatQty } from "../../../api/silaMe/silaInventoryApi";
import {
  createReplenishmentTransfers,
  type SilaReplenishmentRow,
} from "../../../api/silaMe/silaInventoryControlApi";
import SilaPurchaseRequestDialog, { type SilaPurchaseRequestDraft } from "./SilaPurchaseRequestDialog";

const STATUS_TEXT: Record<string, string> = { OUT: "Out of stock", LOW: "Low stock", PR_OPEN: "PR open" };

interface SilaDashboardReplenishmentProps {
  rows: SilaReplenishmentRow[];
  canTransfer: boolean;
  canRequestPurchase: boolean;
  /** Called after transfers or a purchase request were created. */
  onChanged: () => void;
}

const rowKey = (row: SilaReplenishmentRow): string => `${row.destinationLocationId}:${row.materialId}`;

/** What the transfer moves: the recommended quantity, at most what the source can give. */
const transferQuantity = (row: SilaReplenishmentRow): number =>
  Math.min(row.recommendedQty, row.sourceTransferableQty ?? row.recommendedQty);

/** Stocked materials under their threshold: select rows to raise replenishment transfers, or raise a purchase request. */
const SilaDashboardReplenishment: React.FC<SilaDashboardReplenishmentProps> = ({ rows, canTransfer, canRequestPurchase, onChanged }) => {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<SilaPurchaseRequestDraft | null>(null);

  const transferable = useMemo(() => rows.filter((row) => row.action === "CREATE_TRANSFER" && row.sourceLocationId), [rows]);
  const chosen = transferable.filter((row) => selected.has(rowKey(row)));
  const allChosen = transferable.length > 0 && chosen.length === transferable.length;

  const toggle = (row: SilaReplenishmentRow) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(rowKey(row))) next.delete(rowKey(row));
      else next.add(rowKey(row));
      return next;
    });
  };

  const toggleAll = () => setSelected(allChosen ? new Set() : new Set(transferable.map(rowKey)));

  const createTransfers = async () => {
    if (chosen.length === 0) return;
    setSaving(true);
    try {
      const created = await createReplenishmentTransfers(
        chosen.map((row) => ({
          materialId: row.materialId,
          sourceLocationId: row.sourceLocationId as string,
          destinationLocationId: row.destinationLocationId,
          quantity: transferQuantity(row),
        })),
      );
      toastService.success(`Raised ${created.map((transfer) => transfer.itoNumber).join(", ")}. The source locations approve and dispatch them.`);
      setSelected(new Set());
      onChanged();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not create the replenishment transfers.");
    } finally {
      setSaving(false);
    }
  };

  const openRequest = (row: SilaReplenishmentRow) =>
    setDraft({
      locationId: row.destinationLocationId,
      locationName: row.destinationName,
      materialId: row.materialId,
      materialCode: row.materialCode,
      materialName: row.materialName,
      uom: row.uom,
      quantity: row.recommendedQty,
      source: "REPLENISHMENT",
      reason: "Replenishment: no internal stock",
    });

  return (
    <section className="sila-card" aria-labelledby="sinv-replenishment-title">
      <div className="sila-card-header">
        <h2 id="sinv-replenishment-title" className="sila-card-title">Replenishment Required</h2>
        {canTransfer && transferable.length > 0 && (
          <button
            type="button"
            className="sila-btn sila-btn--primary sila-btn--sm"
            disabled={saving || chosen.length === 0}
            onClick={createTransfers}
          >
            {saving ? "Creating..." : `Create replenishment ITOs${chosen.length > 0 ? ` (${chosen.length})` : ""}`}
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState title="Nothing to replenish" description="No locations currently require replenishment." />
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                {canTransfer && (
                  <th scope="col">
                    <input
                      type="checkbox"
                      aria-label="Select all rows that can be transferred"
                      checked={allChosen}
                      disabled={saving || transferable.length === 0}
                      onChange={toggleAll}
                    />
                  </th>
                )}
                <th scope="col">Destination</th>
                <th scope="col">Material</th>
                <th scope="col" className="sinv-num">Available</th>
                <th scope="col" className="sinv-num">Reorder point</th>
                <th scope="col" className="sinv-num">Par level</th>
                <th scope="col" className="sinv-num">Recommended</th>
                <th scope="col">Source</th>
                <th scope="col" className="sinv-num">Source available</th>
                <th scope="col">Status</th>
                <th scope="col">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const canSelect = row.action === "CREATE_TRANSFER" && Boolean(row.sourceLocationId);
                return (
                  <tr key={rowKey(row)}>
                    {canTransfer && (
                      <td>
                        {canSelect && (
                          <input
                            type="checkbox"
                            aria-label={`Transfer ${row.materialCode} to ${row.destinationName}`}
                            checked={selected.has(rowKey(row))}
                            disabled={saving}
                            onChange={() => toggle(row)}
                          />
                        )}
                      </td>
                    )}
                    <td>{row.destinationName}</td>
                    <td>
                      <span className="sila-cell-strong">{row.materialCode}</span>
                      <span className="sinv-sub">{row.materialName}</span>
                    </td>
                    <td className="sinv-num">
                      <span className={`sila-badge ${row.availableQty <= 0 ? "sila-badge--danger" : "sila-badge--warning"}`}>
                        {formatQty(row.availableQty)} {row.uom}
                      </span>
                    </td>
                    <td className="sinv-num">{formatQty(row.reorderPoint ?? row.minimumStock)}</td>
                    <td className="sinv-num">
                      {row.parLevel === null || row.parLevel === undefined ? <span className="sila-me-flag">Not configured</span> : formatQty(row.parLevel)}
                    </td>
                    <td className="sinv-num">{formatQty(row.recommendedQty)}</td>
                    <td>
                      {row.sourceName || <span className="sinv-sub">Internal stock unavailable</span>}
                    </td>
                    <td className="sinv-num">
                      {row.sourceTransferableQty === null || row.sourceTransferableQty === undefined
                        ? <span className="sinv-sub">Not available</span>
                        : `${formatQty(row.sourceTransferableQty)} ${row.uom}`}
                    </td>
                    <td>
                      {row.status ? (
                        <span className={`sila-badge ${row.status === "OUT" ? "sila-badge--danger" : row.status === "PR_OPEN" ? "sila-badge--info" : "sila-badge--warning"}`}>
                          {STATUS_TEXT[row.status] ?? row.status}
                        </span>
                      ) : "—"}
                    </td>
                    <td>
                      {row.openPurchaseRequestNumber ? (
                        <span className="sila-badge sila-badge--info">{row.openPurchaseRequestNumber}</span>
                      ) : row.action === "CREATE_PR" && canRequestPurchase ? (
                        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => openRequest(row)}>
                          Create PR
                        </button>
                      ) : (
                        <span className="sila-badge sila-badge--neutral">{row.action === "CREATE_PR" ? "Purchase" : "Transfer"}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {draft && (
        <SilaPurchaseRequestDialog
          draft={draft}
          onClose={() => setDraft(null)}
          onCreated={() => {
            setDraft(null);
            onChanged();
          }}
        />
      )}
    </section>
  );
};

export default SilaDashboardReplenishment;
