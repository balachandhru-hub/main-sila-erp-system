import type {
  BuyerDashboardAnalytics,
  DashboardBreakdown,
  SupplierDashboardAnalytics,
} from '../../types/dashboardAnalytics';

/* Zero-filled analytics shown when the endpoint cannot be reached, so the dashboard keeps its
   full layout (axes, stages, buckets) instead of collapsing to an error card. Buckets and stage
   names mirror the backend constants in Buyer/Supplier Common.cs. */

const lastTwelveMonths = (): string[] => {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
};

const zeroed = (labels: string[]): DashboardBreakdown[] =>
  labels.map((label) => ({ key: label.toUpperCase().replace(/\s+/g, '_'), label, count: 0 }));

const CLOSING_WINDOWS: DashboardBreakdown[] = [
  { key: 'THIS_WEEK', label: '0–7 days', count: 0 },
  { key: 'NEXT_WEEK', label: '8–14 days', count: 0 },
  { key: 'TWO_TO_FOUR_WEEKS', label: '15–30 days', count: 0 },
  { key: 'LATER', label: '30+ days', count: 0 },
];

export const emptyBuyerAnalytics = (): BuyerDashboardAnalytics => ({
  kpis: {
    totalRfqs: 0,
    liveRfqs: 0,
    closingThisWeek: 0,
    awardedRfqs: 0,
    awardRate: 0,
    awaitingAward: 0,
    suppliersEngaged: 0,
    contracts: 0,
    activeContracts: 0,
  },
  monthlyTrend: lastTwelveMonths().map((month) => ({ month, created: 0, awarded: 0 })),
  statusBreakdown: zeroed(['Upcoming', 'Live', 'Frozen', 'Bidding closed', 'Awarded']),
  rfqsByDepartment: [],
  contractsBySupplier: [],
  closingSchedule: CLOSING_WINDOWS.map((w) => ({ ...w })),
  upcomingDeadlines: [],
});

export const emptySupplierAnalytics = (): SupplierDashboardAnalytics => ({
  kpis: {
    invitations: 0,
    openForBidding: 0,
    actionRequired: 0,
    quotationsSubmitted: 0,
    rfqsWon: 0,
    winRate: 0,
    awaitingDecision: 0,
    rfqsNotAwarded: 0,
  },
  monthlyTrend: lastTwelveMonths().map((month) => ({ month, invited: 0, quoted: 0, won: 0 })),
  stageBreakdown: zeroed(['Upcoming', 'Open', 'Quoted', 'Frozen', 'Closed', 'Won', 'Not awarded']),
  pipeline: zeroed(['Invited', 'Quoted', 'Won']),
  quotationsByBuyer: [],
  closingSchedule: CLOSING_WINDOWS.map((w) => ({ ...w })),
  upcomingDeadlines: [],
});
