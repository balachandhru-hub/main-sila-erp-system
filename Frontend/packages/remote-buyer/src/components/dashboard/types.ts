/** Which RFQ screen the dashboard is showing. */
export type RfqPageView = "dashboard" | "allRfqs" | "rfqDetail" | "qsAns" | "quotationComparison";

export interface MatchCard {
  location: string;
  initials: string;
  name: string;
  seeking: string;
  description: string;
  representative: string;
  actionLabel: string;
  actionVariant: "message" | "interest";
  website: string;
  repTitle: string;
  repEmail: string;
  revenue: string;
  employees: string;
  categoryNote: string;
  destinationNote: string;
}
