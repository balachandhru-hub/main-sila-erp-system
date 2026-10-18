import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getInvoice,
  getPurchaseOrder,
  postGoodsReceipt,
  validateGoodsReceipt,
  type SilaGrnLineWrite,
  type SilaGrnWrite,
  type SilaPurchaseOrderLine,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { formatQty, getLocations, type SilaLocation } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import LocationPicker from '../../components/LocationPicker';
import { parseQty } from '../../components/QtyInput';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { formatDate, formatMoney, todayIso } from '../../format';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import GrnLineCard, { type GrnLineEntry } from './GrnLineCard';

const STORE = 'STORE';
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Prefer the beverage store of the PO property; fall back to the first store of that property. */
const propertyStoreId = (stores: SilaLocation[], po?: { companyCode?: string | null; plantCode?: string | null } | null): string => {
  if (!po || stores.length === 0) return '';
  const company = po.companyCode?.trim().toUpperCase();
  const plant = po.plantCode?.trim().toUpperCase();
  const ofProperty = stores.filter((store) => {
    const storeCompany = store.companyCode?.trim().toUpperCase();
    if (company && storeCompany && storeCompany === company) return true;
    if (plant && store.storageLocationCode?.toUpperCase().startsWith(plant.slice(0, 2))) return true;
    return false;
  });
  const pool = ofProperty.length > 0 ? ofProperty : stores;
  const beverage = pool.find((store) => (store.storeCategory || '').toUpperCase() === 'BEVERAGE')
    ?? pool.find((store) => /beverage/i.test(store.locationName || '') || /beverage/i.test(store.locationCode || ''));
  return (beverage ?? pool[0])?.id ?? '';
};

