import React from "react";
import { CloseIcon, FileTextIcon, MapPinIcon, SparklesIcon } from "@vosox/shared-ui";
import QuotationComparisonCard from "../../../../remote-platform-user/src/components/QuotationComparisonCard.tsx";

interface QuotationComparisonViewProps {
  rfq: any | null;
  onClose: () => void;
}

/** Full-page bid comparison for one RFQ. */
const QuotationComparisonView: React.FC<QuotationComparisonViewProps> = ({ rfq, onClose }) => (
  <>
    <div className="pud-modal pud-rfq-fullpage">
      <div className="pud-modal-header">
        <span className="pud-modal-badge">
          <SparklesIcon /> Bid Comparison
        </span>
        <button
          type="button"
          className="pud-modal-close"
          onClick={onClose}
          aria-label="Close bid comparison"
        >
          <CloseIcon />
        </button>
        <h2 className="pud-modal-name">
          {rfq?.title || "RFQ Quotations"}
        </h2>
        {rfq && (
          <div className="pud-modal-meta">
            <span><FileTextIcon size={20} /> <span className="sila-ref">{rfq.rfqNumber}</span></span>
            <span><MapPinIcon /> {rfq.deliveryLocation}</span>
          </div>
        )}
      </div>

      <div className="pud-modal-body pud-comparison-body">
        <QuotationComparisonCard
          rfqId={rfq?.rfqId}
          rfqTitle={rfq?.title}
        />
      </div>
    </div>
  </>
);

export default QuotationComparisonView;
