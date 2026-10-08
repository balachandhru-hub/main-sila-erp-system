import React from "react";
import { EmptyState, Loader } from "@vosox/shared-ui";
import type { RFQMasterDataItem } from "../../api/supplierApi";
import { IconChevronRight, IconCalendar, IconPin } from "./icons";
import { formatShortDate, onActivateKey } from "./utils";

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
    <section className="sila-card pud-dash-card">
      <div className="sila-card-header">
        <div>
          <h2 className="sila-card-title">Recent Sourcing Opportunities</h2>
          <p className="sila-card-subtitle">Newly listed RFQs matched to your industry categories</p>
        </div>
        {!loading && !error && rfqs.length > 0 && (
          <button
            type="button"
            className="sila-btn sila-btn--ghost sila-btn--sm pud-card-link"
            onClick={onViewAll}
          >
            View all RFQs <IconChevronRight />
          </button>
        )}
      </div>
      {loading ? (
        <Loader size={24} message="Loading sourcing opportunities..." />
      ) : error ? (
        <EmptyState variant="error" title="Couldn't load sourcing opportunities" description={error} />
      ) : rfqs.length === 0 ? (
        <EmptyState
          title="No matching RFQs right now"
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          }
        />
      ) : (
        <ul className="pud-panel-list pud-dash-list">
          {rfqs.slice(0, visibleRfqCount).map((rfq) => (
            <li key={rfq.rfqId}>
              <div
                className="pud-rfq-card-item"
                onClick={() => onOpenRfq(rfq.rfqId)}
                onKeyDown={(e) => onActivateKey(e, () => onOpenRfq(rfq.rfqId))}
                role="button"
                tabIndex={0}
              >
                <div className="pud-rfq-meta">
                  <span className="sila-ref">{rfq.rfqNumber}</span>
                  <span className="pud-dot-sep" aria-hidden="true">·</span>
                  <span className="pud-company">{rfq.organizationName}</span>
                </div>
                <div className="pud-rfq-title pud-rfq-link-title">{rfq.title}</div>
                <div className="pud-rfq-details">
                  <span>
                    <IconCalendar /> Closes: {formatShortDate(rfq.endDate) ?? 'Open'}
                  </span>
                  <span>
                    <IconPin /> Deliv: {rfq.deliveryLocation}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default RecentSourcingCard;
