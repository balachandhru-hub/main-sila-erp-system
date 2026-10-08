import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import "./ApprovalProcessDiagram.css";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export interface ApprovalStep {
  id: string;
  title: string;
  description: string;
  role?: string;
}

interface ApprovalProcessDiagramProps {
  steps: ApprovalStep[];
  loading?: boolean;
  error?: string | null;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onEdit?: (index: number) => void;
  disabled?: boolean;
}

const InfoIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
);

const GripIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <circle cx="9" cy="6" r="1.8" />
    <circle cx="15" cy="6" r="1.8" />
    <circle cx="9" cy="12" r="1.8" />
    <circle cx="15" cy="12" r="1.8" />
    <circle cx="9" cy="18" r="1.8" />
    <circle cx="15" cy="18" r="1.8" />
  </svg>
);

const ApprovalProcessDiagram: React.FC<ApprovalProcessDiagramProps> = ({
  steps,
  loading,
  error,
  onReorder,
  disabled,
}) => {
  const [expanded, setExpanded] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const canReorder = !!onReorder && steps.length > 1;

  const [drag, setDrag] = useState<{ from: number; target: number; x: number; y: number } | null>(null);
  const nodeRefs = useRef<(HTMLDivElement | null)[]>([]);
  const autoScrollRef = useRef<number | null>(null);

  const stopAutoScroll = () => {
    if (autoScrollRef.current !== null) {
      cancelAnimationFrame(autoScrollRef.current);
      autoScrollRef.current = null;
    }
  };

  const findTargetIndex = (clientX: number, fallback: number) => {
    let best = fallback;
    let bestDistance = Number.POSITIVE_INFINITY;
    nodeRefs.current.forEach((node, index) => {
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const distance = Math.abs(clientX - (rect.left + rect.width / 2));
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  };

  const handleGripPointerDown = (e: React.PointerEvent<HTMLSpanElement>, index: number) => {
    if (disabled || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setDrag({ from: index, target: index, x: e.clientX, y: e.clientY });
  };

  const handleGripPointerMove = (e: React.PointerEvent<HTMLSpanElement>) => {
    if (!drag) return;
    const { clientX, clientY } = e;
    setDrag((prev) => (prev ? { ...prev, x: clientX, y: clientY, target: findTargetIndex(clientX, prev.target) } : prev));

    stopAutoScroll();
    const container = scrollRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const edge = 60;
    const speed = clientX < rect.left + edge ? -12 : clientX > rect.right - edge ? 12 : 0;
    if (speed === 0) return;
    const step = () => {
      container.scrollLeft += speed;
      setDrag((prev) => (prev ? { ...prev, target: findTargetIndex(clientX, prev.target) } : prev));
      autoScrollRef.current = requestAnimationFrame(step);
    };
    autoScrollRef.current = requestAnimationFrame(step);
  };

  const handleGripPointerUp = (e: React.PointerEvent<HTMLSpanElement>) => {
    stopAutoScroll();
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    if (drag && drag.target !== drag.from) onReorder?.(drag.from, drag.target);
    setDrag(null);
  };

  useEffect(() => stopAutoScroll, []);

  const ghostRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!drag || !ghostRef.current) return;
    ghostRef.current.style.setProperty("--apm-ghost-x", `${drag.x + 12}px`);
    ghostRef.current.style.setProperty("--apm-ghost-y", `${drag.y + 12}px`);
  }, [drag]);

  useEffect(() => {
    setSelectedId((prev) => (prev && steps.some((s) => s.id === prev) ? prev : steps[0]?.id ?? null));
  }, [steps]);

  const currentSteps = steps;
  const selectedStep = currentSteps.find((s) => s.id === selectedId) || null;

  const scrollBy = (dir: number) => {
    scrollRef.current?.scrollBy({ left: dir * 400, behavior: "smooth" });
  };

  return (
    <div className="apm-page">
      <section className="apm-card">
        <button
          type="button"
          className="apm-section-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
        >
          <span className={`apm-caret ${expanded ? "apm-caret-open" : ""}`} aria-hidden="true">
            <FaChevronRight />
          </span>
          <span className="apm-section-title">Approval Process Diagram</span>
          <span className="apm-info" title="Shows the order in which users approve this flow">
            <InfoIcon />
          </span>
        </button>

        {expanded && (
          <div className="apm-diagram">
            <div className="apm-flow" ref={scrollRef}>
              {loading ? (
                <div className="apm-empty">
                  <span className="sila-spinner" aria-hidden="true" />
                  Loading approvers...
                </div>
              ) : error ? (
                <div className="apm-empty apm-empty-error" role="alert">{error}</div>
              ) : currentSteps.length === 0 ? (
                <div className="apm-empty">No approvers in this approval flow.</div>
              ) : null}

              {!loading &&
                !error &&
                currentSteps.map((step, i) => {
                  const isDropTarget = !!drag && drag.target === i && drag.from !== i;
                  const dropClass = isDropTarget ? (drag!.from < i ? " apm-drop-right" : " apm-drop-left") : "";
                  return (
                    <React.Fragment key={step.id}>
                      <div
                        ref={(el) => {
                          nodeRefs.current[i] = el;
                        }}
                        className={`apm-node${selectedId === step.id ? " apm-node-selected" : ""}${drag?.from === i ? " apm-node-dragging" : ""
                          }${dropClass}`}
                        onClick={() => setSelectedId(step.id)}
                        role="button"
                        tabIndex={0}
                        aria-pressed={selectedId === step.id}
                        onKeyDown={(e) => e.key === "Enter" && setSelectedId(step.id)}
                      >
                        <div className="apm-node-head">
                          {canReorder && (
                            <span
                              className={`apm-node-grip${disabled ? " apm-node-grip-disabled" : ""}`}
                              title={disabled ? "Saving..." : "Drag to reorder"}
                              aria-label="Drag to reorder"
                              onClick={(e) => e.stopPropagation()}
                              onPointerDown={(e) => handleGripPointerDown(e, i)}
                              onPointerMove={handleGripPointerMove}
                              onPointerUp={handleGripPointerUp}
                              onPointerCancel={handleGripPointerUp}
                            >
                              <GripIcon />
                            </span>
                          )}
                          <span className="apm-node-title" title={step.title}>
                            {step.title}
                          </span>
                          <span className="apm-node-order" aria-label={`Step ${i + 1}`}>{i + 1}</span>
                        </div>
                        <div className="apm-node-body" title={step.description}>
                          {step.description}
                        </div>
                      </div>
                      {i < currentSteps.length - 1 && <span className="apm-connector" aria-hidden="true" />}
                    </React.Fragment>
                  );
                })}

            </div>

            <div className="apm-scrollbar">
              <button type="button" className="apm-scroll-btn" onClick={() => scrollBy(-1)} aria-label="Scroll left">
                <FaChevronLeft aria-hidden="true" />
              </button>
              <div className="apm-scroll-spacer" />
              <button type="button" className="apm-scroll-btn" onClick={() => scrollBy(1)} aria-label="Scroll right">
                <FaChevronRight aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </section>

      {drag && currentSteps[drag.from] && (
        <div className="apm-drag-ghost" ref={ghostRef} aria-hidden="true">
          <div className="apm-node-head">
            <span className="apm-node-title">{currentSteps[drag.from].title}</span>
            <span className="apm-node-order">{drag.target + 1}</span>
          </div>
          <div className="apm-node-body">{currentSteps[drag.from].description}</div>
        </div>
      )}

      {expanded && selectedStep && (
        <section className="apm-card apm-details">
          <h3 className="apm-details-title">{selectedStep.title}</h3>
          <div className="apm-details-grid">
            <div>
              <span className="apm-label">Approval Order</span>
              <span className="apm-value">
                {currentSteps.indexOf(selectedStep) + 1} of {currentSteps.length}
              </span>
            </div>
            <div className="apm-details-full">
              <span className="apm-label">Email</span>
              <span className="apm-value">{selectedStep.description}</span>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};

export default ApprovalProcessDiagram;
