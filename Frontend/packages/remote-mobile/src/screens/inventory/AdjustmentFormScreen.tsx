import React, { useState } from 'react';
import { SILA_ADJUSTMENT_TYPES, createAdjustment } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import LocationPicker from '../../components/LocationPicker';
import ScreenHeader from '../../components/ScreenHeader';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';
import MovementLines, { parseMovementQty, type MovementFormLine } from './movementLines';

const AdjustmentFormScreen: React.FC = () => {
  const go = useGo();
  const { locations, location } = useMyLocation();
  const [locationId, setLocationId] = useState(location?.id ?? '');
  const [type, setType] = useState('WASTE');
  const [reason, setReason] = useState('');
  const [lines, setLines] = useState<MovementFormLine[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const opening = type === 'OPENING_STOCK';
  const manual = type === 'MANUAL_ADJUSTMENT';

  const submit = async () => {
    setNotice(null);
    if (!locationId) {
      setNotice({ tone: 'error', text: 'Choose the location.' });
      return;
    }
    if (!opening && !reason.trim()) {
      setNotice({ tone: 'error', text: 'Enter the reason for the adjustment.' });
      return;
    }
    if (lines.length === 0) {
      setNotice({ tone: 'error', text: 'Add at least one material.' });
      return;
    }
    const bad = lines.find((line) => parseMovementQty(line.qty, manual) == null);
    if (bad) {
      setNotice({
        tone: 'error',
        text: manual ? `Enter a quantity other than zero for ${bad.label}.` : `Enter a quantity above zero for ${bad.label}.`,
      });
      return;
    }
    const badCost = lines.find((line) => line.unitCost.trim() !== '' && !(Number(line.unitCost) >= 0));
    if (badCost) {
      setNotice({ tone: 'error', text: `Unit cost for ${badCost.label} must be zero or more.` });
      return;
    }
    setSaving(true);
    try {
      const id = await createAdjustment({
        locationId,
        adjustmentType: type,
        reason: reason.trim() || null,
        items: lines.map((line) => ({
          materialId: line.materialId,
          quantity: parseMovementQty(line.qty, manual) ?? 0,
          uom: line.uom || null,
          unitCost: line.unitCost.trim() === '' ? null : Number(line.unitCost),
        })),
      });
      go(id ? `inventory/adjustments/${id}` : 'inventory/adjustments', { replace: true });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setSaving(false);
    }
  };

  return (
    <>
      <ScreenHeader
        title="New adjustment"
        eyebrow="Inventory"
        back
        intro={manual ? 'A positive quantity adds stock. A negative quantity removes it.' : 'Posted at once against the location.'}
      />
      <div className="sm-screen">
        <div className="sm-field">
          <label htmlFor="sm-adj-type">Type</label>
          <select id="sm-adj-type" className="sm-select" value={type} onChange={(event) => setType(event.target.value)}>
            {SILA_ADJUSTMENT_TYPES.map((item) => (
              <option key={item} value={item}>
                {silaLabel(item)}
              </option>
            ))}
          </select>
        </div>
        <LocationPicker label="Location" locations={locations} value={locationId} onChange={setLocationId} placeholder="Choose location" />
        <div className="sm-field">
          <label htmlFor="sm-adj-reason">Reason{opening ? ' (optional)' : ''}</label>
          <input id="sm-adj-reason" className="sm-input" value={reason} maxLength={500} onChange={(event) => setReason(event.target.value)} />
        </div>
        <MovementLines
          lines={lines}
          onChange={setLines}
          onNotice={(text) => setNotice({ tone: 'warning', text })}
          allowNegative={manual}
          showUnitCost={opening}
        />
        <Notice notice={notice} />
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={saving} onClick={submit}>
          {saving ? 'Posting…' : 'Post adjustment'}
        </button>
      </div>
    </>
  );
};

export default AdjustmentFormScreen;
