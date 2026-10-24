import React, { useState } from 'react';
import { getMenuEngineering, simulateMenuEngineering } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';
import { errorText, useLoad } from '../../useLoad';

const today = (): string => new Date().toISOString().slice(0, 10);

const range = () => {
  const dateTo = today();
  const from = new Date();
  from.setDate(from.getDate() - 7);
  return { dateFrom: from.toISOString().slice(0, 10), dateTo };
};

export const MenuPerformanceScreen: React.FC = () => {
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('performance', range()),
    can.viewMenuEngineering ? 'menu-perf' : null,
  );
  const rows = data?.performance?.rows ?? [];
  return (
    <>
      <ScreenHeader title="Menu Performance" eyebrow="Menu Engineering" back backTo="menu" />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        <div className="sm-grid-2">
          <div className="sm-stat"><span className="sm-muted">Stars</span><strong>{data?.performance?.stars ?? 0}</strong></div>
          <div className="sm-stat"><span className="sm-muted">Plowhorses</span><strong>{data?.performance?.plowhorses ?? 0}</strong></div>
          <div className="sm-stat"><span className="sm-muted">Puzzles</span><strong>{data?.performance?.puzzles ?? 0}</strong></div>
          <div className="sm-stat"><span className="sm-muted">Dogs</span><strong>{data?.performance?.dogs ?? 0}</strong></div>
        </div>
        {rows.length === 0 && !loading && <Empty text="No Menu Items require analysis." description="POS sales mapped to menu items appear here." />}
        <ul className="sm-list">
          {rows.map((row) => (
            <li key={row.menuItemId} className="sm-list-btn">
              <span className="sm-row"><strong>{row.name}</strong><StatusBadge status={row.classification} /></span>
              <span className="sm-meta">
                Qty {row.qtySold} · Revenue {row.revenue}
                {row.foodCostPercent == null ? ` · ${row.costState}` : ` · Food cost ${Math.round(row.foodCostPercent * 100)}%`}
                {row.contributionMargin == null ? '' : ` · CM ${row.contributionMargin}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const ConsumptionScreen: React.FC = () => {
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('consumption', range()),
    can.viewMenuEngineering ? 'menu-cons' : null,
  );
  const rows = data?.consumption?.rows ?? [];
  return (
    <>
      <ScreenHeader title="Consumption" eyebrow="Menu Engineering" back backTo="menu" />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        <div className="sm-grid-2">
          <div className="sm-stat"><span className="sm-muted">Theoretical</span><strong>{data?.consumption?.theoretical ?? 0}</strong></div>
          <div className="sm-stat"><span className="sm-muted">Actual</span><strong>{data?.consumption?.actual ?? 0}</strong></div>
          <div className="sm-stat"><span className="sm-muted">Variance</span><strong>{data?.consumption?.variance ?? 0}</strong></div>
        </div>
        {rows.length === 0 && !loading && <Empty text="No consumption variance found." description="Recipe is required before theoretical consumption can be calculated." />}
        <ul className="sm-list">
          {rows.map((row, index) => (
            <li key={index} className="sm-list-btn">
              <span className="sm-row"><strong>{row.materialName}</strong><span className="sm-meta">{row.varianceQty} {row.uom}</span></span>
              <span className="sm-meta">
                {row.menuItemName} · Theoretical {row.theoreticalQty} · Actual {row.actualQty}
                {row.variancePercent == null ? '' : ` · ${Math.round(row.variancePercent * 100)}%`}
                {row.varianceValue == null ? '' : ` · ${row.varianceValue}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const CostMarginScreen: React.FC = () => {
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('cost', range()),
    can.viewMenuEngineering ? 'menu-cost' : null,
  );
  const rows = data?.costMargin?.rows ?? [];
  return (
    <>
      <ScreenHeader title="Cost & Margin" eyebrow="Menu Engineering" back backTo="menu" />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {rows.length === 0 && !loading && <Empty text="Material cost is unavailable." description="Cost is not invented when the recipe has no authoritative cost." />}
        <ul className="sm-list">
          {rows.map((row) => (
            <li key={row.menuItemId} className="sm-list-btn">
              <span className="sm-row"><strong>{row.name}</strong><StatusBadge status={row.costState} /></span>
              <span className="sm-meta">
                Price {row.sellingPrice ?? '—'} · Cost/portion {row.costPerPortion ?? row.costState}
                {row.foodCostPercent == null ? '' : ` · Food cost ${Math.round(row.foodCostPercent * 100)}%`}
                {row.contributionMargin == null ? '' : ` · Margin ${row.contributionMargin}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const MenuRecommendationsScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('recommendations', { dateFrom: today(), dateTo: today() }),
    can.viewMenuEngineering ? 'menu-recs' : null,
  );
  const rows = data?.recommendations?.menuDemand ?? data?.requirements?.rows ?? [];
  return (
    <>
      <ScreenHeader title="Purchase Recommendations" eyebrow="Menu Engineering" back backTo="menu" />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {rows.length === 0 && !loading && <Empty text="No Menu Items require purchase." />}
        <ul className="sm-list">
          {rows.map((row, index) => (
            <li key={index} className="sm-list-btn">
              <span className="sm-row"><strong>{row.materialName}</strong><span className="sm-meta">{row.reason}</span></span>
              <span className="sm-meta">
                Need {row.requirement} {row.uom} · Available {row.available} · Open PO {row.openPo} · Shortage {row.shortage}
                {row.requiredDate ? ` · ${row.requiredDate.slice(0, 10)}` : ''}
              </span>
            </li>
          ))}
        </ul>
        {can.requestPurchase && (
          <button type="button" className="sm-btn" onClick={() => go('inventory/recommendations')}>
            Open existing recommendation → PR flow
          </button>
        )}
        <p className="sm-meta">Menu Engineering does not create a second purchasing engine or auto-create a PO.</p>
      </div>
    </>
  );
};

export const MenuIntelligenceScreen: React.FC = () => {
  const { can } = useAccess();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('intelligence', range()),
    can.viewMenuEngineering ? 'menu-ai' : null,
  );
  const rows = data?.intelligence?.insights ?? [];
  return (
    <>
      <ScreenHeader title="AI Menu Intelligence" eyebrow="Menu Engineering" back backTo="menu" intro="Advisory only. AI cannot post ERP transactions." />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {rows.length === 0 && !loading && <Empty text="No AI insight available for the selected period." />}
        <ul className="sm-list">
          {rows.map((row, index) => (
            <li key={index} className="sm-list-btn">
              <span className="sm-row"><strong>{row.title}</strong><StatusBadge status={row.priority} /></span>
              <span className="sm-meta">{row.category} · {row.affectedName || ''} · {row.reason} {row.recommendedAction}</span>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export const WhatIfScreen: React.FC = () => {
  const { can } = useAccess();
  const [values, setValues] = useState({ occupancy: '95', covers: '450', portion: '1', price: '1', cost: '1' });
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dash = useLoad(
    () => getMenuEngineering('dashboard', { dateFrom: today(), dateTo: today() }),
    can.viewMenuEngineering ? 'menu-whatif-base' : null,
  );

  const run = async () => {
    setBusy(true);
    try {
      const next = await simulateMenuEngineering({
        occupancyPercent: Number(values.occupancy),
        expectedCovers: Number(values.covers),
        portionFactor: Number(values.portion),
        priceFactor: Number(values.price),
        costFactor: Number(values.cost),
      });
      const result = next.simulation;
      setNote(result
        ? `Portions ${result.recommendedPortions} · Requirement ${result.ingredientRequirement} · Shortage ${result.shortage} · Purchase ${result.purchaseRequirement} · Food cost ${result.foodCost} · Margin ${result.contributionMargin}. ${result.note}`
        : 'Simulation did not return a result.');
    } catch (caught: unknown) {
      window.alert(errorText(caught, 'Simulation failed.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title="What-If" eyebrow="Menu Engineering" back backTo="menu" intro="Simulation never changes live operational data." />
      <div className="sm-screen">
        <OfflineBanner />
        {dash.loading && <Loading />}
        <label className="sm-field">Occupancy %<input className="sm-input" value={values.occupancy} onChange={(e) => setValues({ ...values, occupancy: e.target.value })} /></label>
        <label className="sm-field">Expected covers<input className="sm-input" value={values.covers} onChange={(e) => setValues({ ...values, covers: e.target.value })} /></label>
        <label className="sm-field">Portion factor<input className="sm-input" value={values.portion} onChange={(e) => setValues({ ...values, portion: e.target.value })} /></label>
        <label className="sm-field">Price factor<input className="sm-input" value={values.price} onChange={(e) => setValues({ ...values, price: e.target.value })} /></label>
        <label className="sm-field">Cost factor<input className="sm-input" value={values.cost} onChange={(e) => setValues({ ...values, cost: e.target.value })} /></label>
        <button type="button" className="sm-btn" disabled={busy} onClick={run}>{busy ? 'Running…' : 'Run simulation'}</button>
        {note ? <p className="sm-meta">{note}</p> : <Empty text="Simulation does not change live operational data." />}
      </div>
    </>
  );
};
