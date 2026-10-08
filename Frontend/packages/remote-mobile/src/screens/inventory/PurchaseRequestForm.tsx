import React, { useState } from 'react';
import type { SilaLiveInventoryDetail, SilaLocation } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { createPurchaseRequest } from '../../../../remote-buyer/src/api/silaMe/silaInventoryControlApi';
import QtyInput, { parseQty } from '../../components/QtyInput';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { errorText } from '../../useLoad';

interface PurchaseRequestFormProps {
  detail: SilaLiveInventoryDetail;
  location: SilaLocation;
  defaultQty: number;
  onClose: () => void;
  onCreated: (requestNumber: string) => void;
}

/** Raises a purchase request (source LIVE_INVENTORY) for the material at the location. */
const PurchaseRequestForm: React.FC<PurchaseRequestFormProps> = ({ detail, location, defaultQty, onClose, onCreated }) => {
  const [qty, setQty] = useState<string>(defaultQty > 0 ? String(defaultQty) : '');
  const [reason, setReason] = useState<string>('Live inventory shortage');
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const save = async () => {
    const quantity = parseQty(qty);
    if (!quantity) {
      setNotice({ tone: 'error', text: 'Enter a quantity above zero.' });
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const created = await createPurchaseRequest({
        locationId: location.id,
        materialId: detail.materialId,
        quantity,
        uom: null,
        reason: reason.trim() || null,
        source: 'LIVE_INVENTORY',
      });
      onCreated(created.requestNumber);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setSaving(false);
    }
  };

  return (
    <div className="sm-section" aria-label="Create purchase request">
      <p className="sm-meta">
        Purchase request for <strong>{detail.description}</strong> at {location.locationName}. The buyer adds it to the weekly bucket.
      </p>
      <QtyInput label={`Quantity (${detail.baseUom})`} value={qty} onChange={setQty} uom={detail.baseUom} disabled={saving} />
      <div className="sm-field">
        <label htmlFor="sm-pr-reason">Reason</label>
        <input id="sm-pr-reason" className="sm-input" maxLength={500} value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)} />
      </div>
      <Notice notice={notice} />
      <div className="sm-grid-2">
        <button type="button" className="sm-btn sm-btn--small" disabled={saving} onClick={onClose}>
          Back
        </button>
        <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={saving} onClick={save}>
          {saving ? 'Raising…' : 'Raise request'}
        </button>
      </div>
    </div>
  );
};

export default PurchaseRequestForm;
