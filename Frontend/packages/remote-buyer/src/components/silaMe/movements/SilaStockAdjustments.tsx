import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader } from "@vosox/shared-ui";
import { formatQty, getMyLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import {
  SILA_ADJUSTMENT_TYPES,
  getAdjustment,
  getAdjustments,
  type SilaAdjustmentDetail,
  type SilaAdjustmentListItem,
} from "../../../api/silaMe/silaMovementsApi";
import { formatDateTime } from "../../cart/lineFormat";
import SilaAdjustmentForm from "./SilaAdjustmentForm";
import { movementLabel } from "./movementFormat";
import "../silaMeTheme.css";
import "./SilaMovements.css";

interface AdjustmentDialogProps {
  adjustmentId: string;
  onClose: () => void;
}

const AdjustmentDialog: React.FC<AdjustmentDialogProps> = ({ adjustmentId, onClose }) => {
  const [adjustment, setAdjustment] = useState<SilaAdjustmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setAdjustment(await getAdjustment(adjustmentId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the stock adjustment.");
    } finally {
      setLoading(false);
    }
  }, [adjustmentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{
        heading: adjustment ? `Adjustment ${adjustment.adjustmentNumber}` : "Stock adjustment",
        subHeading: adjustment ? `${movementLabel(adjustment.adjustmentType)} · ${adjustment.locationName ?? "—"}` : undefined,
      }}
      footerProps={{ secondaryButton: { text: "Close", onClick: onClose } }}
    >
      <div className="sila-root sila-me smov-dialog">
        {loading ? (
          <Loader size={24} message="Loading stock adjustment..." />
        ) : error || !adjustment ? (
          <EmptyState
            variant="error"
            title="Couldn't load the stock adjustment"
            description={error ?? undefined}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : (
          <>
            <dl className="sila-meta-grid">
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Posted by</dt>
                <dd className="sila-meta-value">{adjustment.postedByName || adjustment.postedBy}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Posted on</dt>
                <dd className="sila-meta-value">{formatDateTime(adjustment.postedOn)}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Reason</dt>
                <dd className="sila-meta-value">{adjustment.reason || "—"}</dd>
              </div>
            </dl>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Material</th>
                    <th scope="col" className="smov-num">Quantity</th>
                    <th scope="col">Unit</th>
                    <th scope="col" className="smov-num">Base quantity</th>
                    <th scope="col" className="smov-num">Unit cost</th>
                  </tr>
                </thead>
                <tbody>
                  {adjustment.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="sila-cell-strong">{item.materialCode}</span>
                        <span className="smov-sub">{item.materialName}</span>
                      </td>
                      <td className="smov-num">{formatQty(item.quantity)}</td>
                      <td>{item.uom}</td>
                      <td className="smov-num">{formatQty(item.baseQuantity)}</td>
                      <td className="smov-num">{formatQty(item.unitCost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

/** Opening stock, waste / damage / breakage / spoilage / expired and manual stock adjustments. */
const SilaStockAdjustments: React.FC = () => {
  const [rows, setRows] = useState<SilaAdjustmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getAdjustments({ locationId: locationFilter, type: typeFilter }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the stock adjustments.");
    } finally {
      setLoading(false);
    }
  }, [locationFilter, typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    getMyLocations()
      .then((mine) => {
        if (active) setLocations(mine);
      })
      .catch((err: unknown) => {
        if (active) setLocationsError(err instanceof Error ? err.message : "Could not load the locations.");
      });
    return () => {
      active = false;
    };
  }, []);

  const closeForm = useCallback(() => setFormOpen(false), []);
  const closeDetail = useCallback(() => setOpenId(null), []);

  return (
    <div className="sila-me smov-page">
      <PageHeader
        className="pud-page-header"
        title="Stock adjustments"
        actions={
          <button
            type="button"
            className="sila-btn sila-btn--primary"
            disabled={Boolean(locationsError) || locations.length === 0}
            onClick={() => setFormOpen(true)}
          >
            New adjustment
          </button>
        }
      />

      {locationsError && (
        <div className="sila-alert sila-alert--warning" role="alert">
          New adjustments are unavailable: {locationsError}
        </div>
      )}

      <section className="sila-card">
        <div className="smov-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-adj-filter-location">Location</label>
            <select
              id="smov-adj-filter-location"
              className="sila-select"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
            >
              <option value="">All my locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.locationName}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="smov-adj-filter-type">Type</label>
            <select
              id="smov-adj-filter-type"
              className="sila-select"
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
            >
              <option value="">All types</option>
              {SILA_ADJUSTMENT_TYPES.map((item) => (
                <option key={item} value={item}>{movementLabel(item)}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <Loader size={24} message="Loading stock adjustments..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the stock adjustments"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No stock adjustments" description="Posted adjustments of your locations appear here." />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Adjustment</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Reason</th>
                  <th scope="col" className="smov-num">Lines</th>
                  <th scope="col">Posted</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{row.adjustmentNumber}</td>
                    <td>{movementLabel(row.adjustmentType)}</td>
                    <td>{row.locationName || "—"}</td>
                    <td>{row.reason || "—"}</td>
                    <td className="smov-num">{row.lineCount}</td>
                    <td>
                      {formatDateTime(row.postedOn)}
                      <span className="smov-sub">{row.postedByName || row.postedBy}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        onClick={() => setOpenId(row.id)}
                        aria-label={`Open ${row.adjustmentNumber}`}
                      >
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {formOpen && (
        <SilaAdjustmentForm
          locations={locations}
          onClose={closeForm}
          onCreated={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
      {openId && <AdjustmentDialog adjustmentId={openId} onClose={closeDetail} />}
    </div>
  );
};

export default SilaStockAdjustments;
