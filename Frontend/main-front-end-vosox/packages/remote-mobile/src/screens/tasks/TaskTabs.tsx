import React from 'react';
import { getTransfers } from '../../../../remote-buyer/src/api/silaMe/silaMovementsApi';
import { getPriceApprovals } from '../../../../remote-buyer/src/api/silaMe/silaMaterialsApi';
import { getRecipeApprovals } from '../../../../remote-buyer/src/api/silaMe/silaRecipeApi';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading } from '../../components/StateViews';
import { useAccess } from '../../access';
import { formatDate, formatMoney } from '../../format';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
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

/** Price and recipe approvals waiting for me: counted here, decided in the SILA ME cloud app. */
export const CloudApprovals: React.FC = () => {
  const { can } = useAccess();
  const prices = useLoad(() => getPriceApprovals(0, 50), can.approvePrice ? 'tasks-prices' : null);
  const recipes = useLoad(getRecipeApprovals, can.approveRecipe ? 'tasks-recipes' : null);
  if (!can.approvePrice && !can.approveRecipe) return <Empty text="No approvals for your role." />;

  return (
    <>
      <p className="sm-notice">These are approved in the SILA ME cloud app (VOSOX › SILA ME › Price approvals / Recipe approvals).</p>
      {can.approvePrice && (
        <section className="sm-section" aria-labelledby="sm-price-approvals">
          <h2 id="sm-price-approvals">Price approvals waiting for me · {prices.loading ? '…' : (prices.data ?? []).length}</h2>
          {prices.error && <ErrorNotice message={prices.error} onRetry={prices.reload} />}
          <ul className="sm-list">
            {(prices.data ?? []).slice(0, 10).map((change) => (
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
            {(recipes.data ?? []).slice(0, 10).map((recipe) => (
              <li key={recipe.id} className="sm-card">
                <div className="sm-row">
                  <strong className="sm-title">
                    {recipe.recipeCode} · {recipe.name}
                  </strong>
                  <StatusBadge status={recipe.status} />
                </div>
                <span className="sm-meta">{recipe.category ?? '—'}</span>
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
