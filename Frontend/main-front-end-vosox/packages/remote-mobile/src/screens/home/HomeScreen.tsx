import React from 'react';
import { getInventoryHome, getRecentAlerts } from '../../../../remote-buyer/src/api/silaMe/silaInventoryApi';
import ScreenHeader from '../../components/ScreenHeader';
import LocationPicker from '../../components/LocationPicker';
import { Empty, ErrorNotice, Loading, OfflineBanner } from '../../components/StateViews';
import { firstNameOf, initialsOf, useAccess } from '../../access';
import { useMyLocation } from '../../location';
import { useGo } from '../../navigation';
import { useLoad } from '../../useLoad';
import { isGrnException, isGrnPending, loadRecentGrns } from '../receive/grnStatus';
import HomeAttention from './HomeAttention';

interface QuickAction {
  label: string;
  icon: string;
  to: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Scan Invoice', icon: '⎙', to: 'receive/scan' },
  { label: 'Receive Goods', icon: '⇩', to: 'receive/pos?mode=receive' },
  { label: 'Live Stock', icon: '▦', to: 'inventory/stock' },
  { label: 'Raise ITO', icon: '⇄', to: 'inventory/transfers/new' },
  { label: 'Stock Count', icon: '☑', to: 'inventory/counts' },
  { label: 'Quick Transfer', icon: '➜', to: 'inventory/transfers/new?mode=quick' },
];

/** Same wording as the prototype (Good Morning / Afternoon / Evening). */
const greeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const HomeScreen: React.FC = () => {
  const go = useGo();
  const { person } = useAccess();
  const { locations, location, setLocationId, loading: locLoading, error: locError, reload: reloadLocations } = useMyLocation();
  const summary = useLoad(() => getInventoryHome(location?.id), location ? `home-${location.id}` : null);
  const alerts = useLoad(() => getRecentAlerts(5), 'alerts');
  const grns = useLoad(() => loadRecentGrns(30), 'recent-grns');

  const count = (value: number | undefined, loading: boolean): string => (loading ? '…' : value === undefined ? '—' : String(value));
  const pendingGrns = grns.data ? grns.data.filter(isGrnPending).length : undefined;
  const cards: { label: string; value: string; to: string; alert?: boolean }[] = [
    { label: 'Pending GRNs', value: count(pendingGrns, grns.loading), to: 'receive/pending', alert: (pendingGrns ?? 0) > 0 },
    { label: 'Approvals', value: count(summary.data?.pendingTransferApprovals, summary.loading), to: 'inventory/transfers?tab=to-approve' },
    { label: 'Stock Count Tasks', value: count(summary.data?.openStockCounts, summary.loading), to: 'inventory/counts' },
    { label: 'Pending ITO', value: count(summary.data?.inTransitToReceive, summary.loading), to: 'inventory/transfers?tab=in-transit' },
    { label: 'Enquiries', value: count(summary.data?.openEnquiries, summary.loading), to: 'tasks' },
    { label: 'Low Stock Items', value: count(summary.data?.lowStockItems, summary.loading), to: 'tasks/alerts' },
  ];
  const name = firstNameOf(person);

  return (
    <>
      <ScreenHeader
        title={`${greeting()}${name ? `, ${name}` : ''}`}
        aside={
          <button type="button" className="sm-avatar" aria-label="Profile" onClick={() => go('more/profile')}>
            {initialsOf(person) || '•'}
          </button>
        }
      />
      <div className="sm-screen">
        <OfflineBanner />
        <section className="sm-home-head" aria-label="Organization">
          {person?.organizationName && <p className="sm-org">{person.organizationName}</p>}
          {location && <p className="sm-muted">{location.locationName} · {location.propertyName}</p>}
        </section>

        {locLoading && <Loading text="Loading your locations…" />}
        {locError && <ErrorNotice message={locError} onRetry={reloadLocations} />}
        {!locLoading && !locError && locations.length === 0 && (
          <Empty text="No location assigned." description="You are not assigned to a store or outlet yet. Ask your administrator to assign you." />
        )}
        {location && locations.length > 1 && (
          <LocationPicker label="My location" locations={locations} value={location.id} onChange={setLocationId} />
        )}

        <section className="sm-section" aria-labelledby="sm-quick">
          <h2 id="sm-quick">Quick actions</h2>
          <div className="sm-grid-3">
            {QUICK_ACTIONS.map((action) => (
              <button key={action.label} type="button" className="sm-action" onClick={() => go(action.to)}>
                <span className="sm-action__icon" aria-hidden="true">
                  {action.icon}
                </span>
                {action.label}
              </button>
            ))}
          </div>
        </section>

        <section className="sm-section" aria-labelledby="sm-summary">
          <h2 id="sm-summary">Today{location ? ` · ${location.locationName}` : ''}</h2>
          {summary.error && <ErrorNotice message={summary.error} onRetry={summary.reload} />}
          <div className="sm-grid-3">
            {cards.map((card) => (
              <button key={card.label} type="button" className={`sm-stat${card.alert ? ' sm-stat--alert' : ''}`} onClick={() => go(card.to)}>
                <strong>{card.value}</strong>
                <span className="sm-muted">{card.label}</span>
              </button>
            ))}
          </div>
        </section>

        <HomeAttention
          failedGrns={(grns.data ?? []).filter(isGrnException).slice(0, 5)}
          grnsError={grns.error}
          onRetryGrns={grns.reload}
          alerts={alerts.data ?? []}
          alertsLoading={alerts.loading || grns.loading}
          alertsError={alerts.error}
          onRetryAlerts={alerts.reload}
        />

        <button type="button" className="sm-search-entry" aria-label="Global search" onClick={() => go('search')}>
          <span aria-hidden="true">⌕</span>
          <span>Search suppliers, POs, GRNs…</span>
        </button>
      </div>
    </>
  );
};

export default HomeScreen;
