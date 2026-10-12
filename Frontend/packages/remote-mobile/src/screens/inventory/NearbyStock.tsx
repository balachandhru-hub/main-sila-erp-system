import React, { useState } from 'react';
import {
  formatQty,
  silaLabel,
  type SilaLiveInventoryDetail,
  type SilaLiveInventoryLocation,
  type SilaLocation,
} from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { createQuickTransfer, createTransfer } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import { Empty, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate } from '../../format';
import { useGo } from '../../navigation';
import { errorText } from '../../useLoad';

interface NearbyStockProps {
  detail: SilaLiveInventoryDetail;
  /** The location that needs the material. */
  currentLocationId: string;
  myLocations: SilaLocation[];
}

/** Other locations holding the material. Quick ITO and ITO send it to the location chosen above. */
const NearbyStock: React.FC<NearbyStockProps> = ({ detail, currentLocationId, myLocations }) => {
  const go = useGo();
  const { can } = useAccess();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const current = myLocations.find((location) => location.id === currentLocationId) ?? null;
  const nearby = detail.locations.filter((row) => row.locationId !== currentLocationId && row.onHandQty > 0);
  const canMove = (row: SilaLiveInventoryLocation): boolean =>
    can.manageTransfer && Boolean(current?.transferEnabled) && row.transferEnabled && (row.transferableQty ?? row.onHandQty) > 0;

  const quantityFor = (row: SilaLiveInventoryLocation): number => {
    const transferable = row.transferableQty ?? row.onHandQty;
    const wanted = detail.shortage && detail.shortage > 0 ? detail.shortage : 1;
    return Math.min(wanted, transferable);
  };

  const send = async (row: SilaLiveInventoryLocation, quick: boolean) => {
    if (!current) return;
    setBusyId(`${row.locationId}:${quick ? 'quick' : 'ito'}`);
    setNotice(null);
    try {
      const payload = {
        fromLocationId: row.locationId,
        toLocationId: current.id,
        reason: quick ? 'Guest service' : `Transfer from ${row.locationName}`,
        requiredBy: null,
        items: [{ materialId: detail.materialId, quantity: quantityFor(row), uom: null }],
      };
      const id = quick ? await createQuickTransfer(payload) : await createTransfer(payload);
      go(id ? `inventory/transfers/${id}` : 'inventory/transfers');
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setBusyId(null);
    }
  };

  return (
    <section className="sm-section" aria-labelledby="sm-nearby">
      <h2 id="sm-nearby">Available nearby</h2>
      {current && <p className="sm-muted">Quick ITO and ITO send stock to {current.locationName} ({current.locationCode}).</p>}
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
            {canMove(row) && current && (
              <div className="sm-grid-2">
                <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busyId !== null} onClick={() => send(row, true)}>
                  {busyId === `${row.locationId}:quick` ? 'Sending…' : `Quick ITO ${formatQty(quantityFor(row))}`}
                </button>
                <button type="button" className="sm-btn sm-btn--small" disabled={busyId !== null} onClick={() => send(row, false)}>
                  {busyId === `${row.locationId}:ito` ? 'Sending…' : `ITO ${formatQty(quantityFor(row))}`}
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
