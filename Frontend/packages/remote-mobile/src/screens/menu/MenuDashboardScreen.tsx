import React from 'react';
import { getMenuEngineering } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import StatusBadge from '../../components/StatusBadge';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { MENU_VIEWS } from './menuViews';

const today = (): string => new Date().toISOString().slice(0, 10);

const MenuDashboardScreen: React.FC = () => {
  const go = useGo();
  const { can } = useAccess();
  const date = today();
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('dashboard', { dateFrom: date, dateTo: date }),
    can.viewMenuEngineering ? `menu-dash-${date}` : null,
  );
  const dash = data?.dashboard;

  const routeFor = (kind?: string): string => {
    if (kind === 'RECIPE_MISSING' || kind === 'COST_MISSING') return 'menu/items';
    if (kind === 'POS_UNMAPPED') return 'menu/mapping';
    if (kind === 'SHORTAGE' || kind === 'PURCHASE') return 'menu/recommendations';
    if (kind === 'VARIANCE' || kind === 'CONSUMPTION') return 'menu/consumption';
    if (kind === 'PMS_STALE' || kind === 'DEMAND') return 'menu/demand';
    return 'menu';
  };

  return (
    <>
      <ScreenHeader title="Menu Engineering" eyebrow="SILA ME" intro="Today's occupancy, covers, portions and attention." />
      <div className="sm-screen">
        <OfflineBanner />
        {loading && <Loading text="Loading Menu Engineering…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {!loading && !dash && !error && (
          <Empty text="No Menu Plan configured." description="Create a menu item, then plan today's meal." />
        )}
        {dash && (
          <>
            <div className="sm-grid-2">
              <button type="button" className="sm-stat" onClick={() => go('menu/demand')}>
                <span className="sm-muted">Occupancy</span>
                <strong>{dash.occupancyPercent == null ? '—' : `${dash.occupancyPercent}%`}</strong>
              </button>
              <button type="button" className="sm-stat" onClick={() => go('menu/demand')}>
                <span className="sm-muted">Expected guests</span>
                <strong>{dash.expectedGuests ?? '—'}</strong>
              </button>
              <button type="button" className="sm-stat" onClick={() => go('menu/demand')}>
                <span className="sm-muted">Expected covers</span>
                <strong>{dash.expectedCovers}</strong>
              </button>
              <button type="button" className="sm-stat" onClick={() => go('menu/portions')}>
                <span className="sm-muted">Planned portions</span>
                <strong>{dash.plannedPortions}</strong>
              </button>
              <button type="button" className="sm-stat" onClick={() => go('menu/recommendations')}>
                <span className="sm-muted">Forecast shortage</span>
                <strong>{dash.forecastShortage}</strong>
              </button>
              <button type="button" className="sm-stat" onClick={() => go('menu/consumption')}>
                <span className="sm-muted">Consumption variance</span>
                <strong>{dash.consumptionVariance}</strong>
              </button>
            </div>
            <p className="sm-meta">
              Source {dash.occupancySource || 'MANUAL'} · {dash.occupancyFreshness || 'UNAVAILABLE'}
            </p>

            <section className="sm-section">
              <h2>Today's menus</h2>
              {dash.todayMenus.length === 0 && <Empty text="No Menu Plan configured." description="Create a plan for this date." />}
              <ul className="sm-list">
                {dash.todayMenus.map((plan) => (
                  <li key={plan.id}>
                    <button type="button" className="sm-list-btn" onClick={() => go('menu/planning')}>
                      <span className="sm-row">
                        <strong>{plan.name}</strong>
                        <StatusBadge status={plan.status} />
                      </span>
                      <span className="sm-meta">{plan.mealPeriod || 'Meal'} · {plan.lineCount} items · {plan.missingRecipes} missing recipes</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sm-section">
              <h2>Menu mix</h2>
              <div className="sm-grid-2">
                <button type="button" className="sm-stat" onClick={() => go('menu/performance')}><span className="sm-muted">Stars</span><strong>{dash.stars}</strong></button>
                <button type="button" className="sm-stat" onClick={() => go('menu/performance')}><span className="sm-muted">Plowhorses</span><strong>{dash.plowhorses}</strong></button>
                <button type="button" className="sm-stat" onClick={() => go('menu/performance')}><span className="sm-muted">Puzzles</span><strong>{dash.puzzles}</strong></button>
                <button type="button" className="sm-stat" onClick={() => go('menu/performance')}><span className="sm-muted">Dogs</span><strong>{dash.dogs}</strong></button>
              </div>
            </section>

            <section className="sm-section">
              <h2>Attention required</h2>
              {dash.attention.length === 0 && <Empty text="No items require attention." />}
              <ul className="sm-list">
                {dash.attention.map((row, index) => (
                  <li key={`${row.kind}-${index}`}>
                    <button type="button" className="sm-list-btn" onClick={() => go(routeFor(row.kind))}>
                      <span className="sm-row">
                        <strong>{row.title}</strong>
                        <StatusBadge status={row.priority} />
                      </span>
                      <span className="sm-meta">{row.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <section className="sm-section">
              <h2>AI recommendations</h2>
              {dash.insights.length === 0 && <Empty text="No AI insight available for the selected period." />}
              <ul className="sm-list">
                {dash.insights.slice(0, 6).map((row, index) => (
                  <li key={index}>
                    <button type="button" className="sm-list-btn" onClick={() => go('menu/intelligence')}>
                      <span className="sm-row"><strong>{row.title}</strong><span className="sm-meta">{row.category}</span></span>
                      <span className="sm-meta">{row.reason}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}

        <section className="sm-section">
          <h2>Menu Engineering</h2>
          <ul className="sm-list">
            {MENU_VIEWS.filter((row) => row.path !== 'menu').map((row) => (
              <li key={row.path}>
                <button type="button" className="sm-list-btn" onClick={() => go(row.path)}>
                  <span className="sm-row"><strong>{row.title}</strong><span aria-hidden="true">›</span></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
};

export default MenuDashboardScreen;
