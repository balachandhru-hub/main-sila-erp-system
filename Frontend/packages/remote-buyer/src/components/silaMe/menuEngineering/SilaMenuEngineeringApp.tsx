import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, KpiCard, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import {
  getMenuEngineering,
  saveMenuEngineering,
  simulateMenuEngineering,
  type MenuEnvelope,
  type MenuFilter,
  type MenuItemDetail,
  type MenuPlanLine,
} from "../../../api/silaMe/silaMenuEngineeringApi";
import "../silaMeTheme.css";
import "./SilaMenuEngineering.css";

type ViewKey =
  | "silaMenuDashboard"
  | "silaMenuItems"
  | "silaMenuPlanning"
  | "silaMenuPortions"
  | "silaMenuDemand"
  | "silaMenuPosSales"
  | "silaMenuPosMapping"
  | "silaMenuPerformance"
  | "silaMenuConsumption"
  | "silaMenuCost"
  | "silaMenuRecommendations"
  | "silaMenuIntelligence"
  | "silaMenuWhatIf"
  | "silaMenuSetup";

const VIEW: Record<ViewKey, string> = {
  silaMenuDashboard: "dashboard",
  silaMenuItems: "items",
  silaMenuPlanning: "plans",
  silaMenuPortions: "portions",
  silaMenuDemand: "demand",
  silaMenuPosSales: "pos-sales",
  silaMenuPosMapping: "pos-mappings",
  silaMenuPerformance: "performance",
  silaMenuConsumption: "consumption",
  silaMenuCost: "cost",
  silaMenuRecommendations: "requirements",
  silaMenuIntelligence: "intelligence",
  silaMenuWhatIf: "simulate",
  silaMenuSetup: "settings",
};

const TITLES: Record<ViewKey, string> = {
  silaMenuDashboard: "Menu Engineering",
  silaMenuItems: "Menu Items",
  silaMenuPlanning: "Menu Planning",
  silaMenuPortions: "Portion Planning",
  silaMenuDemand: "Demand Planning",
  silaMenuPosSales: "POS Sales",
  silaMenuPosMapping: "POS Mapping",
  silaMenuPerformance: "Menu Performance",
  silaMenuConsumption: "Consumption Analysis",
  silaMenuCost: "Cost & Margin Analysis",
  silaMenuRecommendations: "Purchase Recommendations",
  silaMenuIntelligence: "AI Menu Intelligence",
  silaMenuWhatIf: "What-If Simulation",
  silaMenuSetup: "Menu Engineering Setup",
};

interface Props {
  navKey: ViewKey;
  canManage: boolean;
  canRequestPurchase: boolean;
  canManageRecipe: boolean;
  onNavigate: (key: string) => void;
}

const today = (): string => new Date().toISOString().slice(0, 10);

