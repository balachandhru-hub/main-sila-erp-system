import React, { useState } from 'react';
import {
  formatQty,
  silaLabel,
  type SilaLiveInventoryDetail,
  type SilaLiveInventoryLocation,
  type SilaLocation,
} from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { createQuickTransfer } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import { Empty, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';
import type { TransferPrefill } from './transferPrefill';

interface NearbyStockProps {
  detail: SilaLiveInventoryDetail;
  /** The location that needs the material. */
  currentLocationId: string;
  myLocations: SilaLocation[];
}

/** "Available nearby": other locations holding the material, with GET 1 (quick transfer of one unit) and REQUEST. */
const NearbyStock: React.FC<NearbyStockProps> = ({ detail, currentLocationId, myLocations }) => {
  const go = useGo();
  const { can } = useAccess();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const current = myLocations.find((location) => location.id === currentLocationId) ?? null;
  const nearby = detail.locations.filter((row) => row.locationId !== currentLocationId && row.onHandQty > 0);
  const canMove = (row: SilaLiveInventoryLocation): boolean =>
    can.manageTransfer && Boolean(current?.transferEnabled) && row.transferEnabled && (row.transferableQty ?? row.onHandQty) > 0;

  const getOne = async (row: SilaLiveInventoryLocation) => {
    if (!current) return;
    setBusyId(row.locationId);
    setNotice(null);
    try {
      const id = await createQuickTransfer({
        fromLocationId: row.locationId,
        toLocationId: current.id,
        reason: 'Guest service',
        requiredBy: null,
        items: [{ materialId: detail.materialId, quantity: 1, uom: null }],
      });
      go(id ? `inventory/transfers/${id}` : 'inventory/transfers');
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setBusyId(null);
    }
  };

  const request = (row: SilaLiveInventoryLocation) => {
    const prefill: TransferPrefill = {
      fromLocationId: row.locationId,
      toLocationId: current?.id ?? '',
      material: { id: detail.materialId, materialCode: detail.materialCode, description: detail.description, baseUom: detail.baseUom },
      quantity: detail.shortage && detail.shortage > 0 ? Math.min(detail.shortage, row.transferableQty ?? detail.shortage) : undefined,
    };
    go('inventory/transfers/new', { state: prefill });
  };

  return (
    <section className="sm-section" aria-labelledby="sm-nearby">
      <h2 id="sm-nearby">Available nearby</h2>
      <Notice notice={notice} />
      {nearby.length === 0 && <Empty text="No nearby stock" description="No transferable internal quantity is currently recorded." />}
      <ul className="sm-list">
        {nearby.map((row) => (
          <li key={row.locationId} className="sm-card">
            <div className="sm-row">
              <strong className="sm-title">{row.locationName}</strong>
              <span>
                {formatQty(row.onHandQty)} {detail.baseUom}
              </span>
            </div>
            <span className="sm-meta">
              {silaLabel(row.locationType)} · {row.propertyName} · Available {formatQty(row.onHandQty)} · Transferable{' '}
              {formatQty(row.transferableQty ?? row.onHandQty)}
              {row.inTransitQty > 0 ? ` · in transit ${formatQty(row.inTransitQty)}` : ''}
            </span>
            {row.lastMovementOn && <span className="sm-meta">Last movement {formatDate(row.lastMovementOn)}</span>}
            {canMove(row) && (
              <div className="sm-grid-2">
                <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busyId !== null} onClick={() => getOne(row)}>
                  {busyId === row.locationId ? 'Sending…' : 'GET 1'}
                </button>
                <button type="button" className="sm-btn sm-btn--small" disabled={busyId !== null} onClick={() => request(row)}>
                  REQUEST
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
};

export default NearbyStock;
