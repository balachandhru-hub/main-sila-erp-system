// Paginated "All RFQs" list for the Supplier Dashboard. When supplierId isn't resolved yet,
// falls back to client-side-slicing whatever "recent RFQs" list the caller already has loaded,
// rather than hitting the API with a missing id.
import { useState } from "react";
import { fetchRFQMasterData, type RFQMasterDataItem } from "../api/supplierApi";

export const RFQ_PAGE_SIZE = 10;

export function usePaginatedRfqs(supplierId: string | null, fallbackList: RFQMasterDataItem[]) {
  const [allRfqsList, setAllRfqsList] = useState<RFQMasterDataItem[]>([]);
  const [loadingAllRfqs, setLoadingAllRfqs] = useState(false);
  const [allRfqsError, setAllRfqsError] = useState<string | null>(null);
  const [allRfqsPage, setAllRfqsPage] = useState(1);
  const [hasNextRfqPage, setHasNextRfqPage] = useState(false);

  const getAllRfqsRange = (page: number) => {
    const index = (page - 1) * RFQ_PAGE_SIZE;
    const limit = RFQ_PAGE_SIZE;
    return { index, limit };
  };

  const fetchAllRfqsPage = async (page: number, overrideSupplierId?: string | null): Promise<boolean> => {
    const targetSuppId = overrideSupplierId !== undefined ? overrideSupplierId : supplierId;

    if (!targetSuppId) {
      if (fallbackList.length > 0) {
        const start = (page - 1) * RFQ_PAGE_SIZE;
        const pageData = fallbackList.slice(start, start + RFQ_PAGE_SIZE);
        setAllRfqsList(pageData);
        setHasNextRfqPage(start + RFQ_PAGE_SIZE < fallbackList.length);
        return pageData.length > 0;
      }
      setLoadingAllRfqs(true);
      return false;
    }

    setLoadingAllRfqs(true);
    setAllRfqsError(null);

    try {
      const { index, limit } = getAllRfqsRange(page);

      const data = await fetchRFQMasterData({
        supplierId: targetSuppId,
        index,
        limit,
      });

      if (!Array.isArray(data)) {
        setAllRfqsError("Failed to load RFQs.");
        setAllRfqsList([]);
        setHasNextRfqPage(false);
        return false;
      }

      setAllRfqsList(data);
      setHasNextRfqPage(data.length >= RFQ_PAGE_SIZE);

      return data.length > 0;
    } catch (err: any) {
      setAllRfqsError(err?.message || "Failed to load the RFQ page.");
      setAllRfqsList([]);
      setHasNextRfqPage(false);
      return false;
    } finally {
      setLoadingAllRfqs(false);
    }
  };

  const handleNextRfqPage = async () => {
    if (loadingAllRfqs || !hasNextRfqPage) return;

    const currentPage = allRfqsPage;
    const nextPage = currentPage + 1;
    const currentPageData = allRfqsList;

    const loaded = await fetchAllRfqsPage(nextPage);

    if (loaded) {
      setAllRfqsPage(nextPage);
    } else {
      setAllRfqsList(currentPageData);
      setHasNextRfqPage(false);
    }
  };

  const handlePreviousRfqPage = async () => {
    if (loadingAllRfqs || allRfqsPage <= 1) return;

    const previousPage = allRfqsPage - 1;
    const loaded = await fetchAllRfqsPage(previousPage);

    if (loaded) {
      setAllRfqsPage(previousPage);
      setHasNextRfqPage(true);
    }
  };

  return {
    allRfqsList,
    loadingAllRfqs,
    allRfqsError,
    allRfqsPage,
    setAllRfqsPage,
    hasNextRfqPage,
    fetchAllRfqsPage,
    handleNextRfqPage,
    handlePreviousRfqPage,
  };
}
