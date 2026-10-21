import React, { useEffect, useState } from "react";
import { FaChevronUp, FaInfoCircle } from "react-icons/fa";
import type { SilaDocumentTrack as Track } from "../../../api/silaMe/silaReceivingApi";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";

interface SilaDocumentTrackProps {
  track?: Track | null;
  /** Optional navigation when a PO / GRN / Invoice node is clicked. */
  onOpen?: (kind: string, id: string) => void;
  /** Kept for callers. History is shown when Document track is expanded. */
  historyAsPanel?: boolean;
  /** When set, only these node kinds are shown (for example PO, GRN, ATTACHMENT). */
  kinds?: string[];
  /** Hide event history (workflow dump). */
  showHistory?: boolean;
  /** When true, attachments start open. */
  attachmentsOpenByDefault?: boolean;
  /**
   * When true (default), only the Document track heading and info control are shown
   * until the user expands. Opening another document remounts or resets to collapsed.
   */
  startCollapsed?: boolean;
  title?: string;
}

const KIND_ORDER = ["PO", "GRN", "INVOICE", "ATTACHMENT", "PAYMENT", "SOA"];

const dateFor = (track: Track, nodeId?: string | null): string | null => {
  if (!nodeId) return null;
  const event = (track.history ?? []).find((item) => item.referenceId === nodeId);
  const raw = event?.occurredOn;
  return raw ? raw.replace("T", " ").slice(0, 19) : null;
};

/** PO → GRN → Invoice → Attachment → Payment → SOA with history and attachments. */
const SilaDocumentTrackPanel: React.FC<SilaDocumentTrackProps> = ({
  track,
  onOpen,
  historyAsPanel = true,
  kinds,
  showHistory = true,
  attachmentsOpenByDefault = false,
  startCollapsed = true,
  title = "Document track",
}) => {
  const [open, setOpen] = useState(!startCollapsed);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [attachmentsOpen, setAttachmentsOpen] = useState(attachmentsOpenByDefault);

  useEffect(() => {
    setOpen(!startCollapsed);
    setHistoryOpen(true);
    setAttachmentsOpen(attachmentsOpenByDefault);
  }, [track?.rootId, startCollapsed, attachmentsOpenByDefault]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      if (next) setHistoryOpen(true);
      return next;
    });
  };

  if (!track || (track.nodes?.length ?? 0) === 0) return null;

  const allowed = kinds && kinds.length > 0 ? new Set(kinds) : null;
  const nodes = [...(track.nodes ?? [])]
    .filter((node) => !allowed || allowed.has(node.kind))
    .sort((a, b) => {
      const ai = KIND_ORDER.indexOf(a.kind);
      const bi = KIND_ORDER.indexOf(b.kind);
      return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
    });

  if (nodes.length === 0 && (track.attachments?.length ?? 0) === 0) return null;

  const bodyId = `srcv-track-body-${track.rootId}`;

  return (
    <section className="srcv-track" aria-labelledby="srcv-track-title">
      <div className="srcv-track-head">
        <button
          type="button"
          className="srcv-track-title-btn"
          aria-expanded={open}
          aria-controls={bodyId}
          onClick={toggleOpen}
        >
          <h3 id="srcv-track-title" className="sila-section-title">{title}</h3>
        </button>
        <button
          type="button"
          className="sila-icon-btn"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={open ? "Collapse document track" : "Show document track"}
          onClick={toggleOpen}
        >
          {open ? <FaChevronUp aria-hidden="true" /> : <FaInfoCircle aria-hidden="true" />}
        </button>
      </div>

      {open && (
        <div id={bodyId} className="srcv-track-body">
          <ol className="srcv-track-tree">
            {nodes.map((node, index) => {
              const clickable = Boolean(onOpen && node.id && (node.kind === "PO" || node.kind === "GRN" || node.kind === "INVOICE"));
              const occurredOn = dateFor(track, node.id);
              return (
                <li
                  key={`${node.kind}-${node.id ?? node.number ?? index}`}
                  className={node.current ? "srcv-track-tree-item srcv-track-tree-item--current" : "srcv-track-tree-item"}
                >
                  <button
                    type="button"
                    className="srcv-track-tree-btn"
                    disabled={!clickable}
                    onClick={() => {
                      if (clickable && node.id) onOpen?.(node.kind, node.id);
                    }}
                  >
                    <span className="srcv-track-kind">{node.label || node.kind}</span>
                    <strong>{node.number || "—"}</strong>
                    {node.status ? <span className={receivingBadgeClass(node.status)}>{receivingLabel(node.status)}</span> : null}
                    {occurredOn ? <span className="srcv-sub">{occurredOn}</span> : null}
                    {node.erpReference ? <span className="srcv-sub">ERP {node.erpReference}</span> : null}
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
                onClick={() => setAttachmentsOpen((current) => !current)}
              >
                {attachmentsOpen ? "Hide attachments" : `Attachments (${track.attachments.length})`}
              </button>
            )}
            {showHistory && (track.history?.length ?? 0) > 0 && (
              <button
                type="button"
                className="sila-btn sila-btn--secondary sila-btn--sm"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen((current) => !current)}
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

          {showHistory && historyOpen && (track.history?.length ?? 0) > 0 && (
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
        </div>
      )}
    </section>
  );
};

export default SilaDocumentTrackPanel;
