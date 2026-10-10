import React, { useState } from 'react';
import { getLocations } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { createGoodsIssue, getGoodsIssueFromBucket } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import LocationPicker from '../../components/LocationPicker';
import ScreenHeader from '../../components/ScreenHeader';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import MovementLines, { parseMovementQty, type MovementFormLine } from './movementLines';

const GoodsIssueFormScreen: React.FC = () => {
  const go = useGo();
  const { location: mine } = useMyLocation();
  const all = useLoad(getLocations, 'all-locations');
  const [storeId, setStoreId] = useState(mine?.locationType === 'STORE' ? mine.id : '');
  const [outletId, setOutletId] = useState('');
  const [comment, setComment] = useState('');
  const [bucket, setBucket] = useState<{ id: string; code: string } | null>(null);
  const [lines, setLines] = useState<MovementFormLine[]>([]);
  const [loadingBucket, setLoadingBucket] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const locations = all.data ?? [];
  const stores = locations.filter((location) => location.locationType === 'STORE');
  const store = stores.find((location) => location.id === storeId);
  const outlets = locations.filter(
    (location) => location.locationType === 'OUTLET' && (!store || location.propertyId === store.propertyId),
  );

  const chooseStore = (value: string) => {
    setStoreId(value);
    const next = stores.find((location) => location.id === value);
    const outlet = locations.find((location) => location.id === outletId);
    if (!next || !outlet || outlet.propertyId !== next.propertyId) {
      setOutletId('');
      setBucket(null);
    }
  };

  const loadBucket = async () => {
    if (!outletId) {
      setNotice({ tone: 'error', text: 'Choose the outlet first.' });
      return;
    }
    setLoadingBucket(true);
    setNotice(null);
    try {
      const result = await getGoodsIssueFromBucket(outletId);
      const open = result.lines.filter((line) => line.remainingQuantity > 0);
      if (!result.weeklyBucketId) {
        setNotice({ tone: 'warning', text: 'This outlet has no frozen weekly bucket.' });
        return;
      }
      if (open.length === 0) {
        setNotice({ tone: 'warning', text: `Everything in weekly bucket ${result.bucketCode ?? ''} has been issued.`.trim() });
        return;
      }
      setBucket({ id: result.weeklyBucketId, code: result.bucketCode ?? '' });
      setLines(
        open.map((line) => ({
          key: line.materialId,
          materialId: line.materialId,
          label: `${line.materialName} (${line.materialCode})`,
          uoms: [line.uom],
          uom: line.uom,
          qty: String(line.remainingQuantity),
          unitCost: '',
        })),
      );
      setNotice({ tone: 'success', text: `${open.length} line(s) loaded from weekly bucket ${result.bucketCode ?? ''}. Quantities are what is still to issue.`.trim() });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setLoadingBucket(false);
    }
  };

  const submit = async () => {
    setNotice(null);
    if (!storeId || !outletId) {
      setNotice({ tone: 'error', text: 'Choose the store and the outlet.' });
      return;
    }
    if (lines.length === 0) {
      setNotice({ tone: 'error', text: 'Add at least one material.' });
      return;
    }
    const bad = lines.find((line) => parseMovementQty(line.qty, false) == null);
    if (bad) {
      setNotice({ tone: 'error', text: `Enter a quantity above zero for ${bad.label}.` });
      return;
    }
    setSaving(true);
    try {
      const id = await createGoodsIssue({
        fromLocationId: storeId,
        toLocationId: outletId,
        weeklyBucketId: bucket?.id ?? null,
        comment: comment.trim() || null,
        items: lines.map((line) => ({ materialId: line.materialId, quantity: parseMovementQty(line.qty, false) ?? 0, uom: line.uom || null })),
      });
      go(id ? `inventory/goods-issues/${id}` : 'inventory/goods-issues', { replace: true });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader title="New goods issue" eyebrow="Inventory" back intro="Issues stock from a store to an outlet of the same property." />
      <div className="sm-screen">
        {all.loading && <Loading text="Loading locations…" />}
        {all.error && <ErrorNotice message={all.error} onRetry={all.reload} />}
        {all.data && (
          <>
            <LocationPicker label="Store" locations={stores} value={storeId} onChange={chooseStore} placeholder="Choose store" />
            <LocationPicker label="Outlet" locations={outlets} value={outletId} onChange={(value) => { setOutletId(value); setBucket(null); }} placeholder="Choose outlet" />
          </>
        )}
        <button type="button" className="sm-btn sm-btn--block" disabled={loadingBucket || saving} onClick={loadBucket}>
          {loadingBucket ? 'Loading bucket…' : 'Load from weekly bucket'}
        </button>
        <div className="sm-field">
          <label htmlFor="sm-gi-comment">Comment (optional)</label>
          <textarea id="sm-gi-comment" className="sm-textarea" value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} />
        </div>
        <MovementLines lines={lines} onChange={setLines} onNotice={(text) => setNotice({ tone: 'warning', text })} />
        <Notice notice={notice} />
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={saving} onClick={submit}>
          {saving ? 'Posting…' : 'Post goods issue'}
        </button>
      </div>
    </>
  );
};

export default GoodsIssueFormScreen;
