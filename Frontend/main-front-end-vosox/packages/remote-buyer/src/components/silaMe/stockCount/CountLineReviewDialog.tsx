import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { reviewCountLine, type SilaLineDecision } from "../../../api/silaMe/silaControlApi";
import type { SilaStockCountItem } from "../../../api/silaMe/silaStockCountApi";
import { formatMoney, formatQty, formatVariance, scBadgeClass, scLabel } from "./stockCountFormat";

interface CountLineReviewDialogProps {
  stockCountId: string;
  item: SilaStockCountItem;
  onClose: () => void;
  /** Called after the decision is saved so the sheet reloads. */
  onSaved: () => void;
}

const DECISIONS: { value: SilaLineDecision; label: string; help: string }[] = [
  { value: "ACCEPT", label: "Accept", help: "The variance is posted when the count is approved." },
  { value: "RECOUNT", label: "Recount", help: "The count reopens and the counter counts this line again." },
  { value: "MORE_INFORMATION", label: "More information", help: "The location must answer the shortage enquiry again." },
  { value: "REJECT", label: "Reject", help: "The variance of this line is not posted." },
];

const MAX_COMMENT = 1000;

/** Cost controller decision on one line of a submitted count. */
const CountLineReviewDialog: React.FC<CountLineReviewDialogProps> = ({ stockCountId, item, onClose, onSaved }) => {
  const [decision, setDecision] = useState<SilaLineDecision>("ACCEPT");
  const [comment, setComment] = useState(item.reviewComment ?? "");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const canAskMore = Boolean(item.enquiryId);
  const needsComment = decision !== "ACCEPT";

  const save = async () => {
    if (needsComment && !comment.trim()) {
      setFormError("Add a comment for the location.");
      return;
    }
    if (comment.trim().length > MAX_COMMENT) {
      setFormError(`Keep the comment within ${MAX_COMMENT} characters.`);
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await reviewCountLine(stockCountId, item.id, decision, comment);
      toastService.success(decision === "RECOUNT" ? "Line sent back for recount. The count is open again." : "Review saved.");
      onSaved();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not save the review.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      variant={decision === "REJECT" ? "danger" : "default"}
      headerProps={{ heading: `Review ${item.materialName}` }}
      footerProps={{
        secondaryButton: { text: "Back", onClick: onClose, disabled: saving },
        primaryButton: { text: "Save review", onClick: save, loading: saving },
      }}
    >
      <div className="sila-root sila-me sc-stack">
        <dl className="sila-meta-grid">
          <div className="sila-meta-item">
            <dt className="sila-meta-label">System / counted</dt>
            <dd className="sila-meta-value">{formatQty(item.systemQty)} / {formatQty(item.countedQty)} {item.baseUom}</dd>
          </div>
          <div className="sila-meta-item">
            <dt className="sila-meta-label">Variance</dt>
            <dd className="sila-meta-value">{formatVariance(item.varianceQty)} ({formatMoney(item.varianceValue)})</dd>
          </div>
          <div className="sila-meta-item">
            <dt className="sila-meta-label">Line</dt>
            <dd className="sila-meta-value"><span className={scBadgeClass(item.status)}>{scLabel(item.status)}</span></dd>
          </div>
          {item.enquiryNumber && (
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Enquiry</dt>
              <dd className="sila-meta-value">
                {item.enquiryNumber} <span className={scBadgeClass(item.enquiryStatus)}>{scLabel(item.enquiryStatus)}</span>
              </dd>
            </div>
          )}
        </dl>

        <fieldset className="sctl-choices">
          <legend className="sila-label">Decision</legend>
          {DECISIONS.map((option) => {
            const disabled = option.value === "MORE_INFORMATION" && !canAskMore;
            return (
              <label key={option.value} className="sila-choice">
                <input
                  type="radio"
                  name="sctl-decision"
                  value={option.value}
                  checked={decision === option.value}
                  disabled={disabled || saving}
                  onChange={() => setDecision(option.value)}
                />
                <span>
                  <span className="sila-cell-strong">{option.label}</span>
                  <span className="sc-sub">{disabled ? "Only for shortage lines with an enquiry." : option.help}</span>
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="sila-field">
          <label className="sila-label" htmlFor="sctl-review-comment">
            Comment{needsComment && <span className="sila-required">*</span>}
          </label>
          <textarea
            id="sctl-review-comment"
            className="sila-textarea"
            rows={3}
            maxLength={MAX_COMMENT}
            value={comment}
            onChange={(event) => setComment(event.target.value)}
          />
        </div>

        {formError && <div className="sila-alert sila-alert--danger" role="alert">{formError}</div>}
      </div>
    </Modal>
  );
};

export default CountLineReviewDialog;
