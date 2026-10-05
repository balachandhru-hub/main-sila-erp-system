import { useState } from "react";
import { fetchRFQMasterData, type RFQMasterDataItem } from "../../../remote-supplier/src/api/supplierApi";
import { isErrorResponse } from "@vosox/shared-ui";

export const RFQ_PAGE_SIZE = 10;

export function useAdminPaginatedRfqs(supplierId: string | null, fallbackList: RFQMasterDataItem[]) {
  const [allRfqsList, setAllRfqsList] = useState<RFQMasterDataItem[]>([]);
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
    if (!supplierId) {
      setAllRfqsList(fallbackList);
      setAllRfqsHasMore(false);
      setAllRfqsLoaded(true);
      return;
    }

    setLoadingAllRfqs(true);
    setAllRfqsError(null);

    try {
      const { index, limit } = getRfqPageRange(page);

      const data = await fetchRFQMasterData({
        supplierId,
        index,
        limit,
      });

      if (isErrorResponse(data)) {
        setAllRfqsError(
          data.description ||
          data.message ||
          "Failed to load the full RFQ list."
        );
        setAllRfqsList([]);
        setAllRfqsHasMore(false);
        return;
      }

      setAllRfqsList(data);
      setAllRfqsPage(page);

      setAllRfqsHasMore(data.length === RFQ_PAGE_SIZE);
    } catch (err: any) {
      setAllRfqsError(
        err.message || "Failed to load the full RFQ list."
      );
      setAllRfqsList([]);
      setAllRfqsHasMore(false);
    } finally {
      setLoadingAllRfqs(false);
      setAllRfqsLoaded(true);
    }
  };

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
}
