import React from 'react';
import { getTransfers } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import { decidePriceChange, getPriceApprovals } from '../../../../remote-buyer/src/api/silaMe/silaMaterialsApi';
import { approveRecipe, getRecipeApprovals, rejectRecipe } from '../../../../remote-buyer/src/api/silaMe/silaRecipeApi';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate, formatMoney } from '../../format';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';
import { grnErpStatus, isGrnException, loadRecentGrns } from '../receive/grnStatus';

/** Transfers waiting for my approval (source or destination). */
export const ItoApprovals: React.FC = () => {
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => getTransfers('to-approve'), 'tasks-ito');
  return (
    <>
      <p className="sm-meta">Source approval, destination approval, dispatch and receipt of internal transfers.</p>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {!loading && !error && (data ?? []).length === 0 && <Empty text="No ITO approval tasks." />}
      <ul className="sm-list">
        {(data ?? []).map((transfer) => (
          <li key={transfer.id}>
            <button type="button" className="sm-list-btn" onClick={() => go(`inventory/transfers/${transfer.id}`)}>
              <span className="sm-row">
                <strong>{transfer.itoNumber}</strong>
                <StatusBadge status={transfer.status} />
              </span>
              <span>
                {transfer.fromLocationName ?? '—'} → {transfer.toLocationName ?? '—'}
              </span>
              <span className="sm-meta">
                {transfer.lineCount} material{transfer.lineCount === 1 ? '' : 's'} · {transfer.requestedByName ?? '—'} · {formatDate(transfer.requestedOn)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};

/** Approve or reject one waiting item. The comment is optional, matching the SILA ME decision APIs. */
const DecisionActions: React.FC<{ busy: boolean; onDecide: (approve: boolean, comment: string) => void }> = ({ busy, onDecide }) => {
  const [comment, setComment] = React.useState('');
  const commentId = React.useId();
  return (
    <>
      <div className="sm-field">
        <label htmlFor={commentId}>Comment (optional)</label>
        <input id={commentId} className="sm-input" value={comment} maxLength={500} disabled={busy} onChange={(event) => setComment(event.target.value)} />
      </div>
      <div className="sm-grid-2">
        <button type="button" className="sm-btn sm-btn--success" disabled={busy} onClick={() => onDecide(true, comment)}>
          Approve
        </button>
        <button type="button" className="sm-btn sm-btn--danger" disabled={busy} onClick={() => onDecide(false, comment)}>
          Reject
        </button>
      </div>
    </>
  );
};

/** Price and recipe approvals waiting for me, decided with the same calls as the SILA ME cloud screens. */
export const CloudApprovals: React.FC = () => {
  const { can } = useAccess();
  const prices = useLoad(() => getPriceApprovals(0, 50), can.approvePrice ? 'tasks-prices' : null);
  const recipes = useLoad(getRecipeApprovals, can.approveRecipe ? 'tasks-recipes' : null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  if (!can.approvePrice && !can.approveRecipe) return <Empty text="No approvals for your role." />;

  const decide = async (id: string, run: () => Promise<unknown>, reload: () => void) => {
    setError(null);
    setBusyId(id);
    try {
      await run();
      reload();
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {error && <ErrorNotice message={error} />}
      {can.approvePrice && (
        <section className="sm-section" aria-labelledby="sm-price-approvals">
          <h2 id="sm-price-approvals">Price approvals waiting for me · {prices.loading ? '…' : (prices.data ?? []).length}</h2>
          {prices.error && <ErrorNotice message={prices.error} onRetry={prices.reload} />}
          <ul className="sm-list">
            {(prices.data ?? []).map((change) => (
              <li key={change.id} className="sm-card">
                <strong className="sm-title">
                  {change.materialCode} · {change.description}
                </strong>
                <span className="sm-meta">
                  {formatMoney(change.currentUnitCost, change.currency)} → {formatMoney(change.proposedUnitCost, change.currency)} per{' '}
                  {change.priceUom ?? change.baseUom} · {change.requestNumber}
                </span>
                <span className="sm-meta">
                  {change.requestedByName ?? '—'} · {formatDate(change.requestedOn)} · {change.reason}
                </span>
                <DecisionActions
                  busy={busyId === change.id}
                  onDecide={(approve, comment) => decide(change.id, () => decidePriceChange(change.id, approve, comment), prices.reload)}
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {can.approveRecipe && (
        <section className="sm-section" aria-labelledby="sm-recipe-approvals">
          <h2 id="sm-recipe-approvals">Recipe approvals waiting for me · {recipes.loading ? '…' : (recipes.data ?? []).length}</h2>
          {recipes.error && <ErrorNotice message={recipes.error} onRetry={recipes.reload} />}
          <ul className="sm-list">
            {(recipes.data ?? []).map((recipe) => (
              <li key={recipe.id} className="sm-card">
                <div className="sm-row">
                  <strong className="sm-title">
                    {recipe.recipeCode} · {recipe.name}
                  </strong>
                  <StatusBadge status={recipe.status} />
                </div>
                <span className="sm-meta">{recipe.category ?? '—'}</span>
                <DecisionActions
                  busy={busyId === recipe.id}
                  onDecide={(approve, comment) =>
                    decide(recipe.id, () => (approve ? approveRecipe(recipe.id, comment) : rejectRecipe(recipe.id, comment)), recipes.reload)
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
};

/** Goods receipts the ERP refused or did not confirm (last 30 days). */
export const GrnExceptions: React.FC = () => {
  const go = useGo();
  const { data, loading, error, reload } = useLoad(() => loadRecentGrns(30, 200), 'tasks-grn-exceptions');
  const rows = (data ?? []).filter(isGrnException);
  return (
    <>
      {loading && <Loading />}
      {error && <ErrorNotice message={error} onRetry={reload} />}
      {!loading && !error && rows.length === 0 && <Empty text="No exceptions right now." />}
      <ul className="sm-list">
        {rows.map((grn) => (
          <li key={grn.id}>
            <button type="button" className="sm-list-btn" onClick={() => go(`receive/grns/${grn.id}`)}>
              <span className="sm-row">
                <strong>GRN Failed / Unknown</strong>
                <StatusBadge status={grnErpStatus(grn)} />
              </span>
              <span className="sm-meta">
                {grn.grnNumber} · {grn.supplierName ?? '—'} · PO {grn.poNumber}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  );
};
