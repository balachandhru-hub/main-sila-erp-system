import { useEffect, useState } from "react";
import {
  getAllItemMasters,
  getItemMasterById,
  type ItemMasterDto,
  type ItemMasterDetailDto,
} from "../api/Buyerapi";
import { isErrorResponse, toastService } from "@vosox/shared-ui";

export const ITEM_MASTER_PAGE_SIZE = 10;

/** Item master list (search + pagination) and detail-on-row-click for the Material Master screen. */
export const useItemMasterCatalog = (buyerId: string) => {
  const [itemMasters, setItemMasters] = useState<ItemMasterDto[]>([]);
  const [showListView, setShowListView] = useState(true);
  const [selectedItemDetail, setSelectedItemDetail] = useState<ItemMasterDetailDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [itemMasterPage, setItemMasterPage] = useState(1);
  const [itemMasterHasMore, setItemMasterHasMore] = useState(true);

  const fetchItemMasters = async (page: number) => {
    if (!buyerId) return;

    setLoading(true);
    setError(null);
    const index = (page - 1) * ITEM_MASTER_PAGE_SIZE;
    const limit = ITEM_MASTER_PAGE_SIZE + 1;

    try {
      const result = await getAllItemMasters(buyerId, index, limit, searchQuery.trim());
      const resolved = result?.data?.data || result?.data || result || [];
      const hasMore = Array.isArray(resolved) && resolved.length > ITEM_MASTER_PAGE_SIZE;

      const pageItems = hasMore
        ? resolved.slice(0, ITEM_MASTER_PAGE_SIZE)
        : resolved;

      setItemMasters(pageItems);
      setItemMasterPage(page);
      setItemMasterHasMore(hasMore);
    } catch (err: any) {
      const message = err?.message || "Failed to load item masters.";
      setError(message);
      toastService.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItemMasters(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerId, searchQuery]);

  const handleItemMasterNextPage = () => {
    if (loading || !itemMasterHasMore) return;
    fetchItemMasters(itemMasterPage + 1);
  };

  const handleItemMasterPrevPage = () => {
    if (loading || itemMasterPage <= 1) return;
    fetchItemMasters(itemMasterPage - 1);
  };

  const startIndex = (itemMasterPage - 1) * ITEM_MASTER_PAGE_SIZE;

  const handleRowClick = async (id: string) => {
    setShowListView(false);
    setDetailLoading(true);
    setDetailError(null);

    const result = await getItemMasterById(id);

    if (isErrorResponse(result)) {
      const message = result.message || "Failed to load item master details.";
      setDetailError(message);
      toastService.error(message);
      setSelectedItemDetail(null);
      setDetailLoading(false);
      return;
    }

    setSelectedItemDetail(result as ItemMasterDetailDto);
    setDetailLoading(false);
  };

  const handleBackToList = () => {
    setShowListView(true);
    setSelectedItemDetail(null);
    setDetailError(null);
  };

  return {
    itemMasters,
    showListView,
    selectedItemDetail,
    loading,
    detailLoading,
    error,
    detailError,
    searchQuery,
    setSearchQuery,
    itemMasterPage,
    itemMasterHasMore,
    startIndex,
    fetchItemMasters,
    handleItemMasterNextPage,
    handleItemMasterPrevPage,
    handleRowClick,
    handleBackToList,
  };
};