const SilaMenuEngineeringApp: React.FC<Props> = ({ navKey, canManage, canRequestPurchase, canManageRecipe, onNavigate }) => {
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo, setDateTo] = useState(today());
  const [outletId, setOutletId] = useState("");
  const [propertyId, setPropertyId] = useState("");
  const [mealPeriod, setMealPeriod] = useState("");
  const [search, setSearch] = useState("");
  const [data, setData] = useState<MenuEnvelope | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [item, setItem] = useState<Partial<MenuItemDetail>>({ name: "", defaultPortionQty: 1, portionUom: "EA", status: "DRAFT" });
  const [planName, setPlanName] = useState("Today's menu");
  const [covers, setCovers] = useState("100");
  const [planLines, setPlanLines] = useState<MenuPlanLine[]>([]);
  const [planId, setPlanId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [mappingItemId, setMappingItemId] = useState<Record<string, string>>({});
  const [csv, setCsv] = useState("");
  const [whatIf, setWhatIf] = useState({ occupancy: "95", covers: "450", portion: "1", price: "1", cost: "1" });

  const filter = useMemo<MenuFilter>(() => ({
    dateFrom,
    dateTo,
    outletLocationId: outletId || undefined,
    propertyId: propertyId || undefined,
    mealPeriod: mealPeriod || undefined,
    search: search || undefined,
    menuPlanId: planId || undefined,
  }), [dateFrom, dateTo, outletId, propertyId, mealPeriod, search, planId]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const view = VIEW[navKey];
    getMenuEngineering(view === "simulate" ? "dashboard" : view, filter)
      .then((next) => {
        setData(next);
        if (next.plan) {
          setPlanId(next.plan.id ?? "");
          setPlanName(next.plan.name);
          setCovers(String(next.plan.expectedCovers ?? next.plan.expectedGuests ?? ""));
          setPlanLines(next.plan.lines);
        }
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load Menu Engineering."))
      .finally(() => setLoading(false));
  }, [navKey, filter]);

  useEffect(() => { load(); }, [load]);

  const lookups = data?.lookups;
  const act = async (body: Record<string, unknown>) => {
    try {
      const result = await saveMenuEngineering(body);
      toastService.success(result.message || "Saved.");
      if (result.savedId && body.action === "CREATE_RECIPE") onNavigate("silaRecipes");
      load();
      return result;
    } catch (caught: unknown) {
      toastService.error(caught instanceof Error ? caught.message : "Could not save.");
      return null;
    }
  };

  return (
    <div className="sila-me sme-page">
      <PageHeader
        className="pud-page-header"
        title={TITLES[navKey]}
        description="Menu Item is the selling object. Recipe Management remains the production and cost authority."
      />
      <div className="sme-filters">
        <div className="sila-field"><label className="sila-label">From</label><input className="sila-input" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} /></div>
        <div className="sila-field"><label className="sila-label">To</label><input className="sila-input" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} /></div>
        <div className="sila-field">
          <label className="sila-label">Property</label>
          <select className="sila-input" value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">All properties</option>
            {(lookups?.properties ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label">Outlet</label>
          <select className="sila-input" value={outletId} onChange={(e) => setOutletId(e.target.value)}>
            <option value="">All outlets</option>
            {(lookups?.outlets ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label">Meal period</label>
          <select className="sila-input" value={mealPeriod} onChange={(e) => setMealPeriod(e.target.value)}>
            <option value="">All</option>
            {(lookups?.mealPeriods ?? []).map((row) => <option key={row} value={row}>{row}</option>)}
          </select>
        </div>
      </div>
      {loading && <Loader size={24} message="Loading Menu Engineering…" />}
      {error && <p className="srcv-error" role="alert">{error}</p>}
      {!loading && data && navKey === "silaMenuDashboard" && <Dashboard data={data} onNavigate={onNavigate} />}
      {!loading && data && navKey === "silaMenuItems" && (
        <Items data={data} item={item} setItem={setItem} recipeId={recipeId} setRecipeId={setRecipeId} canManage={canManage} canManageRecipe={canManageRecipe} search={search} setSearch={setSearch} onSave={() => act({ action: "UPSERT_ITEM", item })} onLink={(id) => act({ action: "LINK_RECIPE", menuItemId: id, recipeId })} onCreate={(id) => act({ action: "CREATE_RECIPE", menuItemId: id })} />
      )}
      {!loading && data && (navKey === "silaMenuPlanning" || navKey === "silaMenuPortions") && (
        <Planning
          data={data}
          portions={navKey === "silaMenuPortions"}
          canManage={canManage}
          planName={planName}
          setPlanName={setPlanName}
          covers={covers}
          setCovers={setCovers}
          lines={planLines}
          setLines={setPlanLines}
          lookups={lookups}
          onOpen={(id) => { setPlanId(id); }}
          onSave={() => act({ action: "UPSERT_PLAN", plan: { id: planId || undefined, name: planName, businessDate: dateFrom, outletLocationId: outletId || undefined, propertyId: propertyId || undefined, mealPeriod: mealPeriod || undefined, expectedCovers: Number(covers) || 0, expectedGuests: Number(covers) || 0, lines: planLines } })}
          onConfirm={() => act({ action: "CONFIRM_PLAN", menuPlanId: planId })}
          onCopy={() => act({ action: "COPY_PLAN", menuPlanId: planId, plan: { name: `${planName} copy`, businessDate: dateTo } })}
        />
      )}
      {!loading && data && navKey === "silaMenuDemand" && (
        <Demand data={data} canManage={canManage} covers={covers} setCovers={setCovers} onManual={() => act({ action: "SAVE_PMS", demand: { businessDate: dateFrom, propertyId: propertyId || undefined, expectedGuests: Number(covers) || 0, expectedCovers: Number(covers) || 0 } })} onPull={() => act({ action: "PULL_PMS", demand: { businessDate: dateFrom, propertyId: propertyId || undefined } })} />
      )}
      {!loading && data && navKey === "silaMenuPosSales" && <PosSales data={data} csv={csv} setCsv={setCsv} canManage={canManage} onImport={() => act({ action: "IMPORT_POS", csv })} />}
      {!loading && data && navKey === "silaMenuPosMapping" && <PosMapping data={data} canManage={canManage} mappingItemId={mappingItemId} setMappingItemId={setMappingItemId} onMap={(id, menuItemId) => act({ action: "UPSERT_MAPPING", mapping: { id, posCode: data.posMappings?.items.find((x) => x.id === id)?.posCode, menuItemId } })} />}
      {!loading && data && navKey === "silaMenuPerformance" && <Performance data={data} />}
      {!loading && data && navKey === "silaMenuConsumption" && <Consumption data={data} />}
      {!loading && data && navKey === "silaMenuCost" && <Cost data={data} />}
      {!loading && data && navKey === "silaMenuRecommendations" && <Recommendations data={data} canRequestPurchase={canRequestPurchase} onOpenRecs={() => onNavigate("silaRecommendations")} />}
      {!loading && data && navKey === "silaMenuIntelligence" && <Intelligence data={data} />}
      {!loading && data && navKey === "silaMenuWhatIf" && (
        <WhatIf
          result={data.simulation}
          values={whatIf}
          setValues={setWhatIf}
          onRun={async () => {
            try {
              const next = await simulateMenuEngineering({ occupancyPercent: Number(whatIf.occupancy), expectedCovers: Number(whatIf.covers), portionFactor: Number(whatIf.portion), priceFactor: Number(whatIf.price), costFactor: Number(whatIf.cost), menuPlanId: planId || undefined });
              setData((prev) => ({ ...(prev ?? next), simulation: next.simulation }));
            } catch (caught: unknown) {
              toastService.error(caught instanceof Error ? caught.message : "Simulation failed.");
            }
          }}
        />
      )}
      {!loading && data && navKey === "silaMenuSetup" && <Setup data={data} canManage={canManage} onSave={(settings) => act({ action: "SAVE_SETTINGS", settings })} />}
    </div>
  );
};

const Dashboard: React.FC<{ data: MenuEnvelope; onNavigate: (key: string) => void }> = ({ data, onNavigate }) => {
  const dash = data.dashboard;
  if (!dash) return <EmptyState title="No Menu Engineering data." description="Create a menu item to start planning." />;
  return (
    <>
      <div className="sila-kpi-grid">
        <KpiCard label="Food revenue" value={dash.foodRevenue} onClick={() => onNavigate("silaMenuPerformance")} />
        <KpiCard label="Food cost %" value={dash.foodCostPercent == null ? "—" : `${Math.round(dash.foodCostPercent * 100)}%`} />
        <KpiCard label="Expected covers" value={dash.expectedCovers} onClick={() => onNavigate("silaMenuDemand")} />
        <KpiCard label="Items sold" value={dash.menuItemsSold} />
        <KpiCard label="Consumption variance" value={dash.consumptionVariance} tone={dash.consumptionVariance ? "warning" : undefined} onClick={() => onNavigate("silaMenuConsumption")} />
        <KpiCard label="Forecast shortage" value={dash.forecastShortage} tone={dash.forecastShortage ? "danger" : undefined} onClick={() => onNavigate("silaMenuRecommendations")} />
      </div>
      <section className="sila-card">
        <h2 className="sila-form-section-title">Menu mix</h2>
        <p>Stars {dash.stars} · Plowhorses {dash.plowhorses} · Puzzles {dash.puzzles} · Dogs {dash.dogs}</p>
        <p className="sme-muted">Occupancy {dash.occupancyPercent ?? "—"}% · Source {dash.occupancySource || "—"} · {dash.occupancyFreshness || "UNAVAILABLE"}</p>
      </section>
      <section className="sila-card">
        <h2 className="sila-form-section-title">Today's menus</h2>
        {dash.todayMenus.length === 0 ? <EmptyState title="No Menu Plan configured." description="Create a menu plan for the selected date." /> : dash.todayMenus.map((plan) => <p key={plan.id}>{plan.name} · {plan.mealPeriod || "Meal"} · {plan.lineCount} items</p>)}
      </section>
      <section className="sila-card">
        <h2 className="sila-form-section-title">Attention required</h2>
        {dash.attention.length === 0 ? <EmptyState title="No items require attention." description="Missing recipes, unmapped POS and shortages appear here." /> : (
          <ul className="sme-list">{dash.attention.map((row, index) => <li key={`${row.kind}-${index}`}><strong>{row.title}</strong><div className="sme-muted">{row.message}</div></li>)}</ul>
        )}
      </section>
      <section className="sila-card">
        <h2 className="sila-form-section-title">AI insights</h2>
        {dash.insights.length === 0 ? <EmptyState title="No AI insight available for the selected period." /> : dash.insights.map((row, index) => <p key={index}><strong>{row.title}</strong> — {row.reason}</p>)}
      </section>
    </>
  );
};

const Items: React.FC<{
  data: MenuEnvelope;
  item: Partial<MenuItemDetail>;
  setItem: (item: Partial<MenuItemDetail>) => void;
  recipeId: string;
  setRecipeId: (id: string) => void;
  canManage: boolean;
  canManageRecipe: boolean;
  search: string;
  setSearch: (v: string) => void;
  onSave: () => void;
  onLink: (id: string) => void;
  onCreate: (id: string) => void;
}> = ({ data, item, setItem, recipeId, setRecipeId, canManage, canManageRecipe, search, setSearch, onSave, onLink, onCreate }) => (
  <>
    {canManage && (
      <section className="sila-card">
        <h2 className="sila-form-section-title">{item.id ? "Edit menu item" : "Create menu item"}</h2>
        <div className="sme-form">
          <div className="sila-field"><label className="sila-label">Name</label><input className="sila-input" value={item.name ?? ""} onChange={(e) => setItem({ ...item, name: e.target.value })} /></div>
          <div className="sila-field"><label className="sila-label">Category</label><input className="sila-input" value={item.category ?? ""} onChange={(e) => setItem({ ...item, category: e.target.value })} /></div>
          <div className="sila-field"><label className="sila-label">Selling price</label><input className="sila-input" type="number" value={item.sellingPrice ?? ""} onChange={(e) => setItem({ ...item, sellingPrice: Number(e.target.value) || undefined })} /></div>
          <div className="sila-field"><label className="sila-label">Portion qty</label><input className="sila-input" type="number" value={item.defaultPortionQty ?? 1} onChange={(e) => setItem({ ...item, defaultPortionQty: Number(e.target.value) || 1 })} /></div>
          <div className="sila-field"><label className="sila-label">Portion UOM</label><input className="sila-input" value={item.portionUom ?? ""} onChange={(e) => setItem({ ...item, portionUom: e.target.value })} /></div>
          <div className="sila-field"><label className="sila-label">Meal periods</label><input className="sila-input" value={item.mealPeriods ?? ""} onChange={(e) => setItem({ ...item, mealPeriods: e.target.value })} /></div>
        </div>
        <p className="sme-muted">A recipe is optional. Selling price stays on the menu item.</p>
        <button type="button" className="sila-btn sila-btn--primary" onClick={onSave}>Save menu item</button>
      </section>
    )}
    <section className="sila-card">
      <div className="sme-row"><h2 className="sila-form-section-title">Menu items</h2><input className="sila-input" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      {(data.items?.items ?? []).length === 0 ? <EmptyState title="No menu items." description="Create a commercial menu item. Recipe is optional." /> : (
        <ul className="sme-list">
          {(data.items?.items ?? []).map((row) => (
            <li key={row.id} className="sme-row">
              <div>
                <strong>{row.name}</strong>
                <div className="sme-muted">{row.menuItemCode} · {row.category || "No category"} · {row.recipeLinkStatus} · {row.costState}</div>
              </div>
              {canManage && (
                <div className="sila-btn-group">
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setItem(row)}>Edit</button>
                  <select className="sila-input" value={recipeId} onChange={(e) => setRecipeId(e.target.value)}>
                    <option value="">Link recipe</option>
                    {(data.lookups?.recipes ?? []).map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                  </select>
                  <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={!recipeId} onClick={() => row.id && onLink(row.id)}>Link</button>
                  {canManageRecipe && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => row.id && onCreate(row.id)}>Create recipe</button>}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  </>
);

const Planning: React.FC<{
  data: MenuEnvelope;
  portions: boolean;
  canManage: boolean;
  planName: string;
  setPlanName: (v: string) => void;
  covers: string;
  setCovers: (v: string) => void;
  lines: MenuPlanLine[];
  setLines: (lines: MenuPlanLine[]) => void;
  lookups?: MenuEnvelope["lookups"];
  onOpen: (id: string) => void;
  onSave: () => void;
  onConfirm: () => void;
  onCopy: () => void;
}> = ({ data, portions, canManage, planName, setPlanName, covers, setCovers, lines, setLines, lookups, onOpen, onSave, onConfirm, onCopy }) => (
  <>
    <section className="sila-card">
      <h2 className="sila-form-section-title">Menu plans</h2>
      {(data.plans?.items ?? []).length === 0 ? <EmptyState title="No Menu Plan configured." /> : data.plans!.items.map((plan) => (
        <button key={plan.id} type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => onOpen(plan.id)}>{plan.name} · {plan.businessDate.slice(0, 10)} · {plan.status}</button>
      ))}
    </section>
    {canManage && (
      <section className="sila-card">
        <h2 className="sila-form-section-title">{portions ? "Portion plan" : "Plan header"}</h2>
        <div className="sme-form">
          <div className="sila-field"><label className="sila-label">Name</label><input className="sila-input" value={planName} onChange={(e) => setPlanName(e.target.value)} /></div>
          <div className="sila-field"><label className="sila-label">Expected covers</label><input className="sila-input" value={covers} onChange={(e) => setCovers(e.target.value)} /></div>
          <div className="sila-field">
            <label className="sila-label">Add menu item</label>
            <select className="sila-input" value="" onChange={(e) => {
              const id = e.target.value;
              if (!id || lines.some((line) => line.menuItemId === id)) return;
              const found = data.items?.items.find((row) => row.id === id) ?? data.lookups?.recipes ? undefined : undefined;
              setLines([...lines, { menuItemId: id, recommendedPortions: 0, menuItemName: found?.name }]);
            }}>
              <option value="">Select</option>
              {(data.items?.items ?? []).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
        </div>
        {lines.length === 0 ? <EmptyState title="Add menu items to the plan." /> : (
          <table className="sila-table">
            <thead><tr><th>Item</th><th>Recommended</th><th>Planned</th><th>Confirmed</th><th>Reason</th></tr></thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={`${line.menuItemId}-${index}`}>
                  <td>{line.menuItemName || line.menuItemId}<div className="sme-muted">{line.warning}</div></td>
                  <td>{line.recommendedPortions}</td>
                  <td><input className="sila-input" type="number" value={line.plannedPortions ?? ""} onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...line, plannedPortions: Number(e.target.value) || 0 };
                    setLines(next);
                  }} /></td>
                  <td><input type="checkbox" checked={!!line.portionsConfirmed} onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...line, portionsConfirmed: e.target.checked, confirmPortions: e.target.checked };
                    setLines(next);
                  }} /></td>
                  <td><input className="sila-input" value={line.overrideReason ?? ""} onChange={(e) => {
                    const next = [...lines];
                    next[index] = { ...line, overrideReason: e.target.value };
                    setLines(next);
                  }} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="sila-btn-group">
          <button type="button" className="sila-btn sila-btn--primary" onClick={onSave}>Save plan</button>
          <button type="button" className="sila-btn sila-btn--secondary" onClick={onConfirm}>Confirm plan</button>
          <button type="button" className="sila-btn sila-btn--secondary" onClick={onCopy}>Copy plan</button>
        </div>
        <p className="sme-muted">Confirmed portions are never overwritten by a later recommendation. {lookups ? "" : ""}</p>
      </section>
    )}
  </>
);

const Demand: React.FC<{ data: MenuEnvelope; canManage: boolean; covers: string; setCovers: (v: string) => void; onManual: () => void; onPull: () => void }> = ({ data, canManage, covers, setCovers, onManual, onPull }) => (
  <section className="sila-card">
    <h2 className="sila-form-section-title">OPERA / PMS demand</h2>
    <p>Source {data.demand?.source || "MANUAL"} · {data.demand?.freshness || "UNAVAILABLE"}</p>
    <p className="sme-muted">{data.demand?.message || "No OPERA forecast available."}</p>
    {canManage && (
      <div className="sme-form">
        <div className="sila-field"><label className="sila-label">Expected guests</label><input className="sila-input" value={covers} onChange={(e) => setCovers(e.target.value)} /></div>
        <button type="button" className="sila-btn sila-btn--primary" onClick={onManual}>Save manual demand</button>
        <button type="button" className="sila-btn sila-btn--secondary" onClick={onPull}>Check OPERA adapter</button>
      </div>
    )}
    {(data.demand?.days ?? []).length === 0 ? <EmptyState title="No OPERA forecast available." /> : (
      <table className="sila-table">
        <thead><tr><th>Date</th><th>Occupancy</th><th>Guests</th><th>Covers</th><th>Shortage</th><th>Source</th></tr></thead>
        <tbody>
          {data.demand!.days.map((day) => (
            <tr key={day.businessDate}><td>{day.businessDate.slice(0, 10)}</td><td>{day.occupancyPercent ?? "—"}</td><td>{day.expectedGuests ?? "—"}</td><td>{day.expectedCovers}</td><td>{day.shortage}</td><td>{day.source} · {day.freshness}</td></tr>
          ))}
        </tbody>
      </table>
    )}
  </section>
);

const PosSales: React.FC<{ data: MenuEnvelope; csv: string; setCsv: (v: string) => void; canManage: boolean; onImport: () => void }> = ({ data, csv, setCsv, canManage, onImport }) => (
  <section className="sila-card">
    <h2 className="sila-form-section-title">POS sales</h2>
    <p>Qty {data.posSales?.qtySold ?? 0} · Revenue {data.posSales?.revenue ?? 0} · Unmapped {data.posSales?.unmappedCount ?? 0} · {data.posSales?.syncStatus}</p>
    {(data.posSales?.rows ?? []).length === 0 ? <EmptyState title="No POS sales available for this period." /> : (
      <ul className="sme-list">{data.posSales!.rows.map((row) => <li key={row.id}>{row.posCode} · {row.quantity} · {row.menuItemName || "Unmapped"} · {row.status}</li>)}</ul>
    )}
    {canManage && (
      <>
        <label className="sila-label" htmlFor="sme-csv">CSV import</label>
        <textarea id="sme-csv" className="sila-input sme-wide" rows={4} value={csv} onChange={(e) => setCsv(e.target.value)} placeholder="BusinessDate,TransactionID,LineID,POSCode,Qty,UOM,Outlet,Amount,Currency" />
        <button type="button" className="sila-btn sila-btn--secondary" onClick={onImport}>Import POS lines</button>
      </>
    )}
  </section>
);

const PosMapping: React.FC<{ data: MenuEnvelope; canManage: boolean; mappingItemId: Record<string, string>; setMappingItemId: (v: Record<string, string>) => void; onMap: (id: string, menuItemId: string) => void }> = ({ data, canManage, mappingItemId, setMappingItemId, onMap }) => (
  <section className="sila-card">
    <h2 className="sila-form-section-title">POS → Menu Item</h2>
    {(data.posMappings?.items ?? []).length === 0 ? <EmptyState title="No unmapped POS items." /> : data.posMappings!.items.map((row) => (
      <div key={row.id} className="sme-row">
        <div><strong>{row.posCode}</strong><div className="sme-muted">{row.posDescription || row.outletName || "—"} · {row.status}{row.suggestedMenuItemName ? ` · Suggested ${row.suggestedMenuItemName}` : ""}</div></div>
        {canManage && (
          <div className="sila-btn-group">
            <select className="sila-input" value={mappingItemId[row.id] ?? row.menuItemId ?? ""} onChange={(e) => setMappingItemId({ ...mappingItemId, [row.id]: e.target.value })}>
              <option value="">Select menu item</option>
              {(data.items?.items ?? data.lookups?.recipes ?? []).map((option) => "menuItemCode" in (option as object) ? <option key={(option as MenuItemDetail).id} value={(option as MenuItemDetail).id}>{(option as MenuItemDetail).name}</option> : null)}
              {(data.lookups?.recipes ?? []).length >= 0 && (data.items?.items ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
            </select>
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => onMap(row.id, mappingItemId[row.id] || row.suggestedMenuItemId || "")}>Confirm mapping</button>
          </div>
        )}
      </div>
    ))}
  </section>
);

const Performance: React.FC<{ data: MenuEnvelope }> = ({ data }) => (
  <section className="sila-card">
    <p>Stars {data.performance?.stars ?? 0} · Plowhorses {data.performance?.plowhorses ?? 0} · Puzzles {data.performance?.puzzles ?? 0} · Dogs {data.performance?.dogs ?? 0}</p>
    {(data.performance?.rows ?? []).length === 0 ? <EmptyState title="No Menu Items require analysis." description="POS sales mapped to menu items appear here." /> : (
      <table className="sila-table">
        <thead><tr><th>Item</th><th>Qty</th><th>Revenue</th><th>Food cost</th><th>Margin</th><th>Class</th></tr></thead>
        <tbody>{data.performance!.rows.map((row) => <tr key={row.menuItemId}><td>{row.name}</td><td>{row.qtySold}</td><td>{row.revenue}</td><td>{row.foodCostPercent == null ? row.costState : `${Math.round(row.foodCostPercent * 100)}%`}</td><td>{row.contributionMargin ?? "—"}</td><td>{row.classification}</td></tr>)}</tbody>
      </table>
    )}
  </section>
);

const Consumption: React.FC<{ data: MenuEnvelope }> = ({ data }) => (
  <section className="sila-card">
    <p>Theoretical {data.consumption?.theoretical ?? 0} · Actual {data.consumption?.actual ?? 0} · Variance {data.consumption?.variance ?? 0}</p>
    {(data.consumption?.rows ?? []).length === 0 ? <EmptyState title="No consumption variance found." description="Recipe required before theoretical consumption can be calculated." /> : (
      <table className="sila-table">
        <thead><tr><th>Material</th><th>Theoretical</th><th>Actual</th><th>Variance</th></tr></thead>
        <tbody>{data.consumption!.rows.map((row, index) => <tr key={index}><td>{row.materialName}<div className="sme-muted">{row.menuItemName}</div></td><td>{row.theoreticalQty} {row.uom}</td><td>{row.actualQty}</td><td>{row.varianceQty}</td></tr>)}</tbody>
      </table>
    )}
  </section>
);

const Cost: React.FC<{ data: MenuEnvelope }> = ({ data }) => (
  <section className="sila-card">
    {(data.costMargin?.rows ?? data.performance?.rows ?? []).length === 0 ? <EmptyState title="Material cost is unavailable." description="Cost is not invented when the recipe has no authoritative cost." /> : (
      <table className="sila-table">
        <thead><tr><th>Item</th><th>Price</th><th>Cost / portion</th><th>Food cost</th><th>Margin</th></tr></thead>
        <tbody>{(data.costMargin?.rows ?? data.performance?.rows ?? []).map((row) => <tr key={row.menuItemId}><td>{row.name}</td><td>{row.sellingPrice ?? "—"}</td><td>{row.costPerPortion ?? row.costState}</td><td>{row.foodCostPercent == null ? "—" : `${Math.round(row.foodCostPercent * 100)}%`}</td><td>{row.contributionMargin ?? "—"}</td></tr>)}</tbody>
      </table>
    )}
  </section>
);

const Recommendations: React.FC<{ data: MenuEnvelope; canRequestPurchase: boolean; onOpenRecs: () => void }> = ({ data, canRequestPurchase, onOpenRecs }) => (
  <section className="sila-card">
    <h2 className="sila-form-section-title">Menu demand vs inventory and open PO</h2>
    {(data.requirements?.rows ?? data.recommendations?.menuDemand ?? []).length === 0 ? <EmptyState title="No Menu Items require purchase." /> : (
      <table className="sila-table">
        <thead><tr><th>Material</th><th>Need</th><th>Available</th><th>Open PO</th><th>Shortage</th></tr></thead>
        <tbody>{(data.requirements?.rows ?? data.recommendations?.menuDemand ?? []).map((row, index) => <tr key={index}><td>{row.materialName}</td><td>{row.requirement} {row.uom}</td><td>{row.available}</td><td>{row.openPo}</td><td>{row.shortage}</td></tr>)}</tbody>
      </table>
    )}
    {canRequestPurchase && <button type="button" className="sila-btn sila-btn--primary" onClick={onOpenRecs}>Open existing purchase recommendations</button>}
    <p className="sme-muted">Downstream purchasing stays on the existing recommendation → PR → PO path. PO is never auto-created.</p>
  </section>
);

const Intelligence: React.FC<{ data: MenuEnvelope }> = ({ data }) => (
  <section className="sila-card">
    {(data.intelligence?.insights ?? data.dashboard?.insights ?? []).length === 0 ? <EmptyState title="No AI insight available for the selected period." /> : (
      <ul className="sme-list">{(data.intelligence?.insights ?? data.dashboard?.insights ?? []).map((row, index) => (
        <li key={index}><strong>{row.category}</strong> · {row.title}<div className="sme-muted">{row.reason} {row.recommendedAction}</div></li>
      ))}</ul>
    )}
    <p className="sme-muted">AI is advisory only. It cannot post ERP transactions.</p>
  </section>
);

const WhatIf: React.FC<{ result?: MenuEnvelope["simulation"]; values: Record<string, string>; setValues: (v: Record<string, string>) => void; onRun: () => void }> = ({ result, values, setValues, onRun }) => (
  <section className="sila-card">
    <div className="sme-form">
      {[["occupancy", "Occupancy %"], ["covers", "Expected covers"], ["portion", "Portion factor"], ["price", "Price factor"], ["cost", "Cost factor"]].map(([key, label]) => (
        <div className="sila-field" key={key}><label className="sila-label">{label}</label><input className="sila-input" value={values[key]} onChange={(e) => setValues({ ...values, [key]: e.target.value })} /></div>
      ))}
    </div>
    <button type="button" className="sila-btn sila-btn--primary" onClick={onRun}>Run simulation</button>
    {result ? <p>Portions {result.recommendedPortions} · Requirement {result.ingredientRequirement} · Shortage {result.shortage} · Margin {result.contributionMargin}. {result.note}</p> : <EmptyState title="Simulation does not change live operational data." />}
  </section>
);

const Setup: React.FC<{ data: MenuEnvelope; canManage: boolean; onSave: (settings: NonNullable<MenuEnvelope["settings"]>) => void }> = ({ data, canManage, onSave }) => {
  const [settings, setSettings] = useState(data.settings ?? {
    defaultMealParticipation: 0.7, defaultItemParticipation: 0.2, defaultBufferPercentage: 0.1, defaultAdultFactor: 1, defaultChildFactor: 0.6, popularityThreshold: 0.7, highFoodCostPercent: 0.35, staleHours: 24, mealPeriods: [], categories: [], pmsProvider: "OPERA"
  });
  return (
    <section className="sila-card">
      <p className="sme-muted">Material, Recipe, UOM and ERP setup stay in their existing Setup screens.</p>
      <div className="sme-form">
        <div className="sila-field"><label className="sila-label">Meal participation</label><input className="sila-input" type="number" value={settings.defaultMealParticipation} onChange={(e) => setSettings({ ...settings, defaultMealParticipation: Number(e.target.value) })} /></div>
        <div className="sila-field"><label className="sila-label">Item participation</label><input className="sila-input" type="number" value={settings.defaultItemParticipation} onChange={(e) => setSettings({ ...settings, defaultItemParticipation: Number(e.target.value) })} /></div>
        <div className="sila-field"><label className="sila-label">Buffer</label><input className="sila-input" type="number" value={settings.defaultBufferPercentage} onChange={(e) => setSettings({ ...settings, defaultBufferPercentage: Number(e.target.value) })} /></div>
        <div className="sila-field"><label className="sila-label">Popularity threshold</label><input className="sila-input" type="number" value={settings.popularityThreshold} onChange={(e) => setSettings({ ...settings, popularityThreshold: Number(e.target.value) })} /></div>
        <div className="sila-field"><label className="sila-label">High food cost</label><input className="sila-input" type="number" value={settings.highFoodCostPercent} onChange={(e) => setSettings({ ...settings, highFoodCostPercent: Number(e.target.value) })} /></div>
        <div className="sila-field"><label className="sila-label">PMS provider</label><input className="sila-input" value={settings.pmsProvider ?? "OPERA"} onChange={(e) => setSettings({ ...settings, pmsProvider: e.target.value })} /></div>
        <div className="sila-field"><label className="sila-label">OPERA connection name</label><input className="sila-input" value={settings.pmsConnectionName ?? ""} onChange={(e) => setSettings({ ...settings, pmsConnectionName: e.target.value })} /></div>
        <div className="sila-field"><label className="sila-label">POS connection name</label><input className="sila-input" value={settings.posConnectionName ?? ""} onChange={(e) => setSettings({ ...settings, posConnectionName: e.target.value })} /></div>
      </div>
      {canManage && <button type="button" className="sila-btn sila-btn--primary" onClick={() => onSave(settings)}>Save setup</button>}
    </section>
  );
};

export default SilaMenuEngineeringApp;
