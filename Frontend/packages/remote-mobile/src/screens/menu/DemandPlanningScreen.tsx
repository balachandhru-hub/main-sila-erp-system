import React, { useState } from 'react';
import { getMenuEngineering, saveMenuEngineering } from '../../../../remote-buyer/src/api/silaMe/silaMenuEngineeringApi';
import ScreenHeader from '../../components/ScreenHeader';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { errorText, useLoad } from '../../useLoad';

const today = (): string => new Date().toISOString().slice(0, 10);

const DemandPlanningScreen: React.FC = () => {
  const { can } = useAccess();
  const { location } = useMyLocation();
  const [date, setDate] = useState(today());
  const [covers, setCovers] = useState('');
  const [busy, setBusy] = useState(false);
  const to = new Date(date);
  to.setDate(to.getDate() + 7);
  const { data, loading, error, reload } = useLoad(
    () => getMenuEngineering('demand', {
      dateFrom: date,
      dateTo: to.toISOString().slice(0, 10),
      outletLocationId: location?.id,
      propertyId: location?.propertyId,
    }),
    can.viewMenuEngineering ? `menu-demand-${date}-${location?.id ?? ''}` : null,
  );
  const demand = data?.demand;

  const act = async (action: string) => {
    setBusy(true);
    try {
      await saveMenuEngineering({
        action,
        demand: {
          businessDate: date,
          propertyId: location?.propertyId,
          expectedGuests: Number(covers) || undefined,
          expectedCovers: Number(covers) || undefined,
        },
      });
      reload();
    } catch (caught: unknown) {
      window.alert(errorText(caught, 'Could not save demand.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <ScreenHeader title="Demand Planning" eyebrow="Menu Engineering" back backTo="menu" intro="OPERA occupancy and covers. Values are not invented when PMS is unavailable." />
      <div className="sm-screen">
        <OfflineBanner />
        <label className="sm-field">From<input className="sm-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
        {loading && <Loading text="Loading demand…" />}
        {error && <ErrorNotice message={error} onRetry={reload} />}
        {demand && (
          <>
            <div className="sm-grid-2">
              <div className="sm-stat"><span className="sm-muted">Occupancy</span><strong>{demand.occupancyPercent ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Expected guests</span><strong>{demand.expectedGuests ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Adults</span><strong>{demand.adults ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Children</span><strong>{demand.children ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Arrivals</span><strong>{demand.arrivals ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Departures</span><strong>{demand.departures ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Stayovers</span><strong>{demand.stayovers ?? '—'}</strong></div>
              <div className="sm-stat"><span className="sm-muted">Rooms occupied</span><strong>{demand.roomsOccupied ?? '—'}</strong></div>
            </div>
            <p className="sm-meta">Source {demand.source} · {demand.freshness || 'UNAVAILABLE'} · Last sync {demand.lastSuccessfulSync || '—'}</p>
            <p className="sm-meta">{demand.message || 'No OPERA forecast available.'}</p>
          </>
        )}
        {can.manageMenuEngineering && (
          <>
            <label className="sm-field">Manual expected covers<input className="sm-input" value={covers} onChange={(e) => setCovers(e.target.value)} /></label>
            <button type="button" className="sm-btn" disabled={busy} onClick={() => act('SAVE_PMS')}>Save manual demand</button>
            <button type="button" className="sm-btn" disabled={busy} onClick={() => act('PULL_PMS')}>Check OPERA adapter</button>
            <p className="sm-meta">OPERA credentials are configured in Cloud Setup, not from this operational screen.</p>
          </>
        )}
        <section className="sm-section">
          <h2>Upcoming demand</h2>
          {(demand?.days ?? []).length === 0 && !loading && <Empty text="No OPERA forecast available." description="Enter manual covers when PMS is unavailable." />}
          <ul className="sm-list">
            {(demand?.days ?? []).map((day) => (
              <li key={day.businessDate} className="sm-list-btn">
                <span className="sm-row"><strong>{day.businessDate.slice(0, 10)}</strong><span className="sm-meta">{day.source}</span></span>
                <span className="sm-meta">
                  Occupancy {day.occupancyPercent ?? '—'} · Covers {day.expectedCovers} · Portions {day.recommendedPortions}
                  {` · Need ${day.ingredientRequirement} · Available ${day.availableInventory} · Open PO ${day.openPoCoverage} · Shortage ${day.shortage}`}
                  {` · ${day.freshness || 'UNAVAILABLE'}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
};

export default DemandPlanningScreen;
