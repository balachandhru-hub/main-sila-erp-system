import React, { useState } from 'react';
import { formatQty, type SilaLiveInventoryDetail, type SilaLocation } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { createPhysicalInventory } from '../../../../remote-buyer/src/api/silaMe/silaControlApi';
import LocationPicker from '../../components/LocationPicker';
import QtyInput from '../../components/QtyInput';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';
import PurchaseRequestForm from './PurchaseRequestForm';
import type { TransferPrefill } from './transferPrefill';

const ACTION_LABEL: Record<string, string> = {
  REQUEST_TRANSFER: 'Request transfer',
  QUICK_TRANSFER: 'Quick transfer',
  CREATE_PR: 'Create purchase request',
  REQUEST_PHYSICAL_INVENTORY: 'Request physical inventory',
};

interface MaterialDecisionProps {
  detail: SilaLiveInventoryDetail;
  locations: SilaLocation[];
  currentLocationId: string;
  requiredQty: string;
  onCurrentLocationChange: (locationId: string) => void;
  onRequiredQtyChange: (value: string) => void;
}

/** Required quantity at my location → recommendation and next actions (same rules as the cloud live inventory). */
const MaterialDecision: React.FC<MaterialDecisionProps> = ({
  detail,
  locations,
  currentLocationId,
  requiredQty,
  onCurrentLocationChange,
  onRequiredQtyChange,
}) => {
  const go = useGo();
  const { can } = useAccess();
  const [panel, setPanel] = useState<'pr' | 'count' | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const current = locations.find((location) => location.id === (detail.currentLocationId ?? currentLocationId)) ?? null;
  const required = Number(requiredQty) || 0;
  const shortage = detail.shortage ?? 0;

  const allowed = (action: string): boolean => {
    if (action === 'CREATE_PR') return can.requestPurchase;
    if (action === 'REQUEST_TRANSFER' || action === 'QUICK_TRANSFER') return can.manageTransfer && Boolean(detail.bestSourceLocationId);
    if (action === 'REQUEST_PHYSICAL_INVENTORY') return can.manageCount;
    return false;
  };
  const actions = (detail.nextActions ?? []).filter((action) => action in ACTION_LABEL && allowed(action));

  // Move what is missing (or what is required), at most what the source can give.
  const transferQty = (): number => {
    const wanted = shortage > 0 ? shortage : required > 0 ? required : 1;
    return Math.min(wanted, detail.bestSourceTransferableQty ?? wanted);
  };

  const run = (action: string) => {
    setNotice(null);
    if (!current) return;
    if (action === 'CREATE_PR') setPanel('pr');
    else if (action === 'REQUEST_PHYSICAL_INVENTORY') setPanel('count');
    else {
      const prefill: TransferPrefill = {
        fromLocationId: detail.bestSourceLocationId ?? undefined,
        toLocationId: current.id,
        material: { id: detail.materialId, materialCode: detail.materialCode, description: detail.description, baseUom: detail.baseUom },
        quantity: transferQty(),
        reason: action === 'QUICK_TRANSFER' ? 'Guest service' : 'Live inventory shortage',
      };
      go(action === 'QUICK_TRANSFER' ? 'inventory/transfers/new?mode=quick' : 'inventory/transfers/new', { state: prefill });
    }
  };

  const requestCount = async () => {
    if (!current) return;
    setBusy(true);
    try {
      const created = await createPhysicalInventory({ locationId: current.id, reason: `Live inventory: check the stock of ${detail.materialCode}` });
      setPanel(null);
      setNotice({ tone: 'success', text: `Physical inventory ${created.requestNumber} requested at ${current.locationName}.` });
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sm-card" aria-labelledby="sm-decision">
      <h2 id="sm-decision" className="sm-label">
        What do you need?
      </h2>
      <LocationPicker label="Needed at" locations={locations} value={current?.id ?? ''} onChange={onCurrentLocationChange} placeholder="Select a location" />
      <QtyInput label={`Required quantity (${detail.baseUom})`} value={requiredQty} onChange={onRequiredQtyChange} uom={detail.baseUom} />
      <div className="sm-chips">
        <span className="sm-badge sm-badge--neutral">Here {formatQty(detail.localAvailable)}</span>
        <span className={`sm-badge ${shortage > 0 ? 'sm-badge--warning' : 'sm-badge--success'}`}>Shortage {formatQty(shortage)}</span>
        {detail.bestSourceName && (
          <span className="sm-badge">
            Best source {detail.bestSourceName} ({formatQty(detail.bestSourceTransferableQty)})
          </span>
        )}
      </div>
      {detail.recommendationReason && <p className="sm-meta">{detail.recommendationReason}</p>}
      <Notice notice={notice} />
      {!current && <p className="sm-muted">Choose the location that needs the material.</p>}
      {current && actions.length > 0 && panel === null && (
        <div className="sm-grid-2">
          {actions.map((action, index) => (
            <button key={action} type="button" className={`sm-btn sm-btn--small${index === 0 ? ' sm-btn--primary' : ''}`} onClick={() => run(action)}>
              {ACTION_LABEL[action]}
            </button>
          ))}
        </div>
      )}
      {current && panel === 'pr' && (
        <PurchaseRequestForm
          detail={detail}
          location={current}
          defaultQty={shortage > 0 ? shortage : required}
          onClose={() => setPanel(null)}
          onCreated={(number) => {
            setPanel(null);
            setNotice({ tone: 'success', text: `Purchase request ${number} raised. Find it under Inventory › Purchase requests.` });
          }}
        />
      )}
      {current && panel === 'count' && (
        <div className="sm-notice sm-notice--warning sm-section" role="alertdialog" aria-label="Request physical inventory">
          <p>Schedule a physical inventory (blind count) at {current.locationName}?</p>
          <div className="sm-grid-2">
            <button type="button" className="sm-btn sm-btn--small" disabled={busy} onClick={() => setPanel(null)}>
              Back
            </button>
            <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busy} onClick={requestCount}>
              {busy ? 'Requesting…' : 'Request count'}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default MaterialDecision;
