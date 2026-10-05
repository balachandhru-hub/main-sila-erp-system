/* Response shapes of the dashboard analytics endpoints:
   GET /api/v1/buyer/dashboard-analytics    → BuyerDashboardAnalyticsDto
   GET /api/v1/supplier/dashboard-analytics → SupplierDashboardAnalyticsDto
   Count-only by design: RFQs use many currencies (some none), so money is not totalled. */

export interface DashboardBreakdown {
  key: string;
  label: string;
  count: number;
  /** Items still waiting on the user (supplier closing schedule only). */
  pendingCount?: number;
}

export interface BuyerDashboardKpis {
  totalRfqs: number;
  liveRfqs: number;
  closingThisWeek: number;
  awaitingAward: number;
  awardedRfqs: number;
  awardRate: number;
  suppliersEngaged: number;
  contracts: number;
  activeContracts: number;
}

export interface BuyerMonthlyTrend {
  month: string;
  created: number;
  awarded: number;
}

export interface BuyerUpcomingDeadline {
  rfqId: string;
  rfqNumber: string;
  title: string;
  department: string;
  endDate: string;
  invitedSuppliers: number;
}

export interface BuyerDashboardAnalytics {
  kpis: BuyerDashboardKpis;
  monthlyTrend: BuyerMonthlyTrend[];
  statusBreakdown: DashboardBreakdown[];
  rfqsByDepartment: DashboardBreakdown[];
  contractsBySupplier: DashboardBreakdown[];
  closingSchedule: DashboardBreakdown[];
  upcomingDeadlines: BuyerUpcomingDeadline[];
}

export interface SupplierDashboardKpis {
  invitations: number;
  openForBidding: number;
  actionRequired: number;
  quotationsSubmitted: number;
  awaitingDecision: number;
  rfqsWon: number;
  rfqsNotAwarded: number;
  winRate: number;
}

export interface SupplierMonthlyTrend {
  month: string;
  invited: number;
  quoted: number;
  won: number;
}

export interface SupplierUpcomingDeadline {
  supplierRfqId: string;
  buyerRfqId: string;
  rfqNumber: string;
  title: string;
  buyerName: string;
  endDate: string;
  quotationSubmitted: boolean;
}

export interface SupplierDashboardAnalytics {
  kpis: SupplierDashboardKpis;
  monthlyTrend: SupplierMonthlyTrend[];
  stageBreakdown: DashboardBreakdown[];
  pipeline: DashboardBreakdown[];
  quotationsByBuyer: DashboardBreakdown[];
  closingSchedule: DashboardBreakdown[];
  upcomingDeadlines: SupplierUpcomingDeadline[];
}
