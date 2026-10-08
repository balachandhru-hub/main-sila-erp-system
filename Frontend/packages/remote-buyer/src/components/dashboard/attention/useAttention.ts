import { useCallback, useEffect, useState } from "react";
import type { WeeklyBucketListItem } from "../../../api/weeklyBucketApi";
import type { SilaAlert } from "../../../api/silaMe/silaStockCountApi";
import { isSilaMeNav } from "../../silaMe/silaMeNav";
import {
  countBucketApprovals,
  countContractApprovals,
  countInvoicesToReview,
  countMaterialApprovals,
  countPriceApprovals,
  countRecipeApprovals,
  loadRecentBuckets,
  loadSilaAlerts,
} from "./attentionSources";

/** One kind of approval waiting for the signed-in user; `navKey` opens its inbox. */
export interface PendingApproval {
  navKey: string;
  label: string;
  count: number;
}

export interface AttentionState {
  loading: boolean;
  approvals: PendingApproval[];
  /** Newest unhandled SILA ME alerts (SILA ME organizations only). */
  alerts: SilaAlert[];
  /** The organization's newest weekly buckets, newest first; null when they could not be read. */
  buckets: WeeklyBucketListItem[] | null;
  /** SILA ME invoices read by OCR and waiting for review (SILA ME organizations only). */
  invoicesToReview: number;
  /** Names of the checks that failed, so the panel can say what it could not verify. */
  failed: string[];
  reload: () => void;
}

/** SILA ME screen of the price approvals inbox; counted only once that screen is in the SILA ME menu. */
const PRICE_APPROVALS_NAV_KEY = "silaPriceApprovals";

interface AttentionOptions {
  currentUserId: string | null;
  hasSilaMe: boolean;
}

const settle = async <T>(name: string, run: () => Promise<T>, failed: string[]): Promise<T | null> => {
  try {
    return await run();
  } catch {
    // Each check is independent: one failing source is reported by name and the others still show.
    failed.push(name);
    return null;
  }
};

/**
 * What waits for the signed-in user: approvals (material, contract, weekly bucket, SILA ME recipes and prices),
 * SILA ME alerts and invoices to review, and the weekly buckets the next actions are suggested from.
 */
export const useAttention = ({ currentUserId, hasSilaMe }: AttentionOptions): AttentionState => {
  const [state, setState] = useState<Omit<AttentionState, "reload">>({
    loading: true,
    approvals: [],
    alerts: [],
    buckets: null,
    invoicesToReview: 0,
    failed: [],
  });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let active = true;
    const failed: string[] = [];
    setState((previous) => ({ ...previous, loading: true }));

    const run = async () => {
      const bucketsPromise = settle("weekly buckets", loadRecentBuckets, failed);
      const checkPrices = hasSilaMe && isSilaMeNav(PRICE_APPROVALS_NAV_KEY);
      const [material, contract, buckets, recipes, prices, alerts, invoices] = await Promise.all([
        settle("material approvals", countMaterialApprovals, failed),
        settle("contract approvals", () => countContractApprovals(currentUserId), failed),
        bucketsPromise,
        hasSilaMe ? settle("recipe approvals", countRecipeApprovals, failed) : Promise.resolve(null),
        checkPrices ? settle("price approvals", countPriceApprovals, failed) : Promise.resolve(null),
        hasSilaMe ? settle("SILA ME alerts", loadSilaAlerts, failed) : Promise.resolve(null),
        hasSilaMe ? settle("invoices to review", countInvoicesToReview, failed) : Promise.resolve(null),
      ]);
      const bucketTurns = buckets ? await settle("weekly bucket approvals", () => countBucketApprovals(buckets, currentUserId), failed) : null;

      const approvals: PendingApproval[] = [
        { navKey: "material", label: "Material approvals", count: material ?? 0 },
        { navKey: "contract", label: "Contract approvals", count: contract ?? 0 },
        { navKey: "weeklyBucketApprovals", label: "Weekly bucket approvals", count: bucketTurns ?? 0 },
        { navKey: "silaRecipeApprovals", label: "Recipe approvals", count: recipes ?? 0 },
        { navKey: PRICE_APPROVALS_NAV_KEY, label: "Price approvals", count: prices ?? 0 },
      ].filter((approval) => approval.count > 0);

      if (!active) return;
      setState({
        loading: false,
        approvals,
        alerts: alerts ?? [],
        buckets,
        invoicesToReview: invoices ?? 0,
        failed,
      });
    };

    run();
    return () => {
      active = false;
    };
  }, [currentUserId, hasSilaMe, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { ...state, reload };
};
