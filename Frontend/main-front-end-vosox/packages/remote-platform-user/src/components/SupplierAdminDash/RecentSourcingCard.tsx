import React from "react";
import type { RFQMasterDataItem } from "../../../../remote-supplier/src/api/supplierApi";
import { IconCalendar, IconPin } from "./icons";

interface RecentSourcingCardProps {
  rfqs: RFQMasterDataItem[];
  visibleRfqCount: number;
  loading: boolean;
  error: string | null;
  onViewAll: () => void;
  onOpenRfq: (rfqId: string) => void;
}

const RecentSourcingCard: React.FC<RecentSourcingCardProps> = ({
  rfqs,
  visibleRfqCount,
  loading,
  error,
  onViewAll,
  onOpenRfq,
}) => {
  return (
    <section className="pud-panel">
      <div className="pud-panel-header">
        <div>
          <div className="pud-panel-title">Recent Sourcing Opportunities</div>
          <div className="pud-panel-subtitle">Newly listed RFQs matched to your industry categories</div>
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
        <div className="pud-panel-list sad-panel-state">
          <div className="sad-state-inner">
            <div className="pud-spinner" aria-hidden="true" />
            <span>Loading sourcing opportunities...</span>
          </div>
        </div>
      ) : error ? (
        <div className="pud-panel-list sad-panel-state">
          <div className="sad-state-inner sad-state-error" role="alert">
            {error}
          </div>
        </div>
      ) : rfqs.length === 0 ? (
        <div className="pud-panel-list sad-panel-state">
          <div className="sad-state-inner">
            No recent sourcing opportunities found.
          </div>
        </div>
      ) : (
        <div className="pud-panel-list">
          {rfqs.slice(0, visibleRfqCount).map((rfq) => (
            <div
              className="pud-rfq-row sad-rfq-row"
              key={rfq.rfqId}
              role="button"
              tabIndex={0}
              onClick={() => onOpenRfq(rfq.rfqId)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpenRfq(rfq.rfqId);
              }}
            >
              <div className="pud-rfq-info">
                <div className="pud-rfq-meta">
                  <span className="pud-code-badge sila-ref">{rfq.rfqNumber}</span>
                  <span className="pud-dot-sep" aria-hidden="true">•</span>
                  <span className="pud-company">{rfq.organizationName}</span>
                </div>
                <div className="pud-rfq-title">{rfq.title}</div>
                <div className="pud-rfq-details">
                  <span>
                    <IconCalendar /> Closes: {new Date(rfq.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                  <span>
                    <IconPin /> Deliv: {rfq.deliveryLocation}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecentSourcingCard;
