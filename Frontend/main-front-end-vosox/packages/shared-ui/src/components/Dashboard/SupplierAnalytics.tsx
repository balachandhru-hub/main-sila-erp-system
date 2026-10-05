import React from 'react';
import type { AsyncDataState } from '../../hooks/useAsyncData';
import type { SupplierDashboardAnalytics } from '../../types/dashboardAnalytics';
import { BarList, ChartCard, ColumnChart, FunnelChart, GroupedColumnChart, formatMonth } from '../Charts';
import { KpiStrip } from '../KpiStrip';
import { EmptyState } from '../EmptyState';
import { StatusBadge } from '../StatusBadge';
import { AnalyticsNotice, AnalyticsSkeleton, DueIn } from './AnalyticsParts';
import { emptySupplierAnalytics } from './emptyAnalytics';

export interface SupplierAnalyticsProps {
  state: AsyncDataState<SupplierDashboardAnalytics>;
  /** Opens the list of RFQ invitations (from the "Open for bidding" KPI). */
  onViewRfqs?: () => void;
  /** Opens one invitation by its buyer RFQ id (from the deadlines table). */
  onOpenRfq?: (buyerRfqId: string) => void;
}

const icon = (path: React.ReactNode) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const Icons = {
  open: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  invites: icon(<><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></>),
  quoted: icon(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M9 15l2 2 4-4" /></>),
  awaiting: icon(<><path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2" /></>),
  won: icon(<><circle cx="12" cy="8" r="6" /><path d="M8.2 13.4 7 22l5-3 5 3-1.2-8.6" /></>),
  lost: icon(<><circle cx="12" cy="12" r="9" /><path d="m15 9-6 6M9 9l6 6" /></>),
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Supplier dashboard analytics (counts only): KPIs, 12-month bidding activity, funnel, schedule, stages, buyers, deadlines. */
export const SupplierAnalytics: React.FC<SupplierAnalyticsProps> = ({ state, onViewRfqs, onOpenRfq }) => {
  if (state.loading && !state.data) return <AnalyticsSkeleton />;
  // Without data (e.g. endpoint not deployed) keep the full layout, zero-filled, under a notice.
  const data = state.data ?? emptySupplierAnalytics();
  const unavailable = !state.data && Boolean(state.error);
  const { kpis, monthlyTrend, stageBreakdown, pipeline, quotationsByBuyer, closingSchedule, upcomingDeadlines } = data;

  return (
    <div className="sila-analytics">
      {unavailable && <AnalyticsNotice onRetry={state.reload} />}

      <KpiStrip
        label="Bidding summary"
        className="sila-kpi-strip--cards"
        items={[
          {
            key: 'open',
            label: 'Open for bidding',
            value: kpis.openForBidding,
            icon: Icons.open,
            attention: kpis.actionRequired > 0 ? `${kpis.actionRequired} due this week, not quoted` : undefined,
            caption: 'View RFQs',
            onClick: onViewRfqs,
          },
          { key: 'invites', label: 'Invitations', value: kpis.invitations, icon: Icons.invites, caption: 'All time' },
          { key: 'quoted', label: 'Quotations submitted', value: kpis.quotationsSubmitted, icon: Icons.quoted, caption: 'RFQs quoted on' },
          { key: 'awaiting', label: 'Awaiting decision', value: kpis.awaitingDecision, icon: Icons.awaiting, tone: 'warning', caption: 'Quoted, bidding over' },
          { key: 'won', label: 'RFQs won', value: kpis.rfqsWon, icon: Icons.won, tone: 'success', caption: `${kpis.winRate}% win rate` },
          { key: 'lost', label: 'Not awarded', value: kpis.rfqsNotAwarded, icon: Icons.lost, tone: 'danger', caption: 'Awarded to others' },
        ]}
      />

      <div className="sila-dash-grid">
        <ChartCard className="sila-span-8" title="Bidding activity" subtitle="Invitations, quotations and wins per month, last 12 months">
          <GroupedColumnChart
            data={monthlyTrend.map((m) => ({ month: m.month, invited: m.invited, quoted: m.quoted, won: m.won }))}
            categoryKey="month"
            series={[
              { key: 'invited', label: 'Invited' },
              { key: 'quoted', label: 'Quoted' },
              { key: 'won', label: 'Won' },
            ]}
            formatCategory={(month, index) => formatMonth(month, index === 0)}
          />
        </ChartCard>

        <ChartCard className="sila-span-4" title="Bid funnel" subtitle="From invitation to award">
          <FunnelChart steps={pipeline.map((p) => ({ key: p.key, label: p.label, count: p.count }))} />
        </ChartCard>

        <ChartCard className="sila-span-4" title="Closing schedule" subtitle="Open invitations by days until bidding closes">
          <ColumnChart
            valueLabel="RFQs"
            height={200}
            data={closingSchedule.map((w) => ({
              key: w.key,
              label: w.label,
              value: w.count,
              note: w.count === 0 ? undefined : (w.pendingCount ?? 0) > 0 ? `${w.pendingCount} still need a quotation` : 'All quoted',
            }))}
          />
        </ChartCard>

        <ChartCard className="sila-span-4" title="Invitations by stage" subtitle="Where each invitation stands">
          <BarList preserveOrder items={stageBreakdown.map((s) => ({ key: s.key, label: s.label, value: s.count }))} />
        </ChartCard>

        <ChartCard
          className="sila-span-4"
          title="Quotations by buyer"
          subtitle="Buyers you have quoted to most"
          empty={quotationsByBuyer.length === 0}
          emptyText="No quotations submitted yet."
        >
          <BarList items={quotationsByBuyer.map((b) => ({ key: b.key, label: b.label, value: b.count, display: plural(b.count, 'RFQ') }))} />
        </ChartCard>

        <section className="sila-card sila-span-12" aria-labelledby="supplier-deadlines-title">
          <div className="sila-card-header">
            <div>
              <h2 id="supplier-deadlines-title" className="sila-card-title">Upcoming bid deadlines</h2>
              <p className="sila-card-subtitle">Open invitations closing soonest</p>
            </div>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <EmptyState title="Nothing is closing soon" description="Open invitations will appear here as their deadlines approach." />
          ) : (
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">RFQ</th>
                    <th scope="col">Title</th>
                    <th scope="col">Buyer</th>
                    <th scope="col">Closes</th>
                    <th scope="col">Your quotation</th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingDeadlines.map((d) => (
                    <tr
                      key={d.supplierRfqId}
                      className={onOpenRfq ? 'sila-row-clickable' : undefined}
                      tabIndex={onOpenRfq ? 0 : undefined}
                      onClick={onOpenRfq ? () => onOpenRfq(d.buyerRfqId) : undefined}
                      onKeyDown={
                        onOpenRfq
                          ? (e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                onOpenRfq(d.buyerRfqId);
                              }
                            }
                          : undefined
                      }
                    >
                      <td><span className="sila-ref">{d.rfqNumber}</span></td>
                      <td className="sila-cell-strong">{d.title}</td>
                      <td>{d.buyerName}</td>
                      <td><DueIn endDate={d.endDate} /></td>
                      <td>
                        {d.quotationSubmitted ? (
                          <StatusBadge status="Submitted" size="sm" />
                        ) : (
                          <StatusBadge status="Pending" label="Not submitted" size="sm" />
                        )}
                      </td>
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

export default SupplierAnalytics;