/** Finalize GRN: compact header + dense lines; partial posts in one click. */
const GrnFormScreen: React.FC = () => {
  const go = useGo();
  const [params] = useSearchParams();
  const poId = params.get('poId') ?? '';
  const invoiceId = params.get('invoiceId');
  const { data: po, loading, error, reload } = useLoad(() => getPurchaseOrder(poId), poId || null);
  const invoice = useLoad(() => getInvoice(invoiceId ?? ''), invoiceId || null);
  const { locations: myLocations, loading: myLocationsLoading } = useMyLocation();
  const allLocations = useLoad(() => getLocations('ACTIVE'), 'stores');
  const [chosenStoreId, setStoreId] = useState<string>('');
  const [entries, setEntries] = useState<Record<string, GrnLineEntry>>({});
  const [seededLines, setSeededLines] = useState(false);
  const [busy, setBusy] = useState<'check' | 'post' | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const stores = useMemo(() => {
    const fromAll = (allLocations.data ?? []).filter((location) => location.locationType === STORE);
    if (fromAll.length > 0) return fromAll;
    return myLocations.filter((location) => location.locationType === STORE);
  }, [allLocations.data, myLocations]);

  const defaultStoreId = useMemo(() => propertyStoreId(stores, po), [stores, po]);
  const storeId = chosenStoreId || defaultStoreId;
  const invoiceNumber = invoice.data?.invoiceNumber?.trim() || '';
  /** Delivery note is always the supplier invoice number — never a GUID. */
  const deliveryNote = invoiceNumber && !GUID.test(invoiceNumber) ? invoiceNumber : '';

  useEffect(() => {
    if (!chosenStoreId && defaultStoreId) {
      setStoreId(defaultStoreId);
    }
  }, [chosenStoreId, defaultStoreId]);

  const openLines = (po?.lines ?? []).filter((line) => line.openQty > 0);
  const invoiceQtyOf = (lineId: string): number | null => {
    const matches = (invoice.data?.items ?? []).filter((item) => item.purchaseOrderItemId === lineId);
    return matches.length > 0 ? matches.reduce((sum, item) => sum + (item.quantity ?? 0), 0) : null;
  };

  useEffect(() => {
    if (seededLines || !po || !invoice.data) return;
    const next: Record<string, GrnLineEntry> = {};
    let any = false;
    for (const line of (po.lines ?? []).filter((row) => row.openQty > 0)) {
      const matches = (invoice.data.items ?? []).filter((item) => item.purchaseOrderItemId === line.id);
      const invoiceQty = matches.length > 0 ? matches.reduce((sum, item) => sum + (item.quantity ?? 0), 0) : null;
      if (invoiceQty == null || invoiceQty <= 0) continue;
      const accepted = Math.min(invoiceQty, line.openQty);
      next[line.id] = { accepted: String(accepted), rejected: '0', damaged: '0' };
      any = true;
    }
    if (any) setEntries((current) => ({ ...next, ...current }));
    setSeededLines(true);
  }, [seededLines, po, invoice.data]);

  const entryOf = (line: SilaPurchaseOrderLine): GrnLineEntry => {
    if (entries[line.id]) return entries[line.id];
    const invoiceQty = invoiceQtyOf(line.id);
    if (invoiceQty != null && invoiceQty > 0) {
      return { accepted: String(Math.min(invoiceQty, line.openQty)), rejected: '0', damaged: '0' };
    }
    return { accepted: String(line.openQty), rejected: '0', damaged: '0' };
  };

  const isPartial = !!po && openLines.some((line) => {
    const entry = entryOf(line);
    const accepted = parseQty(entry.accepted) ?? 0;
    const rejected = parseQty(entry.rejected || '0') ?? 0;
    const damaged = parseQty(entry.damaged || '0') ?? 0;
    if (accepted + rejected + damaged <= 0) return false;
    return accepted + 0.0001 < line.openQty;
  });

  const buildRequest = (): SilaGrnWrite | null => {
    if (!po) return null;
    if (!storeId) {
      setNotice({ tone: 'error', text: 'Choose the receiving store.' });
      return null;
    }
    if (!deliveryNote) {
      setNotice({ tone: 'error', text: 'Supplier invoice number is required as the delivery note.' });
      return null;
    }
    const lines: SilaGrnLineWrite[] = [];
    for (const line of openLines) {
      const entry = entryOf(line);
      const accepted = parseQty(entry.accepted);
      const rejected = parseQty(entry.rejected || '0');
      const damaged = parseQty(entry.damaged || '0');
      if (accepted === null || rejected === null || damaged === null) {
        setNotice({ tone: 'error', text: `Accepted GRN quantity of ${line.productName} must be a number of zero or more.` });
        return null;
      }
      if (accepted > line.openQty) {
        setNotice({ tone: 'error', text: `Accepted ${line.productName} cannot exceed the open quantity ${formatQty(line.openQty)}.` });
        return null;
      }
      const received = accepted + rejected + damaged;
      if (received > 0) lines.push({ purchaseOrderItemId: line.id, receivedQty: received, acceptedQty: accepted, rejectedQty: rejected, damagedQty: damaged });
    }
    if (lines.length === 0) {
      setNotice({ tone: 'error', text: 'Enter the received quantity of at least one line.' });
      return null;
    }
    return {
      purchaseOrderId: po.id,
      locationId: storeId,
      invoiceId: invoiceId || null,
      deliveryNote,
      lines,
    };
  };

  const post = async (request: SilaGrnWrite) => {
    setBusy('post');
    try {
      const id = await postGoodsReceipt(request);
      go(`receive/grns/${id}?posted=1`, { replace: true });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught, 'The receipt could not be posted.') });
      setBusy(null);
    }
  };

  /** Validate then post in one click — partial is intentional, no second confirm. */
  const checkAndPost = async () => {
    setNotice(null);
    const request = buildRequest();
    if (!request) return;
    setBusy('check');
    try {
      const result = await validateGoodsReceipt(request);
      if (!result.valid) {
        setNotice({
          tone: 'error',
          text: result.errors[0] ?? 'Fix the quantity errors before posting.',
        });
        setBusy(null);
        return;
      }
      await post(request);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setBusy(null);
    }
  };

  const change = (line: SilaPurchaseOrderLine, value: Partial<GrnLineEntry>) => {
    setEntries((current) => ({ ...current, [line.id]: { ...entryOf(line), ...value } }));
  };

  const locationsLoading = myLocationsLoading || allLocations.loading;
  const selectedStore = stores.find((store) => store.id === storeId);
  const postLabel = busy === 'check'
    ? 'Checking…'
    : busy === 'post'
      ? (isPartial ? 'POSTING PARTIAL GRN…' : 'POSTING GRN…')
      : (isPartial ? 'PARTIAL GRN POSTING' : 'POST GRN');

  const summary = po ? (
    <>
      <p>
        <strong>{po.supplierName ?? '—'}</strong>
        {' · '}
        {invoiceNumber || (invoice.loading ? '…' : '—')}
        {' · '}
        PO {po.poNumber} · {formatMoney(po.totalAmount, po.currency)}
      </p>
      <p>
        Company {po.companyCode ?? '—'}
        {' · '}
        {formatDate(todayIso())}
        {' · '}
        {selectedStore ? `${selectedStore.locationName} (${selectedStore.locationCode})` : 'Receiving store *'}
      </p>
    </>
  ) : null;

  return (
    <>
      <ScreenHeader title="Finalize GRN" eyebrow="Receive" back summary={summary} />
      <div className="sm-screen sm-screen--dense">
        {!poId && <Empty text="No purchase order chosen." />}
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {invoice.error && <ErrorNotice message={invoice.error} onRetry={invoice.reload} />}
        {po && (
          <>
            {locationsLoading ? null : stores.length === 0 ? (
              <p className="sm-notice sm-notice--warning">No store is available for this property; goods can only be received at a store.</p>
            ) : (
              <div className="sm-grn-store">
                <LocationPicker
                  label="Receiving store"
                  locations={stores}
                  value={storeId}
                  onChange={(id) => setStoreId(id)}
                />
              </div>
            )}
            {deliveryNote ? (
              <p className="sm-meta sm-grn-delivery">Delivery note (invoice): <strong>{deliveryNote}</strong></p>
            ) : (
              <p className="sm-notice sm-notice--warning">Waiting for supplier invoice number for the delivery note.</p>
            )}
            {openLines.length === 0 && <Empty text="Every line of this purchase order is fully received." />}
            <div className="sm-grn-lines">
              {openLines.map((line) => (
                <GrnLineCard
                  key={line.id}
                  line={line}
                  entry={entryOf(line)}
                  invoiceQty={invoiceQtyOf(line.id)}
                  messages={[]}
                  disabled={busy !== null}
                  onChange={(value) => change(line, value)}
                />
              ))}
            </div>
            <Notice notice={notice} />
            <button
              type="button"
              className="sm-btn sm-btn--success sm-btn--block"
              disabled={busy !== null || openLines.length === 0 || stores.length === 0 || locationsLoading || !deliveryNote}
              onClick={checkAndPost}
            >
              {postLabel}
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default GrnFormScreen;
