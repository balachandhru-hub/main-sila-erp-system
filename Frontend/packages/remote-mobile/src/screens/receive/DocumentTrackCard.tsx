import React from 'react';
import type { SilaDocumentTrack } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import StatusBadge from '../../components/StatusBadge';
import { useGo } from '../../navigation';

interface DocumentTrackCardProps {
  track?: SilaDocumentTrack | null;
}

/** PO → GRN → Invoice → Attachment → Payment → SOA on mobile detail screens. */
const DocumentTrackCard: React.FC<DocumentTrackCardProps> = ({ track }) => {
  const go = useGo();
  if (!track || track.nodes.length === 0) return null;

  const open = (kind: string, id?: string | null) => {
    if (!id) return;
    if (kind === 'PO') go(`receive/pos/${id}`);
    if (kind === 'GRN') go(`receive/grns/${id}`);
    if (kind === 'INVOICE') go(`receive/invoices/${id}`);
  };

  return (
    <section className="sm-section" aria-labelledby="sm-doc-track">
      <h2 id="sm-doc-track">Document track</h2>
      <ol className="sm-list">
        {track.nodes.map((node, index) => {
          const nav = Boolean(node.id && (node.kind === 'PO' || node.kind === 'GRN' || node.kind === 'INVOICE'));
          return (
            <li key={`${node.kind}-${node.id ?? node.number ?? index}`} className={`sm-card${node.current ? ' sm-card--current' : ''}`}>
              <button
                type="button"
                className="sm-list-btn"
                disabled={!nav}
                onClick={() => open(node.kind, node.id)}
              >
                <strong className="sm-title">{node.label}</strong>
                <span className="sm-meta">{node.number ?? '—'}</span>
                {node.erpReference ? <span className="sm-meta">ERP {node.erpReference}</span> : null}
                {node.status ? <StatusBadge status={node.status} /> : null}
              </button>
            </li>
          );
        })}
      </ol>
      {track.attachments.length > 0 && (
        <>
          <h3 className="sm-subtitle">Attachments</h3>
          <ul className="sm-list">
            {track.attachments.map((file, index) => (
              <li key={`${file.documentType}-${index}`} className="sm-meta">
                {file.documentType} · {file.fileName}
                {file.status ? ` · ${file.status}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
      {track.history.length > 0 && (
        <>
          <h3 className="sm-subtitle">History</h3>
          <ul className="sm-list">
            {track.history.slice(0, 12).map((event, index) => (
              <li key={`${event.action}-${index}`} className="sm-meta">
                {event.action}
                {event.comment ? ` · ${event.comment}` : ''}
                {event.occurredOn ? ` · ${event.occurredOn.replace('T', ' ').slice(0, 19)}` : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default DocumentTrackCard;
