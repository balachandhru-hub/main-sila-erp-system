import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  getInvoice,
  getPurchaseOrder,
  postGoodsReceipt,
  validateGoodsReceipt,
  type SilaGrnLineWrite,
  type SilaGrnValidation,
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

/** Finalize GRN: received = accepted + rejected + damaged, accepted ≤ open. Checked by the server before posting. */
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
  const [deliveryNote, setDeliveryNote] = useState<string>('');
  const [deliverySeeded, setDeliverySeeded] = useState(false);
  const [busy, setBusy] = useState<'check' | 'post' | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  /** Result of the last check; warnings must be confirmed before posting. */
  const [check, setCheck] = useState<{ request: SilaGrnWrite; result: SilaGrnValidation } | null>(null);

  const stores = useMemo(() => {
    const fromAll = (allLocations.data ?? []).filter((location) => location.locationType === STORE);
    if (fromAll.length > 0) return fromAll;
    return myLocations.filter((location) => location.locationType === STORE);
  }, [allLocations.data, myLocations]);

  const defaultStoreId = useMemo(() => propertyStoreId(stores, po), [stores, po]);
  const storeId = chosenStoreId || defaultStoreId;

  useEffect(() => {
    if (!chosenStoreId && defaultStoreId) {
      setStoreId(defaultStoreId);
    }
  }, [chosenStoreId, defaultStoreId]);

  useEffect(() => {
    if (deliverySeeded || !invoiceId) return;
    const note = invoice.data?.invoiceNumber?.trim() || invoiceId;
    if (!note) return;
    setDeliveryNote(note);
    setDeliverySeeded(true);
  }, [deliverySeeded, invoiceId, invoice.data?.invoiceNumber]);

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
  const messagesOf = (lineId: string): string[] =>
    check?.result.lines.find((line) => line.purchaseOrderItemId === lineId)?.messages ?? [];

  const buildRequest = (): SilaGrnWrite | null => {
    if (!po) return null;
    if (!storeId) {
      setNotice({ tone: 'error', text: 'Choose the receiving store.' });
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
      deliveryNote: deliveryNote.trim() || invoice.data?.invoiceNumber?.trim() || invoiceId || null,
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

  /** Checks with the server first: errors block, warnings need a confirmation, a clean check posts at once. */
  const checkAndPost = async () => {
    setNotice(null);
    setCheck(null);
    const request = buildRequest();
    if (!request) return;
    setBusy('check');
    try {
      const result = await validateGoodsReceipt(request);
      if (result.valid && result.warnings.length === 0) {
        await post(request);
        return;
      }
      setCheck({ request, result });
      setBusy(null);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setBusy(null);
    }
  };

  const change = (line: SilaPurchaseOrderLine, value: Partial<GrnLineEntry>) => {
    setCheck(null);
    setEntries((current) => ({ ...current, [line.id]: { ...entryOf(line), ...value } }));
  };

  const locationsLoading = myLocationsLoading || allLocations.loading;
  const selectedStore = stores.find((store) => store.id === storeId);

  return (
    <>
      <ScreenHeader title="Finalize GRN" eyebrow="Receive" back />
      <div className="sm-screen">
        {!poId && <Empty text="No purchase order chosen." />}
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {invoice.error && <ErrorNotice message={invoice.error} onRetry={invoice.reload} />}
        {po && (
          <>
            <section className="sm-card" aria-label="Receipt">
              <span className="sm-label">Supplier</span>
              <strong className="sm-title">{po.supplierName ?? '—'}</strong>
              <span className="sm-meta">Supplier Invoice Number {invoice.data?.invoiceNumber ?? (invoiceId ? '…' : '—')}</span>
              <span className="sm-meta">Purchase Order {po.poNumber} · {formatMoney(po.totalAmount, po.currency)}</span>
              <span className="sm-meta">Company Code {po.companyCode ?? '—'}</span>
              <span className="sm-meta">Received Date {formatDate(todayIso())}</span>
            </section>
            {locationsLoading ? null : stores.length === 0 ? (
              <p className="sm-notice sm-notice--warning">No store is available for this property; goods can only be received at a store.</p>
            ) : (
              <>
                <LocationPicker
                  label="Receiving store"
                  locations={stores}
                  value={storeId}
                  onChange={(id) => { setCheck(null); setStoreId(id); }}
                />
                {selectedStore && (
                  <p className="sm-meta">
                    Default is the property store{selectedStore.storeCategory ? ` (${selectedStore.storeCategory})` : ''}: {selectedStore.locationCode}.
                  </p>
                )}
              </>
            )}
            <div className="sm-field">
              <label htmlFor="sm-delivery-note">Delivery note</label>
              <input id="sm-delivery-note" className="sm-input" value={deliveryNote} onChange={(event) => setDeliveryNote(event.target.value)} />
              <span className="sm-meta">Defaults to the supplier invoice number.</span>
            </div>
            {openLines.length === 0 && <Empty text="Every line of this purchase order is fully received." />}
            {openLines.map((line) => (
              <GrnLineCard
                key={line.id}
                line={line}
                entry={entryOf(line)}
                invoiceQty={invoiceQtyOf(line.id)}
                messages={messagesOf(line.id)}
                disabled={busy !== null}
                onChange={(value) => change(line, value)}
              />
            ))}
            {check && (
              <section className={`sm-notice ${check.result.errors.length > 0 ? 'sm-notice--error' : 'sm-notice--warning'} sm-section`} role="alert">
                {check.result.errors.length > 0 ? <strong>Fix these before posting</strong> : <strong>Check before posting</strong>}
                <ul className="sm-section">
                  {[...check.result.errors, ...check.result.warnings].map((message) => (
                    <li key={message}>• {message}</li>
                  ))}
                </ul>
                <span className="sm-meta">
                  Received {formatQty(check.result.totalReceived)} · accepted {formatQty(check.result.totalAccepted)}
                  {check.result.totalValue !== null && check.result.totalValue !== undefined ? ` · value ${formatMoney(check.result.totalValue, check.result.currency)}` : ''}
                </span>
                {check.result.errors.length === 0 ? (
                  <button type="button" className="sm-btn sm-btn--primary" disabled={busy !== null} onClick={() => post(check.request)}>
                    {busy === 'post' ? 'POSTING GRN…' : 'Post anyway'}
                  </button>
                ) : (
                  <button type="button" className="sm-btn" disabled={busy !== null} onClick={checkAndPost}>
                    Check again
                  </button>
                )}
              </section>
            )}
            <Notice notice={notice} />
            {!check && (
              <button
                type="button"
                className="sm-btn sm-btn--success sm-btn--block"
                disabled={busy !== null || openLines.length === 0 || stores.length === 0 || locationsLoading}
                onClick={checkAndPost}
              >
                {busy === 'check' ? 'Checking…' : busy === 'post' ? 'POSTING GRN…' : 'POST GRN'}
              </button>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default GrnFormScreen;
