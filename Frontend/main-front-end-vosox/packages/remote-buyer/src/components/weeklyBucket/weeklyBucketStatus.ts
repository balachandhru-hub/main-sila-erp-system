import type { WeeklyBucketApprovalStep, WeeklyBucketItem } from "../../api/weeklyBucketApi";
import { sameId } from "../cart/lineFormat";

const LABELS: Record<string, string> = {
  // Bucket
  OPEN: "Open",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  PO_CREATED: "Purchase orders created",
  PO_FAILED: "Purchase orders failed",
  REJECTED: "Rejected",
  // Approval step
  PENDING: "Pending",
  APPROVE: "Approved",
  REJECT: "Rejected",
  // Availability
  AVAILABLE: "Available",
  PARTIAL: "Partial",
  UNAVAILABLE: "Unavailable",
  UNKNOWN: "Unknown",
  // Line
  REQUESTED: "Requested",
  RECOMMENDATION_PENDING: "Recommendation pending",
  RECOMMENDATION_APPROVED: "Recommendation approved",
  EXCLUDED: "Excluded",
};

const DANGER = ["REJECTED", "REJECT", "PO_FAILED", "UNAVAILABLE", "EXCLUDED", "FAILED"];
const SUCCESS = ["APPROVED", "APPROVE", "PO_CREATED", "AVAILABLE", "RECOMMENDATION_APPROVED", "CREATED", "COMPLETED"];
const WARNING = ["PENDING_APPROVAL", "PENDING", "PARTIAL", "RECOMMENDATION_PENDING"];

export const statusLabel = (status?: string | null): string => (status ? LABELS[status] ?? status : "—");

export const statusBadgeClass = (status?: string | null): string => {
  const key = (status ?? "").toUpperCase();
  if (DANGER.includes(key)) return "sila-badge sila-badge--danger";
  if (SUCCESS.includes(key)) return "sila-badge sila-badge--success";
  if (WARNING.includes(key)) return "sila-badge sila-badge--warning";
  if (key === "OPEN") return "sila-badge sila-badge--info";
  return "sila-badge sila-badge--neutral";
};

/** A bucket is editable only while OPEN; every other status is frozen for ever. */
export const isOpenStatus = (status: string): boolean => status === "OPEN";

export const sortedSteps = (steps: WeeklyBucketApprovalStep[]): WeeklyBucketApprovalStep[] =>
  [...steps].sort((left, right) => left.order - right.order);

/** Approval is sequential: the bucket waits for the first approver who has not acted yet. */
export const waitingStep = (status: string, steps: WeeklyBucketApprovalStep[]): WeeklyBucketApprovalStep | undefined =>
  status === "PENDING_APPROVAL" ? sortedSteps(steps).find((step) => step.status === "PENDING") : undefined;

export const isMyApprovalTurn = (
  bucket: { status: string; approvalSteps: WeeklyBucketApprovalStep[] },
  userId: string | null,
): boolean => {
  const step = waitingStep(bucket.status, bucket.approvalSteps);
  return Boolean(step && sameId(step.userId, userId));
};

/** Freezing leaves out the lines that cannot be supplied and have no approved recommendation. */
export const isExcludedOnFreeze = (item: WeeklyBucketItem): boolean =>
  item.lineStatus === "EXCLUDED" ||
  (item.availabilityStatus === "UNAVAILABLE" && item.lineStatus !== "RECOMMENDATION_APPROVED");
