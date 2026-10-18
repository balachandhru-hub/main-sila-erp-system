import React, { useState } from "react";
import type { SilaDocumentTrack as Track } from "../../../api/silaMe/silaReceivingApi";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";

interface SilaDocumentTrackProps {
  track?: Track | null;
  /** Optional navigation when a PO / GRN / Invoice node is clicked. */
  onOpen?: (kind: string, id: string) => void;
  /** When true, history starts collapsed and opens as a panel on click. */
  historyAsPanel?: boolean;
}

const KIND_ORDER = ["PO", "GRN", "INVOICE", "ATTACHMENT", "PAYMENT", "SOA"];

/** PO → GRN → Invoice → Attachment → Payment → SOA with history and attachments. */
const SilaDocumentTrackPanel: React.FC<SilaDocumentTrackProps> = ({ track, onOpen, historyAsPanel = true }) => {
  const [historyOpen, setHistoryOpen] = useState(!historyAsPanel);
  const [attachmentsOpen, setAttachmentsOpen] = useState(false);

  if (!track || (track.nodes?.length ?? 0) === 0) return null;

  const nodes = [...(track.nodes ?? [])].sort((a, b) => {
    const ai = KIND_ORDER.indexOf(a.kind);
    const bi = KIND_ORDER.indexOf(b.kind);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });

  return (
    <section className="srcv-track" aria-labelledby="srcv-track-title">
      <h3 id="srcv-track-title" className="sila-section-title">Document track</h3>
      <ol className="srcv-track-chain">
        {nodes.map((node, index) => {
          const clickable = Boolean(onOpen && node.id && (node.kind === "PO" || node.kind === "GRN" || node.kind === "INVOICE"));
          return (
            <li key={`${node.kind}-${node.id ?? node.number ?? index}`} className={node.current ? "srcv-track-node srcv-track-node--current" : "srcv-track-node"}>
              <button
                type="button"
                className="srcv-track-btn"
                disabled={!clickable}
                onClick={() => {
                  if (clickable && node.id) onOpen?.(node.kind, node.id);
                }}
              >
                <span className="srcv-track-kind">{node.label}</span>
                <strong>{node.number || "—"}</strong>
                {node.erpReference ? <span className="srcv-sub">ERP {node.erpReference}</span> : null}
                {node.status ? <span className={receivingBadgeClass(node.status)}>{receivingLabel(node.status)}</span> : null}
              </button>
            </li>
          );
        })}
      </ol>

      <div className="srcv-actions">
        {(track.attachments?.length ?? 0) > 0 && (
          <button
            type="button"
            className="sila-btn sila-btn--secondary sila-btn--sm"
            aria-expanded={attachmentsOpen}
            onClick={() => setAttachmentsOpen((open) => !open)}
          >
            {attachmentsOpen ? "Hide attachments" : `Attachments (${track.attachments.length})`}
          </button>
        )}
        {(track.history?.length ?? 0) > 0 && (
          <button
            type="button"
            className="sila-btn sila-btn--secondary sila-btn--sm"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            {historyOpen ? "Hide history" : `History (${track.history.length})`}
          </button>
        )}
      </div>

      {attachmentsOpen && (track.attachments?.length ?? 0) > 0 && (
        <div className="srcv-panel srcv-track-block" role="region" aria-label="Associated attachments">
          <h4 className="sila-section-title">Associated attachments</h4>
          <ul className="srcv-track-list">
            {track.attachments.map((file, index) => (
              <li key={`${file.documentType}-${file.fileName}-${index}`}>
                <span>{file.documentType}</span>
                <span> · {file.fileName}</span>
                {file.status ? <span> · {receivingLabel(file.status)}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}

      {historyOpen && (track.history?.length ?? 0) > 0 && (
        <div className="srcv-panel srcv-track-block" role="region" aria-label="Document history">
          <h4 className="sila-section-title">History</h4>
          <ol className="srcv-track-list">
            {track.history.map((event, index) => (
              <li key={`${event.action}-${event.occurredOn}-${index}`}>
                <span className="sila-cell-strong">{event.action}</span>
                {event.comment ? <span> · {event.comment}</span> : null}
                <span className="srcv-sub"> · {event.occurredOn?.replace("T", " ").slice(0, 19)}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
};

export default SilaDocumentTrackPanel;
