import React, { useMemo, useState } from 'react';
import {
  acceptPurchaseRecommendations,
  getPurchaseRecommendations,
  type SilaPurchaseRecommendation,
} from '../../../../remote-buyer/src/api/silaMe/silaInventoryControlApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { errorText, useLoad } from '../../useLoad';

const keyOf = (row: SilaPurchaseRecommendation): string => `${row.locationId}:${row.materialId}`;

const RecommendationsScreen: React.FC = () => {
  const { can, loading: accessLoading } = useAccess();
  const allowed = can.requestPurchase;
  const { data, loading, error, reload } = useLoad(
    () => getPurchaseRecommendations(),
    allowed ? 'purchase-recs' : null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState<Record<string, string>>({});
  const [addToBucket, setAddToBucket] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const items = data?.items ?? [];
  const ready = useMemo(() => {
    if (selected.size > 0) return items.filter((row) => selected.has(keyOf(row)));
    return [];
  }, [items, selected]);

  const toggle = (row: SilaPurchaseRecommendation) => {
    const key = keyOf(row);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setQty((current) => (current[key] ? current : { ...current, [key]: String(row.recommendedQty) }));
  };

  const addSelected = async () => {
    const lines = ready.map((row) => ({
      materialId: row.materialId,
      locationId: row.locationId,
      quantity: Number(qty[keyOf(row)] ?? row.recommendedQty),
      uom: row.purchaseUom,
    })).filter((line) => line.quantity > 0);
    if (lines.length === 0) return;
    setSaving(true);
    setNotice(null);
    try {
      const result = await acceptPurchaseRecommendations(lines, addToBucket);
      const created = result.lines.filter((line) => line.requestNumber).length;
      setNotice({ tone: 'success', text: addToBucket ? `Added ${created} line(s) to the current PO bucket.` : `Raised ${created} purchase request(s).` });
      setSelected(new Set());
      reload();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Recommendations" eyebrow="Purchasing" back intro="Review quantity, then add selected lines to the existing purchase path. Nothing is ordered automatically." />
      <div className="sm-screen">
        {accessLoading && <Loading text="Checking access…" />}
        {!accessLoading && !allowed && <Empty text="Purchase recommendations are not available for your permissions." />}
        {allowed && (
          <>
            {loading && <Loading text="Loading recommendations…" />}
            {error && <ErrorNotice message={error} onRetry={reload} />}
            {notice && <Notice tone={notice.tone} text={notice.text} />}
            <div className="sm-grid-2">
              <div className="sm-stat"><span className="sm-muted">Stock-out</span><strong>{data?.stockOut ?? 0}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Below min</span><strong>{data?.belowMinimum ?? 0}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Recommended</span><strong>{data?.recommendedPurchase ?? 0}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Est. value</span><strong>{data?.estimatedValue ?? '—'}</strong></div>
            </div>
            {items.length === 0 && !loading && <Empty text="No purchase recommendations." description="No material in your scope needs purchasing after current stock and open PO quantity." />}
            <ul className="sm-list">
              {items.map((row) => {
                const key = keyOf(row);
                return (
                  <li key={key}>
                    <label className="sm-list-btn">
                      <span className="sm-row">
                        <input type="checkbox" checked={selected.has(key)} disabled={row.duplicateBlocked} onChange={() => toggle(row)} />
                        <strong>{row.materialCode}</strong>
                        <StatusBadge status={row.reason} />
                      </span>
                      <span className="sm-meta">{row.locationName} · stock {formatQty(row.currentStock)} · open PO {formatQty(row.openPoQty)}</span>
                      <span className="sm-meta">{row.supplierName || row.configurationIssue || 'Supplier not resolved'} · {row.purchaseUom}</span>
                      {selected.has(key) && (
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={qty[key] ?? String(row.recommendedQty)}
                          onChange={(event) => setQty((current) => ({ ...current, [key]: event.target.value }))}
                          aria-label={`Quantity for ${row.materialCode}`}
                        />
                      )}
                    </label>
                  </li>
                );
              })}
            </ul>
            <label className="sm-check">
              <input type="checkbox" checked={addToBucket} onChange={(event) => setAddToBucket(event.target.checked)} />
              Add selected to the current PO bucket
            </label>
            <button type="button" className="sm-btn" disabled={saving || ready.length === 0} onClick={addSelected}>
              {saving ? 'Adding…' : `Add selected to PO (${ready.length})`}
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default RecommendationsScreen;
