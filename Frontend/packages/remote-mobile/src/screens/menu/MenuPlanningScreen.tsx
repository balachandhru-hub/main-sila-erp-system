import React, { useEffect, useState } from 'react';
import { getMenuEngineering, saveMenuEngineering, type MenuPlanLine } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { errorText, useLoad } from '../../useLoad';

interface Props {
  portions?: boolean;
}

const today = (): string => new Date().toISOString().slice(0, 10);

const MenuPlanningScreen: React.FC<Props> = ({ portions = false }) => {
  const { can } = useAccess();
  const { location } = useMyLocation();
  const [date, setDate] = useState(today());
  const [mealPeriod, setMealPeriod] = useState('');
  const [planId, setPlanId] = useState('');
  const [name, setName] = useState("Today's menu");
  const [covers, setCovers] = useState('100');
  const [lines, setLines] = useState<MenuPlanLine[]>([]);
  const [busy, setBusy] = useState(false);
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering(portions ? 'portions' : 'plans', {
      dateFrom: date,
      dateTo: date,
      mealPeriod: mealPeriod || undefined,
      outletLocationId: location?.id,
      menuPlanId: planId || undefined,
    }),
    can.viewMenuEngineering ? `menu-plan-${date}-${mealPeriod}-${location?.id ?? ''}-${planId}-${portions ? 'p' : 'm'}` : null,
  );

  useEffect(() => {
    if (!data?.plan) return;
    setPlanId(data.plan.id ?? '');
    setName(data.plan.name);
    setCovers(String(data.plan.expectedCovers ?? data.plan.expectedGuests ?? ''));
    setLines(data.plan.lines);
  }, [data?.plan]);

  const act = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const result = await saveMenuEngineering(body);
      if (result.savedId) setPlanId(result.savedId);
      reload();
    } catch (caught: unknown) {
      window.alert(errorText(caught, 'Could not save the menu plan.'));
    } finally {
      setBusy(false);
    }
  };

  const changeLine = (index: number, change: Partial<MenuPlanLine>) => {
    const next = [...lines];
    next[index] = { ...lines[index], ...change };
    setLines(next);
  };

  return (
    <>
      <ScreenHeader
        title={portions ? 'Portion Planning' : 'Menu Planning'}
        eyebrow="Menu Engineering"
        back
        backTo="menu"
        intro={portions ? 'Recommended portions stay. Confirmed planned portions are not overwritten.' : 'Select date, outlet and meal, then add menu items.'}
      />
      <div className="sm-screen">
        <OfflineBanner />
        <label className="sm-field">Date<input className="sm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        <label className="sm-field">
          Meal period
          <select className="sm-input" value={mealPeriod} onChange={(e) => setMealPeriod(e.target.value)}>
            <option value="">All</option>
            {(data?.lookups?.mealPeriods ?? []).map((meal) => <option key={meal} value={meal}>{meal}</option>)}
          </select>
        </label>
        {location && <p className="sm-meta">Outlet: {location.locationName}</p>}
        {loading && <Loading text="Loading menu plans…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        <section className="sm-section">
          <h2>Plans</h2>
          {(data?.plans?.items ?? []).length === 0 && !loading && <Empty text="No Menu Plan configured." />}
          <ul className="sm-list">
            {(data?.plans?.items ?? []).map((plan) => (
              <li key={plan.id}>
                <button type="button" className="sm-list-btn" onClick={() => setPlanId(plan.id)}>
                  <span className="sm-row"><strong>{plan.name}</strong><StatusBadge status={plan.status} /></span>
                  <span className="sm-meta">{plan.businessDate.slice(0, 10)} · {plan.mealPeriod || 'Meal'} · {plan.lineCount} items</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
        {can.manageMenuEngineering && (
          <>
            <label className="sm-field">Plan name<input className="sm-input" value={name} onChange={(e) => setName(e.target.value)} /></label>
            <label className="sm-field">Expected covers<input className="sm-input" value={covers} onChange={(e) => setCovers(e.target.value)} /></label>
            <label className="sm-field">
              Add menu item
              <select
                className="sm-input"
                value=""
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id || lines.some((line) => line.menuItemId === id)) return;
                  const found = data?.items?.items.find((row) => row.id === id);
                  setLines([...lines, { menuItemId: id, recommendedPortions: 0, menuItemName: found?.name, recipeLinkStatus: found?.recipeLinkStatus }]);
                }}
              >
                <option value="">Select</option>
                {(data?.items?.items ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
              </select>
            </label>
            {lines.length === 0 && <Empty text="Add menu items to the plan." />}
            <ul className="sm-list">
              {lines.map((line, index) => (
                <li key={`${line.menuItemId}-${index}`} className="sm-list-btn">
                  <span className="sm-row">
                    <strong>{line.menuItemName || line.menuItemId}</strong>
                    <button type="button" className="sm-link" onClick={() => setLines(lines.filter((_, i) => i !== index))}>Remove</button>
                  </span>
                  <span className="sm-meta">
                    Recommended {line.recommendedPortions}
                    {line.actualPortions != null ? ` · Actual ${line.actualPortions}` : ''}
                    {line.variance != null ? ` · Variance ${line.variance}` : ''}
                    {line.warning ? ` · ${line.warning}` : ''}
                  </span>
                  <label className="sm-field">
                    Planned portions
                    <input
                      className="sm-input"
                      type="number"
                      value={line.plannedPortions ?? ''}
                      onChange={(e) => changeLine(index, { plannedPortions: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="sm-row">
                    <input
                      type="checkbox"
                      checked={!!line.portionsConfirmed}
                      onChange={(e) => changeLine(index, { portionsConfirmed: e.target.checked, confirmPortions: e.target.checked })}
                    />
                    Confirm planned portions
                  </label>
                  {line.portionsConfirmed && (
                    <label className="sm-field">
                      Override reason
                      <input className="sm-input" value={line.overrideReason ?? ''} onChange={(e) => changeLine(index, { overrideReason: e.target.value })} />
                    </label>
                  )}
                </li>
              ))}
            </ul>
            <button
              type="button"
              className="sm-btn"
              disabled={busy}
              onClick={() => act({
                action: 'UPSERT_PLAN',
                plan: {
                  id: planId || undefined,
                  name,
                  businessDate: date,
                  outletLocationId: location?.id,
                  mealPeriod: mealPeriod || undefined,
                  expectedCovers: Number(covers) || 0,
                  expectedGuests: Number(covers) || 0,
                  lines,
                },
              })}
            >
              {busy ? 'Saving…' : 'Save / confirm plan'}
            </button>
            <button type="button" className="sm-btn" disabled={busy || !planId} onClick={() => act({ action: 'CONFIRM_PLAN', menuPlanId: planId })}>
              Confirm menu plan
            </button>
            <button type="button" className="sm-btn" disabled={busy || !planId} onClick={() => act({ action: 'COPY_PLAN', menuPlanId: planId, plan: { name: `${name} copy`, businessDate: date } })}>
              Copy prior menu
            </button>
          </>
        )}
      </div>
    </>
  );
};

export default MenuPlanningScreen;
