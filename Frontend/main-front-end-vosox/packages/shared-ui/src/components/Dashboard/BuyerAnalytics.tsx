import React from 'react';
import type { AsyncDataState } from '../../hooks/useAsyncData';
import type { BuyerDashboardAnalytics } from '../../types/dashboardAnalytics';
import { BarList, ChartCard, ColumnChart, GroupedColumnChart, formatMonth } from '../Charts';
import { KpiStrip } from '../KpiStrip';
import { EmptyState } from '../EmptyState';
import { AnalyticsNotice, AnalyticsSkeleton, DueIn } from './AnalyticsParts';
import { emptyBuyerAnalytics } from './emptyAnalytics';

export interface BuyerAnalyticsProps {
  state: AsyncDataState<BuyerDashboardAnalytics>;
  /** Opens the list of RFQs (from the "Live RFQs" KPI). */
  onViewRfqs?: () => void;
  /** Opens one RFQ (from the deadlines table). */
  onOpenRfq?: (rfqId: string) => void;
}

const icon = (path: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const Icons = {
  live: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  total: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>),
  awaiting: icon(<><path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2" /></>),
  award: icon(<><circle cx="12" cy="8" r="6" /><path d="M8.2 13.4 7 22l5-3 5 3-1.2-8.6" /></>),
  suppliers: icon(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8" /></>),
  contract: icon(<><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></>),
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Buyer dashboard analytics (counts only): KPIs, 12-month activity, pipeline, schedule, departments, contracts, deadlines. */
export const BuyerAnalytics: React.FC<BuyerAnalyticsProps> = ({ state, onViewRfqs, onOpenRfq }) => {
  if (state.loading && !state.data) return <AnalyticsSkeleton />;
  // Without data (e.g. endpoint not deployed) keep the full layout, zero-filled, under a notice.
  const data = state.data ?? emptyBuyerAnalytics();
  const unavailable = !state.data && Boolean(state.error);
  const { kpis, monthlyTrend, statusBreakdown, rfqsByDepartment, contractsBySupplier, closingSchedule, upcomingDeadlines } = data;

  return (
    <div className="sila-analytics">
      {unavailable && <AnalyticsNotice onRetry={state.reload} />}

      <KpiStrip
        label="Sourcing summary"
        className="sila-kpi-strip--cards"
        items={[
          {
            key: 'live',
            label: 'Live RFQs',
            value: kpis.liveRfqs,
            icon: Icons.live,
            attention: kpis.closingThisWeek > 0 ? `${kpis.closingThisWeek} closing this week` : undefined,
            caption: 'View RFQs',
            onClick: onViewRfqs,
          },
          { key: 'total', label: 'Total RFQs', value: kpis.totalRfqs, icon: Icons.total, caption: 'All time' },
          { key: 'awaiting', label: 'Awaiting award', value: kpis.awaitingAward, icon: Icons.awaiting, tone: 'warning', caption: 'Bidding frozen or closed' },
          { key: 'awarded', label: 'Awarded', value: kpis.awardedRfqs, icon: Icons.award, tone: 'success', caption: `${kpis.awardRate}% of closed RFQs` },
          { key: 'suppliers', label: 'Suppliers engaged', value: kpis.suppliersEngaged, icon: Icons.suppliers, caption: 'Invited across RFQs' },
          { key: 'contracts', label: 'Contracts', value: kpis.contracts, icon: Icons.contract, caption: `${kpis.activeContracts} active` },
        ]}
      />

      <div className="sila-dash-grid">
        <ChartCard className="sila-span-8" title="Sourcing activity" subtitle="RFQs created and awarded per month, last 12 months">
          <GroupedColumnChart
            data={monthlyTrend.map((m) => ({ month: m.month, created: m.created, awarded: m.awarded }))}
            categoryKey="month"
            series={[
              { key: 'created', label: 'Created' },
              { key: 'awarded', label: 'Awarded' },
            ]}
            formatCategory={(month, index) => formatMonth(month, index === 0)}
          />
        </ChartCard>

        <ChartCard className="sila-span-4" title="RFQ pipeline" subtitle="Every RFQ by lifecycle stage">
          <BarList preserveOrder items={statusBreakdown.map((s) => ({ key: s.key, label: s.label, value: s.count }))} />
        </ChartCard>

        <ChartCard className="sila-span-4" title="Closing schedule" subtitle="Live RFQs by days until bidding closes">
          <ColumnChart
            valueLabel="RFQs"
            height={200}
            data={closingSchedule.map((w) => ({ key: w.key, label: w.label, value: w.count }))}
          />
        </ChartCard>

        <ChartCard
          className="sila-span-4"
          title="RFQs by department"
          subtitle="Departments raising the most RFQs"
          empty={rfqsByDepartment.length === 0}
          emptyText="No RFQs yet."
        >
          <BarList items={rfqsByDepartment.map((d) => ({ key: d.key, label: d.label, value: d.count, display: plural(d.count, 'RFQ') }))} />
        </ChartCard>

        <ChartCard
          className="sila-span-4"
          title="Contracts by supplier"
          subtitle="Suppliers holding the most contracts"
          empty={contractsBySupplier.length === 0}
          emptyText="No contracts yet."
        >
          <BarList
            items={contractsBySupplier.map((s) => ({ key: s.key, label: s.label, value: s.count, display: plural(s.count, 'contract') }))}
          />
        </ChartCard>

        <section className="sila-card sila-span-12" aria-labelledby="buyer-deadlines-title">
          <div className="sila-card-header">
            <div>
              <h2 id="buyer-deadlines-title" className="sila-card-title">Upcoming deadlines</h2>
              <p className="sila-card-subtitle">Live RFQs closing soonest</p>
            </div>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <EmptyState title="Nothing is closing soon" description="Live RFQs will appear here as their closing dates approach." />
          ) : (
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">RFQ</th>
                    <th scope="col">Title</th>
                    <th scope="col">Department</th>
                    <th scope="col">Closes</th>
                    <th scope="col" className="sila-num">Suppliers invited</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingDeadlines.map((d) => (
                    <tr
                      key={d.rfqId}
                      className={onOpenRfq ? 'sila-row-clickable' : undefined}
                      tabIndex={onOpenRfq ? 0 : undefined}
                      onClick={onOpenRfq ? () => onOpenRfq(d.rfqId) : undefined}
                      onKeyDown={
                        onOpenRfq
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenRfq(d.rfqId);
                              }
                            }
                          : undefined
                      }
                    >
                      <td><span className="sila-ref">{d.rfqNumber}</span></td>
                      <td className="sila-cell-strong">{d.title}</td>
                      <td className="sila-cell-muted">{d.department}</td>
                      <td><DueIn endDate={d.endDate} /></td>
                      <td className="sila-num">{d.invitedSuppliers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default BuyerAnalytics;
