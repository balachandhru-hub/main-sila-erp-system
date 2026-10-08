import React, { useState } from 'react';
import {
  acceptSubstitution,
  previewSubstitution,
  type SilaSubstitutionAcceptResult,
  type SilaSubstitutionDetail,
  type SilaSubstitutionIngredient,
  type SilaSubstitutionSuggestion,
} from '../../../../remote-buyer/src/api/silaMe/silaSubstitutionApi';
import { formatQty } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import { Notice, type NoticeMessage } from '../../components/StateViews';
import { formatMoney } from '../../format';
import { errorText } from '../../useLoad';

interface SubstitutionReviewPanelProps {
  detail: SilaSubstitutionDetail;
  onCancel: () => void;
  onDone: (result: SilaSubstitutionAcceptResult) => void;
}

/** The ingredient material id under the pointer (rows carry data-ingredient). */
const ingredientAt = (x: number, y: number): string | null => {
  const element = document.elementFromPoint(x, y);
  const row = element instanceof HTMLElement ? element.closest<HTMLElement>('[data-ingredient]') : null;
  return row?.dataset.ingredient ?? null;
};

/**
 * Review and submit on the phone: suggestions left, ingredients right. Drag a suggestion by its handle onto the
 * ingredient it replaces, or tap "Use". Quantity and unit come from the replaced ingredient; then only approval is asked.
 */
