import React from 'react';
import { useParams } from 'react-router-dom';
import { formatQty, silaLabel } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { getTransfer } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import Card from '../../components/Card';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { ErrorNotice, Loading } from '../../components/StateViews';
import { formatDate, formatDateTime } from '../../format';
import { useLoad } from '../../useLoad';
import TransferActions from './TransferActions';

const TransferDetailScreen: React.FC = () => {
  const { transferId = '' } = useParams();
  const { data, loading, error, reload } = useLoad(() => getTransfer(transferId), transferId || null);

  return (
    <>
      <ScreenHeader title={data?.itoNumber ?? 'Transfer'} eyebrow="Transfer" back />
      <div className="sm-screen">
        {loading && !data && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {data && (
          <>
            <Card
              title={`${data.fromLocationName ?? '—'} → ${data.toLocationName ?? '—'}`}
              aside={<StatusBadge status={data.status} label={`${data.mode} ${data.status}`.replace(/_/g, ' ')} />}
            >
              <dl className="sm-kv">
                <dt>Type</dt>
                <dd>
                  {data.mode === 'QUICK' ? 'Quick transfer' : 'Standard ITO'}
                  {data.alreadyCollected ? ' · already collected' : ''}
                </dd>
                <dt>From</dt>
                <dd>{data.fromLocationName ?? '—'}</dd>
                <dt>To</dt>
                <dd>{data.toLocationName ?? '—'}</dd>
                <dt>Requested by</dt>
                <dd>{data.requestedByName ?? '—'}</dd>
                <dt>Requested on</dt>
                <dd>{formatDate(data.requestedOn)}</dd>
                {data.requiredBy && (
                  <>
                    <dt>Required by</dt>
                    <dd>{formatDate(data.requiredBy)}</dd>
                  </>
                )}
                {data.dispatchedOn && (
                  <>
                    <dt>Dispatched</dt>
                    <dd>{formatDateTime(data.dispatchedOn)}</dd>
                  </>
                )}
                {data.receivedOn && (
                  <>
                    <dt>Received</dt>
                    <dd>{formatDateTime(data.receivedOn)}</dd>
                  </>
                )}
                {data.reason && (
                  <>
                    <dt>Reason</dt>
                    <dd>{data.reason}</dd>
                  </>
                )}
              </dl>
              {data.alreadyCollected && data.allowedActions.includes('CONFIRM_HANDOVER') && (
                <p className="sm-notice sm-notice--warning">The requester says the stock was already collected. Confirm the handover or dispute it.</p>
              )}
              {data.disputeReason && <p className="sm-notice sm-notice--error">Disputed: {data.disputeReason}</p>}
            </Card>

            <section className="sm-section" aria-labelledby="sm-ito-lines">
              <h2 id="sm-ito-lines">Lines ({data.items.length})</h2>
              <ul className="sm-list">
                {data.items.map((item) => (
                  <li key={item.id} className="sm-card">
                    <strong>{item.materialName}</strong>
                    <span className="sm-muted">
                      {item.materialCode} · {item.uom}
                    </span>
                    <div className="sm-grid-2">
                      <span>Requested {formatQty(item.requestedQty)}</span>
                      <span>Approved {formatQty(item.approvedQty)}</span>
                      <span>Dispatched {formatQty(item.dispatchedQty)}</span>
                      <span>Received {formatQty(item.receivedQty)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <TransferActions transfer={data} onDone={reload} />

            <section className="sm-section" aria-labelledby="sm-ito-events">
              <h2 id="sm-ito-events">History</h2>
              {data.events.length === 0 ? (
                <p className="sm-muted">No events yet.</p>
              ) : (
                <ol className="sm-timeline">
                  {data.events.map((event, index) => (
                    <li key={`${event.on}-${index}`}>
                      <strong>{silaLabel(event.action)}</strong>
                      <p className="sm-muted">
                        {event.actorName} · {formatDateTime(event.on)}
                      </p>
                      {event.comment && <p>{event.comment}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
};

export default TransferDetailScreen;
