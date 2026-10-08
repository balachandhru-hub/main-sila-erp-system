import React, { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { getLocations } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { createQuickTransfer, createTransfer, type SilaTransferWrite } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import LocationPicker from '../../components/LocationPicker';
import MaterialPicker, { materialUoms } from '../../components/MaterialPicker';
import QtyInput, { parseQty } from '../../components/QtyInput';
import ScreenHeader from '../../components/ScreenHeader';
import { ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import { isTransferPrefill } from './transferPrefill';

interface FormLine {
  key: string;
  materialId: string;
  label: string;
  uoms: string[];
  uom: string;
  qty: string;
}

const TransferFormScreen: React.FC = () => {
  const go = useGo();
  const [params] = useSearchParams();
  const quick = params.get('mode') === 'quick';
  /** Quick transfer of stock already taken from the source; the source confirms or disputes the handover. */
  const [alreadyCollected, setAlreadyCollected] = useState<boolean>(() => quick && params.get('collected') === '1');
  const routerState: unknown = useLocation().state;
  const prefill = isTransferPrefill(routerState) ? routerState : null;
  const { locations: myLocations, location: myLocation } = useMyLocation();
  const all = useLoad(getLocations, 'all-locations');
  const [chosenFromId, setFromId] = useState<string>(prefill?.fromLocationId ?? '');
  const [chosenToId, setToId] = useState<string>(prefill?.toLocationId ?? '');
  // My location loads asynchronously: it is the default destination (the requester receives, as in the prototype).
  const fromId = chosenFromId;
  const toId = chosenToId || myLocation?.id || '';
  const [requiredBy, setRequiredBy] = useState<string>('');
  const [reason, setReason] = useState<string>(prefill?.reason ?? '');
  const [lines, setLines] = useState<FormLine[]>(() =>
    prefill?.material
      ? [
          {
            key: prefill.material.id,
            materialId: prefill.material.id,
            label: `${prefill.material.description} (${prefill.material.materialCode})`,
            uoms: [prefill.material.baseUom],
            uom: prefill.material.baseUom,
            qty: prefill.quantity ? String(prefill.quantity) : '',
          },
        ]
      : [],
  );
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const transferable = (all.data ?? []).filter((location) => location.transferEnabled);
  const myIds = myLocations.map((location) => location.id);
  const toOptions = quick ? transferable : transferable.filter((location) => myIds.includes(location.id));
  const fromOptions = transferable.filter((location) => location.id !== toId);

  const updateLine = (key: string, change: Partial<FormLine>) =>
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...change } : line)));

  const submit = async () => {
    setNotice(null);
    if (!fromId || !toId || fromId === toId) {
      setNotice({ tone: 'error', text: 'Choose two different locations.' });
      return;
    }
    if (lines.length === 0) {
      setNotice({ tone: 'error', text: 'Add at least one material.' });
      return;
    }
    const bad = lines.find((line) => !parseQty(line.qty));
    if (bad) {
      setNotice({ tone: 'error', text: `Enter a quantity above zero for ${bad.label}.` });
      return;
    }
    const payload: SilaTransferWrite = {
      fromLocationId: fromId,
      toLocationId: toId,
      reason: reason.trim() || null,
      requiredBy: quick ? null : requiredBy || null,
      items: lines.map((line) => ({ materialId: line.materialId, quantity: parseQty(line.qty) ?? 0, uom: line.uom || null })),
      ...(quick ? { alreadyCollected } : {}),
    };
    setSaving(true);
    try {
      const id = quick ? await createQuickTransfer(payload) : await createTransfer(payload);
      go(id ? `inventory/transfers/${id}` : 'inventory/transfers', { replace: true });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader
        title={quick ? (alreadyCollected ? 'Record Quick Transfer' : 'Quick Transfer') : 'Request transfer'}
        eyebrow={quick ? 'Inventory' : 'ITO'}
        back
        intro={
          quick
            ? alreadyCollected
              ? 'You already took the stock; the source confirms the handover or disputes it.'
              : 'Stock leaves the source now; the destination confirms the receipt.'
            : 'The source location approves and dispatches; you receive it.'
        }
      />
      <div className="sm-screen">
        {quick && (
          <label className="sm-check">
            <input type="checkbox" checked={alreadyCollected} onChange={(event) => setAlreadyCollected(event.target.checked)} />
            Already collected (I took the stock from the source)
          </label>
        )}
        {all.loading && <Loading text="Loading locations…" />}
        {all.error && <ErrorNotice message={all.error} onRetry={all.reload} />}
        {all.data && (
          <>
            <LocationPicker label="From" locations={fromOptions} value={fromId} onChange={setFromId} placeholder="Choose source" />
            <LocationPicker label={quick ? 'To (defaults to mine)' : 'To'} locations={toOptions} value={toId} onChange={setToId} placeholder="Choose destination" />
          </>
        )}
        {!quick && (
          <div className="sm-field">
            <label htmlFor="sm-required-by">Required by (optional)</label>
            <input id="sm-required-by" className="sm-input" type="date" value={requiredBy} onChange={(event) => setRequiredBy(event.target.value)} />
          </div>
        )}
        <div className="sm-field">
          <label htmlFor="sm-reason">Reason (optional)</label>
          <input id="sm-reason" className="sm-input" value={reason} onChange={(event) => setReason(event.target.value)} />
        </div>

        <section className="sm-section" aria-labelledby="sm-lines">
          <h2 id="sm-lines">Materials ({lines.length})</h2>
          {lines.map((line) => (
            <div key={line.key} className="sm-card">
              <div className="sm-row">
                <strong>{line.label}</strong>
                <button
                  type="button"
                  className="sm-btn sm-btn--small sm-btn--danger"
                  aria-label={`Remove ${line.label}`}
                  onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                >
                  Remove
                </button>
              </div>
              <QtyInput
                label="Quantity"
                value={line.qty}
                onChange={(qty) => updateLine(line.key, { qty })}
                uoms={line.uoms}
                uom={line.uom}
                onUomChange={(uom) => updateLine(line.key, { uom })}
              />
            </div>
          ))}
          <MaterialPicker
            label="Add material"
            onPick={(material) => {
              if (lines.some((line) => line.materialId === material.id)) {
                setNotice({ tone: 'warning', text: `${material.description} is already in the list.` });
                return;
              }
              setNotice(null);
              setLines((current) => [
                ...current,
                {
                  key: material.id,
                  materialId: material.id,
                  label: `${material.description} (${material.materialCode})`,
                  uoms: materialUoms(material),
                  uom: material.baseUom,
                  qty: '',
                },
              ]);
            }}
          />
        </section>

        <Notice notice={notice} />
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={saving} onClick={submit}>
          {saving ? 'Sending…' : quick ? (alreadyCollected ? 'Submit already collected' : 'Request') : 'Submit'}
        </button>
      </div>
    </>
  );
};

export default TransferFormScreen;
