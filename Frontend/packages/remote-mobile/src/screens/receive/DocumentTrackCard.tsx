import React, { useState } from 'react';
import type { SilaDocumentTrack, SilaDocumentTrackNode } from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import StatusBadge from '../../components/StatusBadge';
import { useGo } from '../../navigation';

interface DocumentTrackCardProps {
  track?: SilaDocumentTrack | null;
  /** Invoice of the current GRN/invoice screen, when known. */
  linkedInvoiceId?: string | null;
}

const nodeKey = (node: SilaDocumentTrackNode, index: number): string =>
  `${node.kind}-${node.id ?? node.number ?? index}`;

const nodeId = (node: SilaDocumentTrackNode): string => `${node.kind}:${node.id ?? node.number ?? ''}`;

/** PO → GRN → Invoice → Attachment → Payment → SOA on mobile detail screens. */
const DocumentTrackCard: React.FC<DocumentTrackCardProps> = ({ track, linkedInvoiceId }) => {
  const go = useGo();
  const [isExpanded, setIsExpanded] = useState(false);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  if (!track || track.nodes.length === 0) return null;

  const currentGrn = track.nodes.find((node) =>
    node.kind === 'GRN' && (node.current || (track.rootKind === 'GRN' && node.id === track.rootId)),
  );
  const purchaseOrder = track.nodes.find((node) => node.kind === 'PO');
  const currentInvoice = track.nodes.find((node) =>
    node.kind === 'INVOICE'
    && (node.current
      || (linkedInvoiceId && node.id === linkedInvoiceId)
      || (track.rootKind === 'INVOICE' && node.id === track.rootId)),
  );
  const currentNodes = [currentGrn, purchaseOrder, currentInvoice].filter((node): node is SilaDocumentTrackNode => Boolean(node));
  const currentIds = new Set(currentNodes.map(nodeId));
  const related = track.nodes.filter((node) => !currentIds.has(nodeId(node)));
  const showGroups = Boolean(currentGrn || (track.rootKind === 'GRN' || track.rootKind === 'INVOICE'));

  const open = (kind: string, id?: string | null) => {
    if (!id) return;
    if (kind === 'PO') go(`receive/pos/${id}`);
    if (kind === 'GRN') go(`receive/grns/${id}`);
    if (kind === 'INVOICE') go(`receive/invoices/${id}`);
  };

  const list = (nodes: SilaDocumentTrackNode[]) => (
    <ol className="sm-list">
      {nodes.map((node, index) => {
        const nav = Boolean(node.id && (node.kind === 'PO' || node.kind === 'GRN' || node.kind === 'INVOICE'));
        return (
          <li key={nodeKey(node, index)} className={`sm-card${node.current ? ' sm-card--current' : ''}`}>
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
  );

  return (
    <section className="sm-section" aria-labelledby="sm-doc-track">
      <div className="sm-row">
        <h2 id="sm-doc-track">Document track</h2>
        <button
          type="button"
          className="sm-btn"
          aria-expanded={isExpanded}
          aria-controls="sm-doc-track-body"
          aria-label={isExpanded ? 'Collapse document track' : 'Show document track'}
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? 'Collapse' : 'i'}
        </button>
      </div>
      {isExpanded && (
        <div id="sm-doc-track-body">
          {showGroups ? (
            <>
              <h3 className="sm-subtitle">Current transaction</h3>
              {list(currentNodes.length > 0 ? currentNodes : track.nodes.slice(0, 1))}
              {related.length > 0 && (
                <>
                  <h3 className="sm-subtitle">Related PO history</h3>
                  {list(related)}
                </>
              )}
            </>
          ) : (
            list(track.nodes)
          )}
          {track.attachments.length > 0 && (
            <div className="sm-actions">
              <button type="button" className="sm-btn" onClick={() => setAttachmentsOpen((open) => !open)}>
                {attachmentsOpen ? 'Hide attachments' : `Attachments (${track.attachments.length})`}
              </button>
            </div>
          )}
          {attachmentsOpen && track.attachments.length > 0 && (
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
                {track.history.slice(0, 20).map((event, index) => (
                  <li key={`${event.action}-${index}`} className="sm-meta">
                    {event.action}
                    {event.comment ? ` · ${event.comment}` : ''}
                    {event.occurredOn ? ` · ${event.occurredOn.replace('T', ' ').slice(0, 19)}` : ''}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
};

export default DocumentTrackCard;
