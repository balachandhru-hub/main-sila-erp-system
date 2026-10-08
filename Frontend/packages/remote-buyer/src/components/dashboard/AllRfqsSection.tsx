import React from "react";
import { ArrowLeftIcon, FileTextIcon, Table, buildAllRfqsColumns, type AllRfqRow } from "@vosox/shared-ui";
import { RFQ_PAGE_SIZE } from "../../constants";

interface AllRfqsSectionProps {
  rfqs: AllRfqRow[];
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

    <Table<AllRfqRow>
      columns={buildAllRfqsColumns<AllRfqRow>((page - 1) * RFQ_PAGE_SIZE)}
      data={rfqs}
      getRowId={(rfq, idx) => rfq.rfqId || String(idx)}
      loading={loading || !loaded}
      loadingLabel="Loading all sourcing opportunities…"
      error={error && rfqs.length === 0 ? "Unable to load RFQs" : undefined}
      errorDescription={error && rfqs.length === 0 ? error : undefined}
      emptyState={{ title: "No RFQs found.", icon: <FileTextIcon size={20} /> }}
      onRowClick={(rfq) => rfq.rfqId && onOpenRfq(rfq.rfqId)}
      bordered
      className="pud-allrfqs-table"
      pagination={
        rfqs.length > 0
          ? {
              page,
              hasNext: hasMore,
              onPrevious: onPrevPage,
              onNext: onNextPage,
              disabled: loading,
              summary: `Showing ${(page - 1) * RFQ_PAGE_SIZE + 1}–${(page - 1) * RFQ_PAGE_SIZE + rfqs.length}`,
            }
          : undefined
      }
    />
  </section>
);

export default AllRfqsSection;
