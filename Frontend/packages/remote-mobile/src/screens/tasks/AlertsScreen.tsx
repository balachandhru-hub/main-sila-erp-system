import React, { useState } from 'react';
import { getAlerts, updateAlert, type SilaAlert } from '../../../../remote-buyer/src/api/silaMe/silaStockCountApi';
import { requestAlertPhysicalInventory } from '../../../../remote-buyer/src/api/silaMe/silaControlApi';
import { silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, Notice, type NoticeMessage } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDateTime } from '../../format';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import { alertTarget } from './alertRouting';

const ACTION_TEXT: Record<string, string> = {
  REQUEST_TRANSFER: 'Request a transfer',
  QUICK_TRANSFER: 'Quick transfer',
  REQUEST_PHYSICAL_INVENTORY: 'Request a physical inventory',
  INVESTIGATE: 'Investigate',
  REVIEW_TRANSFER: 'Review the transfer',
  CREATE_PR: 'Create a purchase request',
};

/** Open alerts at my locations (prototype "Inventory actions"); variances only for count managers / approvers. */
const AlertsScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(() => getAlerts('NEW'), 'alerts-new');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const visible = (data ?? []).filter((alert) => alert.alertType !== 'INVENTORY_VARIANCE' || can.manageCount || can.approveCount);

  const act = async (alert: SilaAlert, kind: 'ack' | 'count') => {
    setBusy(`${kind}-${alert.id}`);
    setNotice(null);
    try {
      if (kind === 'ack') {
        await updateAlert(alert.id, 'acknowledge');
        setNotice({ tone: 'success', text: `“${alert.title}” acknowledged.` });
      } else {
        const created = await requestAlertPhysicalInventory(alert.id);
        setNotice({ tone: 'success', text: `Physical inventory ${created.requestNumber} scheduled at ${created.locationName ?? 'the location'}.` });
      }
      reload();
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
    } finally {
      setBusy(null);
    }
  };

  const actionText = (alert: SilaAlert): string | null => {
    const action = (alert.recommendedAction ?? '').toUpperCase();
    if (!action) return null;
    if (action === 'REQUEST_PHYSICAL_INVENTORY' && !can.manageCount) return 'Manager review';
    return ACTION_TEXT[action] ?? silaLabel(action);
  };

  return (
    <>
      <ScreenHeader title="Inventory actions" eyebrow="Alerts" back />
      <div className="sm-screen">
        <Notice notice={notice} />
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !error && visible.length === 0 && (
          <Empty text="No open actions" description="Stockout, discrepancy, and manager-review tasks appear here." />
        )}
        <ul className="sm-list">
          {visible.map((alert) => {
            const target = alertTarget(alert);
            const recommended = actionText(alert);
            const canCount = can.manageCount && (alert.recommendedAction ?? '').toUpperCase() === 'REQUEST_PHYSICAL_INVENTORY';
            return (
              <li key={alert.id} className="sm-card">
                <div className="sm-row">
                  <strong className="sm-title">{silaLabel(alert.alertType)}</strong>
                  <StatusBadge status={alert.severity} />
                </div>
                <span className="sm-meta">
                  {silaLabel(alert.severity)} · {alert.title}
                </span>
                <p className="sm-meta">{alert.message}</p>
                <p className="sm-meta">
                  {[alert.locationName, alert.materialName, formatDateTime(alert.dateCreated)].filter(Boolean).join(' · ')}
                </p>
                {recommended && <p className="sm-meta">Recommended: {recommended}</p>}
                <div className="sm-grid-2">
                  {target && (
                    <button type="button" className="sm-btn sm-btn--small" onClick={() => go(target)}>
                      Open
                    </button>
                  )}
                  {canCount && (
                    <button type="button" className="sm-btn sm-btn--small" disabled={busy !== null} onClick={() => act(alert, 'count')}>
                      {busy === `count-${alert.id}` ? 'Requesting…' : 'Request count'}
                    </button>
                  )}
                  <button type="button" className="sm-btn sm-btn--small sm-btn--primary" disabled={busy !== null} onClick={() => act(alert, 'ack')}>
                    {busy === `ack-${alert.id}` ? 'Saving…' : 'Acknowledge'}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
};

export default AlertsScreen;
