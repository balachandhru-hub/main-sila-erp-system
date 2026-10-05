import React from "react";
import { EmptyState, Loader, ArrowLeftIcon, ChevronLeftIcon, ChevronRightIcon, FileTextIcon } from "@vosox/shared-ui";
import { RFQ_PAGE_SIZE } from "../../constants";

interface AllRfqsSectionProps {
  rfqs: any[];
  page: number;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  hasMore: boolean;
  onBack: () => void;
  onOpenRfq: (rfqId: string) => void;
  onPrevPage: () => void;
  onNextPage: () => void;
}

/** Paged table of every RFQ the buyer has posted. */
const AllRfqsSection: React.FC<AllRfqsSectionProps> = ({
  rfqs,
  page,
  loading,
  loaded,
  error,
  hasMore,
  onBack,
  onOpenRfq,
  onPrevPage,
  onNextPage,
}) => (
  <section className="pud-allrfqs-card" aria-labelledby="pud-allrfqs-title">
    <div className="pud-allrfqs-header">
      <button
        type="button"
        className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
        onClick={onBack}
        title="Back to Dashboard"
        aria-label="Back to Dashboard"
      >
        <ArrowLeftIcon />
      </button>
      <div>
        <h1 className="pud-title" id="pud-allrfqs-title">All RFQs</h1>
        <p className="pud-subtitle">
          Complete list of RFQs you've posted, awaiting supplier quotations.
        </p>
      </div>
    </div>

    {loading || !loaded ? (
      <div className="pud-allrfqs-state">
        <Loader size={24} message="Loading all sourcing opportunities..." />
      </div>
    ) : error && rfqs.length === 0 ? (
      <EmptyState variant="error" title="Unable to load RFQs" description={error} />
    ) : rfqs.length === 0 ? (
      <EmptyState title="No RFQs found." icon={<FileTextIcon size={20} />} />
    ) : (
      <div>
        <div className="pud-rfq-table-container">
          <table className="pud-rfq-items-table pud-allrfqs-table">
            <thead>
              <tr>
                <th className="pud-allrfqs-sno sila-num">S.No</th>
                <th>RFQ Number</th>
                <th>Title</th>
                <th>Organization</th>
                <th>Delivery Location</th>
                <th>Closing Date</th>
              </tr>
            </thead>
            <tbody>
              {rfqs.map((rfq: any, idx: number) => (
                <tr
                  key={rfq.rfqId || idx}
                  onClick={() => onOpenRfq(rfq.rfqId)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onOpenRfq(rfq.rfqId);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open RFQ ${rfq.rfqNumber ?? ""}`}
                >
                  <td className="sila-num sila-cell-muted">{(page - 1) * RFQ_PAGE_SIZE + idx + 1}</td>
                  <td><span className="sila-ref">{rfq.rfqNumber}</span></td>
                  <td className="sila-cell-strong">{rfq.title}</td>
                  <td>{rfq.organizationName}</td>
                  <td>{rfq.deliveryLocation}</td>
                  <td className="sila-cell-muted">
                    {rfq.endDate
                      ? new Date(rfq.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                      : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <nav className="budp-pagination budp-allrfqs-pagination" aria-label="RFQ list pagination">
          <span>
            Showing {(page - 1) * RFQ_PAGE_SIZE + 1}–{(page - 1) * RFQ_PAGE_SIZE + rfqs.length}
          </span>
          <div className="budp-pagination-pages">
            <button
              type="button"
              className={`budp-page-btn${page === 1 || loading ? " budp-page-btn-disabled" : ""}`}
              onClick={onPrevPage}
              disabled={page <= 1 || loading}
              aria-label="Previous RFQ page"
            >
              <ChevronLeftIcon />
            </button>

            <span className="budp-page-number" aria-current="page">Page {page}</span>

            <button
              type="button"
              className={`budp-page-btn${!hasMore || loading ? " budp-page-btn-disabled" : ""}`}
              onClick={onNextPage}
              disabled={!hasMore || loading}
              aria-label="Next RFQ page"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </nav>
      </div>
    )}
  </section>
);

export default AllRfqsSection;
