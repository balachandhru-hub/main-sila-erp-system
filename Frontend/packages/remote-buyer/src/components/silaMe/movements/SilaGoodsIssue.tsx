import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader } from "@vosox/shared-ui";
import { formatQty, getLocations, getMyLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import {
  getGoodsIssue,
  getGoodsIssues,
  type SilaGoodsIssueDetail,
  type SilaGoodsIssueListItem,
} from "../../../api/silaMe/silaMovementsApi";
import { formatDateTime } from "../../cart/lineFormat";
import SilaGoodsIssueForm from "./SilaGoodsIssueForm";
import "../silaMeTheme.css";
import "./SilaMovements.css";

interface GoodsIssueDialogProps {
  goodsIssueId: string;
  onClose: () => void;
}

const GoodsIssueDialog: React.FC<GoodsIssueDialogProps> = ({ goodsIssueId, onClose }) => {
  const [issue, setIssue] = useState<SilaGoodsIssueDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setIssue(await getGoodsIssue(goodsIssueId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the goods issue.");
    } finally {
      setLoading(false);
    }
  }, [goodsIssueId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{
        heading: issue ? `Goods issue ${issue.issueNumber}` : "Goods issue",
        subHeading: issue ? `${issue.fromLocationName ?? "—"} → ${issue.toLocationName ?? "—"}` : undefined,
      }}
      footerProps={{ secondaryButton: { text: "Close", onClick: onClose } }}
    >
      <div className="sila-root sila-me smov-dialog">
        {loading ? (
          <Loader size={24} message="Loading goods issue..." />
        ) : error || !issue ? (
          <EmptyState
            variant="error"
            title="Couldn't load the goods issue"
            description={error ?? undefined}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : (
          <>
            <dl className="sila-meta-grid">
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Issued by</dt>
                <dd className="sila-meta-value">{issue.issuedByName || issue.issuedBy}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Issued on</dt>
                <dd className="sila-meta-value">{formatDateTime(issue.issuedOn)}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Weekly bucket</dt>
                <dd className="sila-meta-value">{issue.bucketCode || "—"}</dd>
              </div>
              <div className="sila-meta-item">
                <dt className="sila-meta-label">Comment</dt>
                <dd className="sila-meta-value">{issue.comment || "—"}</dd>
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
                  </tr>
                </thead>
                <tbody>
                  {issue.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <span className="sila-cell-strong">{item.materialCode}</span>
                        <span className="smov-sub">{item.materialName}</span>
                      </td>
                      <td className="smov-num">{formatQty(item.quantity)}</td>
                      <td>{item.uom}</td>
                      <td className="smov-num">{formatQty(item.baseQuantity)}</td>
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

/** Goods issues from a store to an outlet. */
const SilaGoodsIssue: React.FC = () => {
  const [rows, setRows] = useState<SilaGoodsIssueListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<SilaLocation[]>([]);
  const [outlets, setOutlets] = useState<SilaLocation[]>([]);
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getGoodsIssues());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the goods issues.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    Promise.all([getMyLocations(), getLocations()])
      .then(([mine, all]) => {
        if (!active) return;
        setStores(mine.filter((location) => location.locationType === "STORE"));
        setOutlets(all.filter((location) => location.locationType === "OUTLET"));
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
        title="Goods issue"
        actions={
          <button
            type="button"
            className="sila-btn sila-btn--primary"
            disabled={Boolean(locationsError) || stores.length === 0}
            title={stores.length === 0 ? "You are not assigned to a store." : undefined}
            onClick={() => setFormOpen(true)}
          >
            New goods issue
          </button>
        }
      />

      {locationsError && (
        <div className="sila-alert sila-alert--warning" role="alert">
          New goods issues are unavailable: {locationsError}
        </div>
      )}

      <section className="sila-card">
        {loading ? (
          <Loader size={24} message="Loading goods issues..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the goods issues"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No goods issues" description="Issued stock from a store to an outlet appears here." />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Issue</th>
                  <th scope="col">Store</th>
                  <th scope="col">Outlet</th>
                  <th scope="col">Weekly bucket</th>
                  <th scope="col" className="smov-num">Lines</th>
                  <th scope="col">Issued</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{row.issueNumber}</td>
                    <td>{row.fromLocationName || "—"}</td>
                    <td>{row.toLocationName || "—"}</td>
                    <td>{row.bucketCode || "—"}</td>
                    <td className="smov-num">{row.lineCount}</td>
                    <td>
                      {formatDateTime(row.issuedOn)}
                      <span className="smov-sub">{row.issuedByName || row.issuedBy}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        onClick={() => setOpenId(row.id)}
                        aria-label={`Open ${row.issueNumber}`}
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
        <SilaGoodsIssueForm
          stores={stores}
          outlets={outlets}
          onClose={closeForm}
          onCreated={() => {
            setFormOpen(false);
            load();
          }}
        />
      )}
      {openId && <GoodsIssueDialog goodsIssueId={openId} onClose={closeDetail} />}
    </div>
  );
};

export default SilaGoodsIssue;
