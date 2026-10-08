import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import { dismissSubstitution, getSubstitution, type SilaSubstitutionDetail } from "../../../api/silaMe/silaSubstitutionApi";
import { formatDateTime } from "../../cart/lineFormat";
import { formatCost, formatQty } from "../recipes/recipeFormat";
import SilaSubstitutionReview from "./SilaSubstitutionReview";
import { substitutionBadgeClass, substitutionLabel } from "./substitutionFormat";

interface SilaSubstitutionDetailViewProps {
  proposalId: string;
  canDecide: boolean;
  onBack: () => void;
  /** Called after accept or dismiss so the list refreshes. */
  onChanged: () => void;
}

const MAX_REASON = 500;

/** One suggestion: "System suggests replacing X with Y in recipe Z — Yes / No", then the review on yes. */
const SilaSubstitutionDetailView: React.FC<SilaSubstitutionDetailViewProps> = ({ proposalId, canDecide, onBack, onChanged }) => {
  const [detail, setDetail] = useState<SilaSubstitutionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await getSubstitution(proposalId));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load the suggestion.");
    } finally {
      setLoading(false);
    }
  }, [proposalId]);

  useEffect(() => {
    load();
  }, [load]);

  const dismiss = async () => {
    setSaving(true);
    try {
      await dismissSubstitution(proposalId, reason);
      toastService.success("Suggestion dismissed.");
      setDismissOpen(false);
      onChanged();
      onBack();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not dismiss the suggestion.");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !detail) {
    return <Loader size={24} message="Loading suggestion..." />;
  }

  if (error || !detail) {
    return (
      <div className="ssub-page">
        <PageHeader className="pud-page-header" title="Recipe change suggestion" onBack={onBack} backLabel="Back" />
        <EmptyState
          variant="error"
          title="Couldn't load the suggestion"
          description={error ?? undefined}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      </div>
    );
  }

  const { proposal } = detail;
  const open = proposal.status === "PROPOSED";
  const best = detail.suggestions.find((x) => x.replacesMaterialId === proposal.ingredientMaterialId && x.isRecommended);
  const suggestedName = best?.description ?? proposal.suggestedName;

  if (reviewing && open && canDecide) {
    return (
      <SilaSubstitutionReview
        detail={detail}
        onCancel={() => setReviewing(false)}
        onDone={() => {
          onChanged();
          onBack();
        }}
      />
    );
  }

  return (
    <div className="ssub-page">
      <PageHeader
        className="pud-page-header"
        title={`${proposal.proposalNumber} ${detail.recipeCode} ${detail.recipeName}`}
        onBack={onBack}
        backLabel="Back"
        meta={<span className={substitutionBadgeClass(proposal.status)}>{substitutionLabel(proposal.status)}</span>}
      />

      <section className="sila-card">
        <div className="ssub-prompt">
          <p className="ssub-prompt-question">
            {open
              ? `The system suggests replacing ${proposal.ingredientName} with ${suggestedName} in ${detail.recipeName}.`
              : `${proposal.ingredientName} in ${detail.recipeName}: ${substitutionLabel(proposal.status).toLowerCase()}${proposal.decidedOn ? ` on ${formatDateTime(proposal.decidedOn)}` : ""}.`}
          </p>
          <p className="ssub-prompt-reason">{proposal.reason}</p>
          {proposal.createdVersion ? (
            <p className="ssub-prompt-reason">Version {proposal.createdVersion} of the recipe was sent for approval.</p>
          ) : null}
          {open && detail.hasPendingVersion && (
            <div className="sila-alert sila-alert--warning" role="status">
              Version {detail.latestVersion} of this recipe is already {detail.recipeStatus === "DRAFT" ? "being edited" : "waiting for approval"}.
              Finish it in Recipes first, then review this suggestion again.
            </div>
          )}
          {open && !best && (
            <div className="sila-alert sila-alert--warning" role="status">
              No material of the same group is in stock in this property right now.
            </div>
          )}
          {open && canDecide && (
            <div className="ssub-actions">
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setDismissOpen(true)} disabled={saving}>
                No
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--primary"
                onClick={() => setReviewing(true)}
                disabled={detail.hasPendingVersion || detail.suggestions.length === 0}
              >
                Yes, review the change
              </button>
            </div>
          )}
        </div>
      </section>

      <section className="sila-card">
        <div className="sila-card-header">
          <h2 className="sila-card-title">Approved version {detail.activeVersion}</h2>
        </div>
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Ingredient</th>
                <th scope="col" className="ssub-num">Quantity</th>
                <th scope="col" className="ssub-num">Cost</th>
                <th scope="col" className="ssub-num">In stock ({detail.propertyName || "property"})</th>
              </tr>
            </thead>
            <tbody>
              {detail.ingredients.map((item) => (
                <tr key={`${item.sequence}-${item.itemCode}`}>
                  <td>
                    {item.itemName} {item.isShort && <span className="sila-badge sila-badge--danger">Short</span>}
                    <span className="ssub-sub">{item.itemCode}</span>
                  </td>
                  <td className="ssub-num">{formatQty(item.quantity)} {item.uom}</td>
                  <td className="ssub-num">{formatCost(item.cost, detail.currency)}</td>
                  <td className="ssub-num">
                    {item.propertyAvailableQty == null ? "—" : `${formatQty(item.propertyAvailableQty)} ${item.baseUom}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        isOpen={dismissOpen}
        onClose={() => setDismissOpen(false)}
        headerProps={{ heading: "Keep the recipe as it is" }}
        footerProps={{
          secondaryButton: { text: "Cancel", onClick: () => setDismissOpen(false), disabled: saving },
          primaryButton: { text: "Dismiss suggestion", loading: saving, disabled: !reason.trim(), onClick: dismiss },
        }}
      >
        <div className="sila-field">
          <label className="sila-label" htmlFor="ssub-dismiss-reason">Why is the suggestion not used?</label>
          <textarea
            id="ssub-dismiss-reason"
            className="sila-textarea"
            rows={3}
            maxLength={MAX_REASON}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};

export default SilaSubstitutionDetailView;
