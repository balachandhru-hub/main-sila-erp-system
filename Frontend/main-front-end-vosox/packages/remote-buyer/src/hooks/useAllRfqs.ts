import { useEffect, useState } from "react";
import { fetchBuyerRFQs } from "../api/Buyerapi";
import { RFQ_PAGE_SIZE } from "../constants";
import type { RfqPageView } from "../components/dashboard/types";

interface UseAllRfqsParams {
  buyerId: string | null;
  /** The dashboard's recent RFQs, used as a fallback when the full list fails to load. */
  rfqs: any[];
  rfqsError: string | null;
  rfqPageView: RfqPageView;
}

/** Paged "All RFQs" list. */
export const useAllRfqs = ({ buyerId, rfqs, rfqsError, rfqPageView }: UseAllRfqsParams) => {
  const [allRfqsList, setAllRfqsList] = useState<any[]>([]);
  const [loadingAllRfqs, setLoadingAllRfqs] = useState(false);
  const [allRfqsError, setAllRfqsError] = useState<string | null>(null);
  const [allRfqsLoaded, setAllRfqsLoaded] = useState(false);
  const [allRfqsPage, setAllRfqsPage] = useState(1);
  const [allRfqsHasMore, setAllRfqsHasMore] = useState(true);

  const getRfqPageRange = (page: number) => {
    const index = (page - 1) * RFQ_PAGE_SIZE;
    const limit = RFQ_PAGE_SIZE;
    return { index, limit };
  };

  const loadAllRfqsPage = async (page: number) => {
    // The buyer id may not be known yet (e.g. on a reload of /rfqs); the effect below loads the list once it is.
    if (!buyerId) return;

    setLoadingAllRfqs(true);
    setAllRfqsError(null);

    try {
      const { index, limit } = getRfqPageRange(page);
      const data = await fetchBuyerRFQs({ buyerId, index, limit });

      if (data.length === 0 && page > 1) {
        // Nothing on the next page: stay on the current page.
        setAllRfqsHasMore(false);
        return;
      }
      setAllRfqsList(data);
      setAllRfqsPage(page);
      setAllRfqsHasMore(data.length === RFQ_PAGE_SIZE);
    } catch (err: any) {
      setAllRfqsError(err.message || "Failed to load the full RFQ list.");
      setAllRfqsList(rfqs.length > 0 ? rfqs : []);
      setAllRfqsHasMore(false);
    } finally {
      setLoadingAllRfqs(false);
      setAllRfqsLoaded(true);
    }
  };

  // Load the RFQ list as soon as the buyer id is available, or show why it can't be loaded.
  useEffect(() => {
    if (rfqPageView !== "allRfqs" || allRfqsLoaded || loadingAllRfqs) return;
    if (buyerId) {
      loadAllRfqsPage(1);
    } else if (rfqsError) {
      setAllRfqsError(rfqsError);
      setAllRfqsLoaded(true);
    }
  }, [buyerId, rfqPageView, rfqsError]);

  const handleAllRfqsNextPage = () => {
    if (loadingAllRfqs || !allRfqsHasMore) return;
    loadAllRfqsPage(allRfqsPage + 1);
  };

  const handleAllRfqsPrevPage = () => {
    if (loadingAllRfqs || allRfqsPage <= 1) return;
    loadAllRfqsPage(allRfqsPage - 1);
  };

  return {
    allRfqsList,
    loadingAllRfqs,
    allRfqsError,
    allRfqsLoaded,
    allRfqsPage,
    allRfqsHasMore,
    loadAllRfqsPage,
    handleAllRfqsNextPage,
    handleAllRfqsPrevPage,
  };
};
