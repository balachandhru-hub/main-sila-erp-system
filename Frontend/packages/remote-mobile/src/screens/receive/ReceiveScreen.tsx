import React, { useMemo, useState } from 'react';
import { getReceivingDashboard, type SilaReceivingTask } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { firstNameOf, useAccess } from '../../access';
import { formatDate, formatDateTime } from '../../format';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';

const ReceiveScreen: React.FC = () => {
  const go = useGo();
  const { can, person } = useAccess();
  const { location } = useMyLocation();
  const supervisor = can.manageErpPosting || can.viewAudit;
  const [scope, setScope] = useState<'mine' | 'all'>('mine');
  const dashboard = useLoad(
    () => getReceivingDashboard({ locationId: location?.id }),
    location ? `recv-dash-${location.id}` : 'recv-dash',
  );
  const data = dashboard.data;
  const kpis = data?.kpis;
  const workbench = data?.workbench ?? [];
  const partials = workbench.filter((row) => row.receiptStatus === 'PARTIAL');
  const pending = workbench.filter((row) => row.receiptStatus === 'PENDING' || row.receiptStatus === 'EXPECTED_TODAY' || row.receiptStatus === 'OVERDUE');
  const tasks = data?.tasks ?? [];
  const shownTasks = useMemo(() => (scope === 'mine' ? tasks : workbench.map(rowToTask)), [scope, tasks, workbench]);

  const openTask = (task: SilaReceivingTask) => {
    if (task.goodsReceiptId && task.action === 'REVIEW') {
      go(`receive/grns/${task.goodsReceiptId}`);
      return;
    }
    if (task.purchaseOrderId && (task.action === 'RECEIVE' || task.action === 'RECEIVE_BALANCE')) {
      go(`receive/grn/new?poId=${encodeURIComponent(task.purchaseOrderId)}`);
      return;
    }
    if (task.purchaseOrderId) go(`receive/pos/${task.purchaseOrderId}`);
  };

  return (
    <>
      <ScreenHeader title="Receiving" eyebrow="SILA Store" intro={person ? `Hi ${firstNameOf(person)}`.trim() : undefined} />
      <div className="sm-screen">
        <OfflineBanner />
        {dashboard.loading && <Loading />}
        {dashboard.error && <ErrorNotice message={dashboard.error} onRetry={dashboard.reload} />}

        <section className="sm-section" aria-labelledby="sm-recv-kpis">
          <h2 id="sm-recv-kpis">Overview</h2>
          <div className="sm-grid-2">
            <button type="button" className="sm-stat" onClick={() => go('receive/pos?mode=receive')}>
              <span className="sm-muted">Expected</span>
              <strong>{kpis?.expectedToday ?? (dashboard.loading ? '…' : 0)}</strong>
            </button>
            <button type="button" className="sm-stat" onClick={() => go('receive/pos')}>
              <span className="sm-muted">Pending</span>
              <strong>{kpis?.pendingReceipt ?? (dashboard.loading ? '…' : 0)}</strong>
            </button>
            <button type="button" className="sm-stat" onClick={() => go('receive/pos')}>
              <span className="sm-muted">Partial</span>
              <strong>{kpis?.partiallyReceived ?? (dashboard.loading ? '…' : 0)}</strong>
            </button>
            <button type="button" className={`sm-stat${(kpis?.attentionRequired ?? 0) > 0 ? ' sm-stat--alert' : ''}`} onClick={() => go('receive/pending')}>
              <span className="sm-muted">Attention</span>
              <strong>{kpis?.attentionRequired ?? (dashboard.loading ? '…' : 0)}</strong>
            </button>
            {supervisor && (
              <>
                <button type="button" className="sm-stat" onClick={() => go('receive/pos')}>
                  <span className="sm-muted">Overdue</span>
                  <strong>{kpis?.overdue ?? 0}</strong>
                </button>
                <button type="button" className={`sm-stat${(kpis?.grnPostingFailed ?? 0) > 0 ? ' sm-stat--alert' : ''}`} onClick={() => go('receive/pending')}>
                  <span className="sm-muted">Exceptions</span>
                  <strong>{kpis?.grnPostingFailed ?? 0}</strong>
                </button>
              </>
            )}
          </div>
        </section>

        {supervisor && (
          <div className="sm-wrap">
            <button type="button" className={`sm-btn ${scope === 'mine' ? 'sm-btn--primary' : ''}`} onClick={() => setScope('mine')}>My tasks</button>
            <button type="button" className={`sm-btn ${scope === 'all' ? 'sm-btn--primary' : ''}`} onClick={() => setScope('all')}>All receiving</button>
          </div>
        )}

        <section className="sm-section" aria-labelledby="sm-recv-tasks">
          <h2 id="sm-recv-tasks">{scope === 'all' ? 'All receiving' : 'My Tasks'}</h2>
          {shownTasks.length === 0 && !dashboard.loading && <Empty text="You're all caught up." description="No receiving tasks in your scope." />}
          <ul className="sm-list">
            {shownTasks.map((task, index) => (
              <li key={`${task.type}-${task.purchaseOrderId}-${index}`}>
                <button type="button" className="sm-list-btn" onClick={() => openTask(task)}>
                  <span className="sm-row">
                    <strong>{task.poNumber || task.grnNumber || task.title}</strong>
                    <StatusBadge status={task.priority === 'CRITICAL' ? 'FAILED' : task.status || 'PENDING'} />
                  </span>
                  <span className="sm-meta">{task.title}{task.supplierName ? ` · ${task.supplierName}` : ''}{task.openLineCount != null ? ` · ${task.openLineCount} items` : ''}</span>
                  <span className="sm-meta">{task.expectedDate ? formatDate(task.expectedDate) : task.age || ''} · {task.action === 'REVIEW' ? 'Review' : task.action === 'RECEIVE_BALANCE' ? 'Receive balance' : 'Receive'}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="sm-section" aria-labelledby="sm-recv-quick">
          <h2 id="sm-recv-quick">Quick actions</h2>
          <div className="sm-actions">
            {can.processInvoice && <button type="button" className="sm-btn sm-btn--primary sm-btn--block" onClick={() => go('receive/scan')}>Scan invoice</button>}
            {can.postGrn && <button type="button" className="sm-btn sm-btn--primary sm-btn--block" onClick={() => go('receive/pos?mode=receive')}>Receive goods</button>}
            <button type="button" className="sm-btn sm-btn--block" onClick={() => go('receive/pos')}>Find PO</button>
            <button type="button" className="sm-btn sm-btn--block" onClick={() => go('receive/history')}>GRN History</button>
          </div>
        </section>

        <section className="sm-section" aria-labelledby="sm-recv-pending">
          <h2 id="sm-recv-pending">Pending receiving</h2>
          {pending.length === 0 && !dashboard.loading && <Empty text="No pending receipts." />}
          <ul className="sm-list">
            {pending.slice(0, 8).map((row) => (
              <li key={row.purchaseOrderId} className="sm-card">
                <strong>{row.poNumber}</strong>
                <span className="sm-meta">{row.supplierName || '—'} · {row.expectedDate ? formatDate(row.expectedDate) : 'No expected date'}</span>
                <span className="sm-meta">{row.openLineCount} open items · {row.receiptStatus}</span>
                {can.postGrn && (
                  <button type="button" className="sm-btn sm-btn--primary" onClick={() => go(`receive/grn/new?poId=${encodeURIComponent(row.purchaseOrderId)}`)}>
                    Receive
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="sm-section" aria-labelledby="sm-recv-partial">
          <h2 id="sm-recv-partial">Partial receipts</h2>
          {partials.length === 0 && !dashboard.loading && <Empty text="No partial receipts." />}
          <ul className="sm-list">
            {partials.slice(0, 8).map((row) => (
              <li key={`p-${row.purchaseOrderId}`} className="sm-card">
                <strong>{row.poNumber}</strong>
                <span className="sm-meta">{row.supplierName || '—'}</span>
                <span className="sm-meta">Received {row.receivedQty} · Open {row.openQty}</span>
                {can.postGrn && (
                  <button type="button" className="sm-btn sm-btn--primary" onClick={() => go(`receive/grn/new?poId=${encodeURIComponent(row.purchaseOrderId)}`)}>
                    Receive balance
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section className="sm-section" aria-labelledby="sm-recv-attn">
          <h2 id="sm-recv-attn">Attention Required</h2>
          {(data?.exceptions ?? []).length === 0 && !dashboard.loading && <Empty text="No items require your attention." description="You're all caught up." />}
          <ul className="sm-list">
            {(data?.exceptions ?? []).map((row, index) => (
              <li key={`${row.document}-${index}`}>
                <button
                  type="button"
                  className="sm-list-btn"
                  onClick={() => row.goodsReceiptId ? go(`receive/grns/${row.goodsReceiptId}`) : row.purchaseOrderId ? go(`receive/pos/${row.purchaseOrderId}`) : undefined}
                >
                  <span className="sm-row">
                    <strong>{row.document}</strong>
                    <StatusBadge status={row.severity === 'CRITICAL' ? 'FAILED' : row.status || 'PENDING'} />
                  </span>
                  <span className="sm-meta">{row.exception}{row.supplierName ? ` · ${row.supplierName}` : ''} · {row.age}</span>
                  {row.message && <span className="sm-meta">{row.message}</span>}
                </button>
              </li>
            ))}
          </ul>
        </section>

        {supervisor && (
          <section className="sm-section" aria-labelledby="sm-recv-team">
            <h2 id="sm-recv-team">Team activity</h2>
            <p className="sm-meta">Receipts {data?.team.receiptsCompleted ?? 0} · Posted {data?.team.grnsPosted ?? 0} · Partials {data?.team.partialReceipts ?? 0} · Reversals {data?.team.reversals ?? 0} · Failures {data?.team.failures ?? 0}</p>
            <p className="sm-meta">Aging under 1 day {data?.aging.pendingUnderOneDay ?? 0} · 1–2 days {data?.aging.pendingOneToTwoDays ?? 0} · 3+ days {data?.aging.pendingThreePlusDays ?? 0}</p>
          </section>
        )}

        <section className="sm-section" aria-labelledby="sm-recv-activity">
          <h2 id="sm-recv-activity">Recent Activity</h2>
          {(data?.activity ?? []).length === 0 && !dashboard.loading && <Empty text="No recent receiving activity." />}
          <ul className="sm-list">
            {(data?.activity ?? []).slice(0, 10).map((item) => (
              <li key={`${item.document}-${item.occurredOn}`}>
                <button
                  type="button"
                  className="sm-list-btn"
                  onClick={() => item.goodsReceiptId ? go(`receive/grns/${item.goodsReceiptId}`) : item.purchaseOrderId ? go(`receive/pos/${item.purchaseOrderId}`) : undefined}
                >
                  <span className="sm-row">
                    <strong>{item.document}</strong>
                    <StatusBadge status={item.status || item.action} />
                  </span>
                  <span className="sm-meta">{formatDateTime(item.occurredOn)} · {item.action}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
};

const rowToTask = (row: { purchaseOrderId: string; poNumber: string; supplierName?: string | null; receiptStatus: string; action: string; expectedDate?: string | null; openLineCount: number }): SilaReceivingTask => ({
  priority: row.receiptStatus === 'OVERDUE' ? 'ACTION_REQUIRED' : 'ACTION_REQUIRED',
  type: row.receiptStatus,
  title: row.receiptStatus === 'PARTIAL' ? 'Continue partial receipt' : 'Receive PO',
  poNumber: row.poNumber,
  supplierName: row.supplierName,
  expectedDate: row.expectedDate,
  status: row.receiptStatus,
  action: row.action,
  purchaseOrderId: row.purchaseOrderId,
  openLineCount: row.openLineCount,
});

export default ReceiveScreen;
