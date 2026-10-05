import React from "react";
import { EmptyState, Loader, CalendarIcon, FileTextIcon, MapPinIcon } from "@vosox/shared-ui";

interface RecentRfqsPanelProps {
  rfqs: any[];
  visibleCount: number;
  loading: boolean;
  error: string | null;
  onOpenRfq: (rfqId: string) => void;
  onViewAll: () => void;
}

/** Dashboard panel listing the buyer's most recent RFQs. */
const RecentRfqsPanel: React.FC<RecentRfqsPanelProps> = ({
  rfqs,
  visibleCount,
  loading,
  error,
  onOpenRfq,
  onViewAll,
}) => (
  <section className="pud-panel">
    <div className="pud-panel-header">
      <div>
        <h2 className="pud-panel-title">Recent RFQs</h2>
        <div className="pud-panel-subtitle">RFQs you've posted, awaiting supplier quotations</div>
      </div>
      {!loading && !error && rfqs.length > 0 && (
        <a
          className="pud-panel-link"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            onViewAll();
          }}
        >
          View All RFQs →
        </a>
      )}
    </div>
    {loading ? (
      <div className="pud-panel-list pud-panel-state">
        <Loader size={24} message="Loading sourcing opportunities..." />
      </div>
    ) : error ? (
      <div className="pud-panel-list pud-panel-state">
        <EmptyState variant="error" title="Unable to load RFQs" description={error} />
      </div>
    ) : rfqs.length === 0 ? (
      <div className="pud-panel-list pud-panel-state">
        <EmptyState title="No RFQs found." icon={<FileTextIcon size={20} />} />
      </div>
    ) : (
      <div className="pud-panel-list">
        {rfqs.slice(0, visibleCount).map((rfq) => (
          <div
            className="pud-rfq-card-item"
            key={rfq.rfqId}
            onClick={() => onOpenRfq(rfq.rfqId)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenRfq(rfq.rfqId);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="pud-rfq-meta">
              <span className="pud-code-badge sila-ref">{rfq.rfqNumber}</span>
              <span className="pud-dot-sep" aria-hidden="true">•</span>
              <span className="pud-company">{rfq.organizationName}</span>
            </div>

            <div className="pud-rfq-title pud-rfq-link-title">{rfq.title}</div>

            <div className="pud-rfq-details">
              <span>
                <CalendarIcon /> Closes: {rfq.endDate ? new Date(rfq.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open'}
              </span>
              <span>
                <MapPinIcon /> Deliv: {rfq.deliveryLocation}
              </span>
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default RecentRfqsPanel;