const SubstitutionReviewPanel: React.FC<SubstitutionReviewPanelProps> = ({ detail, onCancel, onDone }) => {
  const [chosen, setChosen] = useState<Record<string, SilaSubstitutionSuggestion>>({});
  const [dragging, setDragging] = useState<SilaSubstitutionSuggestion | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);

  const shortId = detail.proposal.ingredientMaterialId;
  const nameOf = (materialId: string) => detail.ingredients.find((x) => x.materialId === materialId)?.itemName ?? 'the ingredient';
  const usedIds = new Set(Object.values(chosen).map((x) => x.materialId));
  const preview = previewSubstitution(detail, chosen);

  const assign = (suggestion: SilaSubstitutionSuggestion, materialId: string | null) => {
    if (!materialId) return;
    if (materialId !== suggestion.replacesMaterialId) {
      setNotice({ tone: 'warning', text: `${suggestion.description} can only replace ${nameOf(suggestion.replacesMaterialId)}.` });
      return;
    }
    setChosen((prev) => ({ ...prev, [materialId]: suggestion }));
    setNotice({ tone: 'success', text: `${nameOf(materialId)} → ${suggestion.description}, ${formatQty(suggestion.quantity)} ${suggestion.uom}.` });
  };

  const undo = (ingredient: SilaSubstitutionIngredient) => {
    const materialId = ingredient.materialId;
    if (!materialId) return;
    setChosen((prev) => {
      const next = { ...prev };
      delete next[materialId];
      return next;
    });
  };

  const submit = async () => {
    setSaving(true);
    setNotice(null);
    try {
      const result = await acceptSubstitution(
        detail.proposal.id,
        Object.entries(chosen).map(([ingredientMaterialId, item]) => ({ ingredientMaterialId, substituteMaterialId: item.materialId })),
      );
      onDone(result);
    } catch (caught: unknown) {
      setNotice({ tone: 'error', text: errorText(caught) });
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  };

  if (confirming) {
    return (
      <section className="sm-card" aria-labelledby="sm-sub-confirm">
        <h2 id="sm-sub-confirm" className="sm-card__title">Send for approval?</h2>
        <ul>
          {Object.entries(chosen).map(([materialId, item]) => (
            <li key={materialId}>
              {nameOf(materialId)} → {item.description} ({formatQty(item.quantity)} {item.uom})
            </li>
          ))}
        </ul>
        <p className="sm-muted">
          Version {detail.latestVersion + 1} goes to the approvers. Version {detail.activeVersion} keeps selling until it is approved.
        </p>
        <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={saving} onClick={submit}>
          {saving ? 'Sending…' : 'Send for approval'}
        </button>
        <button type="button" className="sm-btn sm-btn--block" disabled={saving} onClick={() => setConfirming(false)}>
          Back
        </button>
      </section>
    );
  }

  return (
    <>
      <Notice notice={notice} />
      {dragging && (
        <p className="sm-notice" role="status">
          Release {dragging.description} on {nameOf(dragging.replacesMaterialId)}.
        </p>
      )}
      <div className="sm-sub-columns">
        <section className="sm-sub-column" aria-label="Suggestions">
          <h2>Suggestions</h2>
          {detail.suggestions.map((item) => {
            const used = usedIds.has(item.materialId);
            const active = dragging?.materialId === item.materialId;
            return (
              <div
                key={`${item.replacesMaterialId}-${item.materialId}`}
                className={`sm-sub-card${used ? ' sm-sub-card--used' : ''}${active ? ' sm-sub-card--dragging' : ''}`}
              >
                <strong>{item.description}</strong>
                {item.isRecommended && <span className="sm-badge sm-badge--success">Best match</span>}
                <span className="sm-muted">
                  {formatQty(item.propertyAvailableQty)} {item.baseUom} in stock
                </span>
                <span>
                  {formatQty(item.quantity)} {item.uom} ·{' '}
                  <span className={item.costDelta > 0 ? 'sm-sub-up' : 'sm-sub-down'}>
                    {item.costDelta > 0 ? '+' : ''}
                    {formatMoney(item.costDelta)}
                  </span>
                </span>
                {!used && (
                  <span
                    className="sm-sub-handle"
                    aria-hidden="true"
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      setDragging(item);
                    }}
                    onPointerMove={(event) => {
                      if (dragging) setOverId(ingredientAt(event.clientX, event.clientY));
                    }}
                    onPointerUp={(event) => {
                      if (dragging) assign(dragging, ingredientAt(event.clientX, event.clientY));
                      setDragging(null);
                      setOverId(null);
                    }}
                    onPointerCancel={() => {
                      setDragging(null);
                      setOverId(null);
                    }}
                  >
                    ⠿ Drag
                  </span>
                )}
                <button
                  type="button"
                  className="sm-btn sm-btn--small"
                  disabled={used || saving}
                  aria-label={`Use ${item.description} for ${nameOf(item.replacesMaterialId)}`}
                  onClick={() => assign(item, item.replacesMaterialId)}
                >
                  {used ? 'Used' : 'Use'}
                </button>
              </div>
            );
          })}
        </section>

        <section className="sm-sub-column" aria-label="Ingredients">
          <h2>Ingredients</h2>
          {detail.ingredients.map((item) => {
            const replacement = item.materialId ? chosen[item.materialId] : undefined;
            const classes = [
              'sm-sub-ingredient',
              item.isShort && !replacement ? 'sm-sub-ingredient--short' : '',
              replacement ? 'sm-sub-ingredient--replaced' : '',
              overId !== null && overId === item.materialId ? 'sm-sub-ingredient--over' : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={`${item.sequence}-${item.itemCode}`} className={classes} data-ingredient={item.materialId ?? undefined}>
                <span className={replacement ? 'sm-sub-old' : undefined}>
                  <strong>{item.itemName}</strong> {formatQty(item.quantity)} {item.uom}
                </span>
                {replacement && (
                  <span className="sm-sub-new">
                    → {replacement.description} {formatQty(replacement.quantity)} {replacement.uom}
                  </span>
                )}
                {item.isShort && !replacement && <span className="sm-badge sm-badge--error">Short</span>}
                {replacement && (
                  <button type="button" className="sm-btn sm-btn--small" onClick={() => undo(item)} disabled={saving}>
                    Undo
                  </button>
                )}
              </div>
            );
          })}
        </section>
      </div>

      <section className="sm-card" aria-label="Cost preview">
        <dl className="sm-kv">
          <dt>Recipe cost</dt>
          <dd>
            {formatMoney(detail.totalCost, detail.currency)} → {formatMoney(preview.totalCost, detail.currency)}
          </dd>
          {preview.outlets.map((outlet, index) => (
            <React.Fragment key={outlet.outletLocationId}>
              <dt>Margin {outlet.locationName}</dt>
              <dd>
                {detail.outlets[index]?.marginPercent?.toFixed(1) ?? '—'}% → {outlet.marginPercent?.toFixed(1) ?? '—'}%
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </section>

      <button type="button" className="sm-btn sm-btn--primary sm-btn--block" disabled={!chosen[shortId] || saving} onClick={() => setConfirming(true)}>
        Review &amp; submit
      </button>
      {!chosen[shortId] && <p className="sm-muted">Drag a suggestion onto {nameOf(shortId)}, or tap “Use”.</p>}
      <button type="button" className="sm-btn sm-btn--block" onClick={onCancel} disabled={saving}>
        Cancel
      </button>
    </>
  );
};

export default SubstitutionReviewPanel;
