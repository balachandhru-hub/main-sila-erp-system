import React, { useState } from "react";
import { Modal, PageHeader, toastService } from "@vosox/shared-ui";
import {
  acceptSubstitution,
  type SilaSubstitutionDetail,
  type SilaSubstitutionIngredient,
  type SilaSubstitutionSuggestion,
} from "../../../api/silaMe/silaSubstitutionApi";
import { formatCost, formatQty } from "../recipes/recipeFormat";
import SubstitutionPreview from "./SubstitutionPreview";

interface SilaSubstitutionReviewProps {
  detail: SilaSubstitutionDetail;
  onCancel: () => void;
  /** Called after the changed recipe was sent for approval. */
  onDone: () => void;
}

/**
 * Review and submit: suggestions on the left, the approved ingredients on the right. Drag a suggestion onto the ingredient
 * it replaces, or select the ingredient and press "Use this" (keyboard / touch). Quantity and unit come from the replaced
 * ingredient (converted by the server); submitting creates the next version and sends it for approval.
 */
const SilaSubstitutionReview: React.FC<SilaSubstitutionReviewProps> = ({ detail, onCancel, onDone }) => {
  const [chosen, setChosen] = useState<Record<string, SilaSubstitutionSuggestion>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<SilaSubstitutionSuggestion | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const shortId = detail.proposal.ingredientMaterialId;
  const nameOf = (materialId: string) => detail.ingredients.find((x) => x.materialId === materialId)?.itemName ?? "the ingredient";
  const usedIds = new Set(Object.values(chosen).map((x) => x.materialId));
  const targets = new Set(detail.suggestions.map((x) => x.replacesMaterialId));

  const assign = (suggestion: SilaSubstitutionSuggestion, ingredient: SilaSubstitutionIngredient) => {
    if (ingredient.materialId !== suggestion.replacesMaterialId) {
      toastService.info(`${suggestion.description} can only replace ${nameOf(suggestion.replacesMaterialId)}.`);
      return;
    }
    setChosen((prev) => ({ ...prev, [suggestion.replacesMaterialId]: suggestion }));
    setSelected(null);
    setAnnouncement(`${ingredient.itemName} replaced with ${suggestion.description}, ${formatQty(suggestion.quantity)} ${suggestion.uom}.`);
  };

  const undo = (ingredient: SilaSubstitutionIngredient) => {
    if (!ingredient.materialId) return;
    const materialId = ingredient.materialId;
    setChosen((prev) => {
      const next = { ...prev };
      delete next[materialId];
      return next;
    });
    setAnnouncement(`${ingredient.itemName} restored.`);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const result = await acceptSubstitution(
        detail.proposal.id,
        Object.entries(chosen).map(([ingredientMaterialId, item]) => ({ ingredientMaterialId, substituteMaterialId: item.materialId })),
      );
      toastService.success(`Version ${result.version} of ${result.recipeCode} sent for approval.`);
      setConfirmOpen(false);
      onDone();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not send the changed recipe for approval.");
    } finally {
      setSaving(false);
    }
  };

  const ready = Boolean(chosen[shortId]);

  return (
    <div className="ssub-page">
      <PageHeader className="pud-page-header" title={`Review ${detail.recipeCode} ${detail.recipeName}`} onBack={onCancel} backLabel="Back" />
      <p className="sila-visually-hidden" aria-live="polite">{announcement}</p>

      <div className="ssub-review">
        <section className="sila-card ssub-column" aria-label="Suggestions">
          <h2 className="ssub-column-title">Suggestions in stock</h2>
          {detail.suggestions.map((item) => {
            const used = usedIds.has(item.materialId);
            const dim = selected !== null && selected !== item.replacesMaterialId;
            return (
              <div
                key={`${item.replacesMaterialId}-${item.materialId}`}
                className={`ssub-suggestion${used ? " ssub-suggestion--used" : ""}${dim ? " ssub-suggestion--dim" : ""}`}
                draggable={!used && !saving}
                onDragStart={(e) => {
                  e.dataTransfer.setData("text/plain", item.materialId);
                  e.dataTransfer.effectAllowed = "move";
                  setDragging(item);
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setOverId(null);
                }}
              >
                <div className="ssub-suggestion-head">
                  <span className="sila-cell-strong">{item.description}</span>
                  {item.isRecommended && <span className="sila-badge sila-badge--success">Best match</span>}
                </div>
                <span className="ssub-sub">
                  {item.materialCode} · replaces {nameOf(item.replacesMaterialId)} · {formatQty(item.propertyAvailableQty)} {item.baseUom} in stock
                </span>
                <span className="ssub-sub">
                  {formatQty(item.quantity)} {item.uom} · line cost {formatCost(item.lineCost, item.currency)} (
                  <span className={item.costDelta > 0 ? "ssub-delta-up" : "ssub-delta-down"}>
                    {item.costDelta > 0 ? "+" : ""}
                    {formatCost(item.costDelta)}
                  </span>
                  )
                </span>
                <div className="ssub-actions">
                  <button
                    type="button"
                    className="sila-btn sila-btn--secondary sila-btn--sm"
                    disabled={used || saving}
                    aria-label={`Use ${item.description} for ${nameOf(item.replacesMaterialId)}`}
                    onClick={() => {
                      const ingredient = detail.ingredients.find((x) => x.materialId === item.replacesMaterialId);
                      if (ingredient) assign(item, ingredient);
                    }}
                  >
                    {used ? "Used" : "Use this"}
                  </button>
                </div>
              </div>
            );
          })}
        </section>

        <section className="sila-card ssub-column" aria-label="Recipe ingredients">
          <h2 className="ssub-column-title">Ingredients of version {detail.activeVersion}</h2>
          {detail.ingredients.map((item) => {
            const replacement = item.materialId ? chosen[item.materialId] : undefined;
            const isTarget = Boolean(item.materialId && targets.has(item.materialId));
            const classes = [
              "ssub-ingredient",
              item.isShort && !replacement ? "ssub-ingredient--short" : "",
              replacement ? "ssub-ingredient--replaced" : "",
              overId === item.materialId || (selected !== null && selected === item.materialId) ? "ssub-ingredient--target" : "",
            ].filter(Boolean).join(" ");
            return (
              <div
                key={`${item.sequence}-${item.itemCode}`}
                className={classes}
                onDragOver={(e) => {
                  if (dragging && item.materialId) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = dragging.replacesMaterialId === item.materialId ? "move" : "none";
                    setOverId(item.materialId);
                  }
                }}
                onDragLeave={() => setOverId(null)}
                onDrop={(e) => {
                  e.preventDefault();
                  setOverId(null);
                  if (dragging) assign(dragging, item);
                  setDragging(null);
                }}
              >
                <div className="ssub-ingredient-main">
                  <span className={replacement ? "ssub-old" : "sila-cell-strong"}>
                    {item.itemName} · {formatQty(item.quantity)} {item.uom}
                  </span>
                  {replacement && (
                    <span className="ssub-new">
                      → {replacement.description} · {formatQty(replacement.quantity)} {replacement.uom}
                    </span>
                  )}
                  <span className="ssub-sub">
                    {item.itemCode} · {formatCost(replacement ? replacement.lineCost : item.cost, detail.currency)}
                    {item.propertyAvailableQty != null ? ` · ${formatQty(item.propertyAvailableQty)} ${item.baseUom} in stock` : ""}
                  </span>
                </div>
                <span className="ssub-actions">
                  {item.isShort && !replacement && <span className="sila-badge sila-badge--danger">Short</span>}
                  {replacement ? (
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => undo(item)} disabled={saving}>
                      Undo
                    </button>
                  ) : isTarget ? (
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary sila-btn--sm"
                      aria-pressed={selected === item.materialId}
                      onClick={() => setSelected(selected === item.materialId ? null : item.materialId ?? null)}
                    >
                      {selected === item.materialId ? "Selected" : "Select"}
                    </button>
                  ) : null}
                </span>
              </div>
            );
          })}
        </section>
      </div>

      <SubstitutionPreview detail={detail} chosen={chosen} />

      <section className="sila-card ssub-footer">
        <span className="ssub-sub">
          {ready
            ? `Version ${detail.latestVersion + 1} will be sent for approval. Version ${detail.activeVersion} keeps selling until it is approved.`
            : `Drag a suggestion onto ${nameOf(shortId)}, or select it and press "Use this".`}
        </span>
        <span className="ssub-actions">
          <button type="button" className="sila-btn sila-btn--secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="sila-btn sila-btn--primary" disabled={!ready || saving} onClick={() => setConfirmOpen(true)}>
            Review &amp; submit
          </button>
        </span>
      </section>

      <Modal
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        headerProps={{ heading: `Send ${detail.recipeCode} for approval` }}
        footerProps={{
          secondaryButton: { text: "Back", onClick: () => setConfirmOpen(false), disabled: saving },
          primaryButton: { text: "Send for approval", loading: saving, onClick: submit },
        }}
      >
        <ul className="ssub-change-list">
          {Object.entries(chosen).map(([materialId, item]) => (
            <li key={materialId}>
              {nameOf(materialId)} → {item.description} ({formatQty(item.quantity)} {item.uom})
            </li>
          ))}
        </ul>
      </Modal>
    </div>
  );
};

export default SilaSubstitutionReview;
