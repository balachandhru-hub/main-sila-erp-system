import React from 'react';
import type { SilaGoodsReceipt } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import type { SilaAlert } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useGo } from '../../navigation';
import { grnErpStatus } from '../receive/grnStatus';
import { alertTarget } from '../tasks/alertRouting';

interface HomeAttentionProps {
  failedGrns: SilaGoodsReceipt[];
  grnsError: string | null;
  onRetryGrns: () => void;
  alerts: SilaAlert[];
  alertsLoading: boolean;
  alertsError: string | null;
  onRetryAlerts: () => void;
}

/** "Attention required": goods receipts the ERP refused or did not confirm, then the newest alerts. */
const HomeAttention: React.FC<HomeAttentionProps> = ({ failedGrns, grnsError, onRetryGrns, alerts, alertsLoading, alertsError, onRetryAlerts }) => {
  const go = useGo();
  const nothing = !alertsLoading && !alertsError && !grnsError && failedGrns.length === 0 && alerts.length === 0;

  return (
    <section className="sm-section" aria-labelledby="sm-attention">
      <h2 id="sm-attention">Attention required</h2>
      {alertsLoading && <Loading />}
      {grnsError && <ErrorNotice message={grnsError} onRetry={onRetryGrns} />}
      {alertsError && <ErrorNotice message={alertsError} onRetry={onRetryAlerts} />}
      {nothing && <Empty text="Nothing requires your attention." />}
      <ul className="sm-list">
        {failedGrns.map((grn) => {
          const status = grnErpStatus(grn);
          return (
            <li key={grn.id}>
              <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
                <span className="sm-row">
                  <strong>{grn.grnNumber}</strong>
                  <StatusBadge status={status === 'FAILED' ? 'FAILED' : 'CRITICAL'} />
                </span>
                <span className="sm-meta">
                  {grn.supplierName ?? '—'} · {grn.poNumber}
                </span>
              </button>
            </li>
          );
        })}
        {alerts.map((alert) => (
          <li key={alert.id}>
            <button type="button" className="sm-list-btn" onClick={() => go(alertTarget(alert) ?? 'tasks/alerts')}>
              <span className="sm-row">
                <strong>{alert.title}</strong>
                <StatusBadge status={alert.severity} />
              </span>
              <span className="sm-meta">{alert.message}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default HomeAttention;
