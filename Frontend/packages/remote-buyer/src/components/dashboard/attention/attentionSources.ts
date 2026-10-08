import { fetchMaterialApprovalKpi } from "../../../../../remote-platform-user/src/components/Material/materialApi";
import { fetchContracts, type ContractRecord } from "../../../../../remote-platform-user/src/components/Contract/contractApi";
import { getWeeklyBucket, getWeeklyBuckets, type WeeklyBucketListItem } from "../../../api/weeklyBucketApi";
import { getRecipeApprovals } from "../../../api/silaMe/silaRecipeApi";
import { getPriceApprovals } from "../../../api/silaMe/silaMaterialsApi";
import { getRecentAlerts } from "../../../api/silaMe/silaInventoryApi";
import { getInvoices } from "../../../api/silaMe/silaReceivingApi";
import type { SilaAlert } from "../../../api/silaMe/silaStockCountApi";
import { isMyApprovalTurn } from "../../weeklyBucket/weeklyBucketStatus";
import { sameId } from "../../cart/lineFormat";

/** How many rows a dashboard check reads at most; the count shows "N+" when it is reached. */
export const CHECK_LIMIT = 50;
/** Pending weekly buckets opened to see whose turn it is (each needs its own request). */
const BUCKET_TURN_CHECKS = 10;

const DECIDED = ["APPROVE", "APPROVED", "REJECT", "REJECTED"];
const isDecided = (status?: string | null): boolean => DECIDED.includes((status ?? "").toUpperCase());

/** Contract approval is sequential: it waits for the first approver (by order) who has not decided yet. */
const isMyContractTurn = (contract: ContractRecord, userId: string | null): boolean => {
  if (!userId || isDecided(contract.status)) return false;
  const waiting = [...(contract.approvalUsers ?? [])]
    .sort((left, right) => left.order - right.order)
    .find((approver) => !isDecided(approver.status));
  return Boolean(waiting && sameId(waiting.userId, userId));
};

/** Material master approvals waiting for the signed-in user. */
export const countMaterialApprovals = async (): Promise<number> => (await fetchMaterialApprovalKpi()).pendingCount ?? 0;

/** Contracts (newest first) whose approval waits for the signed-in user. */
export const countContractApprovals = async (userId: string | null): Promise<number> => {
  const contracts = await fetchContracts(0, CHECK_LIMIT);
  return contracts.filter((contract) => isMyContractTurn(contract, userId)).length;
};

/** The organization's newest weekly buckets. */
export const loadRecentBuckets = (): Promise<WeeklyBucketListItem[]> => getWeeklyBuckets(0, CHECK_LIMIT);

/** Frozen buckets waiting for the signed-in user's decision (the newest pending ones are checked). */
export const countBucketApprovals = async (buckets: WeeklyBucketListItem[], userId: string | null): Promise<number> => {
  const pending = buckets.filter((bucket) => bucket.status === "PENDING_APPROVAL").slice(0, BUCKET_TURN_CHECKS);
  const details = await Promise.all(pending.map((bucket) => getWeeklyBucket(bucket.id)));
  return details.filter((detail) => isMyApprovalTurn(detail, userId)).length;
};

/** SILA ME recipes waiting for the signed-in user's decision. */
export const countRecipeApprovals = async (): Promise<number> => (await getRecipeApprovals()).length;

/** SILA ME material price changes waiting for the signed-in user's decision. */
export const countPriceApprovals = async (): Promise<number> => (await getPriceApprovals(0, CHECK_LIMIT)).length;

/** The newest unhandled SILA ME alerts (none when the alerts endpoint is not available). */
export const loadSilaAlerts = async (): Promise<SilaAlert[]> => (await getRecentAlerts(5)) ?? [];

/** SILA ME invoices read by OCR and waiting for a person to review them. */
export const countInvoicesToReview = async (): Promise<number> =>
  (await getInvoices("", "EXTRACTED", { index: 0, limit: CHECK_LIMIT })).length;

/** "50+" when the check stopped at its limit. */
export const formatCount = (count: number): string => (count >= CHECK_LIMIT ? `${CHECK_LIMIT}+` : String(count));
