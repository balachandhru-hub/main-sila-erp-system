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
    <section className="sad-panel">
      <div className="sad-panel-header">
        <div>
          <div className="sad-panel-title">Recent Sourcing Opportunities</div>
          <div className="sad-panel-subtitle">Newly listed RFQs matched to your industry categories</div>
        </div>
        {!loading && !error && rfqs.length > 0 && (
          <a
            className="sad-panel-link"
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
        <div className="sad-panel-list sad-panel-state">
          <div className="sad-state-inner">
            <div className="pud-spinner" aria-hidden="true" />
            <span>Loading sourcing opportunities...</span>
          </div>
        </div>
      ) : error ? (
        <div className="sad-panel-list sad-panel-state">
          <div className="sad-state-inner sad-state-error" role="alert">
            {error}
          </div>
        </div>
      ) : rfqs.length === 0 ? (
        <div className="sad-panel-list sad-panel-state">
          <div className="sad-state-inner">
            No recent sourcing opportunities found.
          </div>
        </div>
      ) : (
        <div className="sad-panel-list">
          {rfqs.slice(0, visibleRfqCount).map((rfq) => (
            <div
              className="sad-rfq-card-item"
              key={rfq.rfqId}
              role="button"
              tabIndex={0}
              onClick={() => onOpenRfq(rfq.rfqId)}
              onKeyDown={(e) => {
                if (e.key === "Enter") onOpenRfq(rfq.rfqId);
              }}
            >
              <div className="sad-rfq-meta">
                <span className="sila-ref">{rfq.rfqNumber}</span>
                <span className="sad-dot-sep" aria-hidden="true">•</span>
                <span className="sad-company">{rfq.organizationName}</span>
              </div>
              <div className="sad-rfq-title">{rfq.title}</div>
              <div className="sad-rfq-details">
                <span>
                  <IconCalendar /> Closes: {new Date(rfq.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <span>
                  <IconPin /> Deliv: {rfq.deliveryLocation}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

export default RecentSourcingCard;
