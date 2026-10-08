import { useEffect, useRef, useState } from "react";
import { fetchRFQMasterData } from "../api/supplierApi";

export interface LiveAuctionItem {
  id: string;
  supplierRFQId?: string;
  name: string;
  itemCode: string;
  organizationName: string;
  deliveryLocation: string;
  endDate: string;
  formattedEndDate: string;
  status?: string | null;
}

export const LIVE_BIDS_PAGE_SIZE = 6;
// The rfq-master-data endpoint returns a bare array with no total, so the count is
// resolved with one wide fetch when the board opens.
const TOTAL_COUNT_FETCH_LIMIT = 1000;

export const formatEndDateStr = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dateFormatted = d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const timeFormatted = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return `${dateFormatted}, ${timeFormatted}`;
  } catch {
    return dateStr;
  }
};

export function useLiveBids(supplierId: string | null, isModalOpen: boolean) {
  const [auctions, setAuctions] = useState<LiveAuctionItem[]>([]);
  const [selectedLot, setSelectedLot] = useState<LiveAuctionItem | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalAuctions, setTotalAuctions] = useState<number>(0);
  const [hasNextPage, setHasNextPage] = useState<boolean>(false);
  const [loadingApi, setLoadingApi] = useState<boolean>(false);
  const knownTotalRef = useRef<number>(0);

  const fetchLiveBidsData = async (page: number = currentPage) => {
    if (!supplierId) {
      setAuctions([]);
      setSelectedLot(null);
      return;
    }
    setLoadingApi(true);
    const startIndex = (page - 1) * LIVE_BIDS_PAGE_SIZE;
    try {
      const res = await fetchRFQMasterData({
        index: startIndex,
        limit: LIVE_BIDS_PAGE_SIZE,
        supplierId,
        status: "LIVE",
      });

      const rawList = Array.isArray(res)
        ? res
        : (res as any)?.data && Array.isArray((res as any).data)
          ? (res as any).data
          : (res as any)?.rfqs && Array.isArray((res as any).rfqs)
            ? (res as any).rfqs
            : [];

      const reportedTotal =
        (res as any)?.totalCount ??
        (res as any)?.total ??
        (res as any)?.totalRecords ??
        null;

      if (typeof reportedTotal === 'number') {
        knownTotalRef.current = reportedTotal;
        setTotalAuctions(reportedTotal);
        setHasNextPage(startIndex + rawList.length < reportedTotal);
      } else if (knownTotalRef.current > 0) {
        setHasNextPage(startIndex + rawList.length < knownTotalRef.current);
      } else {
        // No total known yet: a full page means there is more to come
        setHasNextPage(rawList.length === LIVE_BIDS_PAGE_SIZE);
        setTotalAuctions((prev) => Math.max(prev, startIndex + rawList.length));
      }

      if (rawList.length > 0) {
        const mapped: LiveAuctionItem[] = rawList.map((item: any, idx: number) => {
          const endDateRaw = item.endDate || item.end_date || item.closingDate || "";
          const orgName = item.organizationName || item.organization_name || item.orgName || item.companyName || "IBM Technologies Pvt ltd";
          const loc = item.deliveryLocation || item.delivery_location || item.location || "N/A";

          return {
            id: item.rfqId || item.id || `live-rfq-${idx}`,
            supplierRFQId: item.supplierRFQId || item.supplier_rfq_id,
            name: item.title || item.rfqTitle || `Live Sourcing Tender #${idx + 1}`,
            itemCode: item.rfqNumber || item.rfq_number || `RFQ-${idx + 1}`,
            organizationName: orgName,
            deliveryLocation: loc,
            endDate: endDateRaw,
            formattedEndDate: formatEndDateStr(endDateRaw),
            status: item.status || null,
          };
        });

        setAuctions(mapped);
        setSelectedLot((prev) => prev ? (mapped.find(m => m.id === prev.id) || mapped[0]) : mapped[0]);
      } else {
        setAuctions([]);
        setSelectedLot(null);
        // Landed on an empty page (rows removed since last fetch) - step back
        if (page > 1) setCurrentPage(page - 1);
      }
    } catch (err) {
      setAuctions([]);
      setSelectedLot(null);
      setTotalAuctions(0);
      setHasNextPage(false);
    } finally {
      setLoadingApi(false);
    }
  };

  // Resolve the true total tender count (the list endpoint does not report one)
  const fetchLiveBidsTotal = async () => {
    if (!supplierId) return;
    try {
      const res = await fetchRFQMasterData({
        index: 0,
        limit: TOTAL_COUNT_FETCH_LIMIT,
        supplierId,
        status: "LIVE",
      });

      const reportedTotal =
        (res as any)?.totalCount ?? (res as any)?.total ?? (res as any)?.totalRecords ?? null;

      const fullList = Array.isArray(res)
        ? res
        : (res as any)?.data && Array.isArray((res as any).data)
          ? (res as any).data
          : (res as any)?.rfqs && Array.isArray((res as any).rfqs)
            ? (res as any).rfqs
            : [];

      const total = typeof reportedTotal === 'number' ? reportedTotal : fullList.length;
      knownTotalRef.current = total;
      setTotalAuctions(total);
      setHasNextPage((prev) => (total > 0 ? currentPage * LIVE_BIDS_PAGE_SIZE < total : prev));
    } catch (err) {
    }
  };

  useEffect(() => {
    fetchLiveBidsData(currentPage);
  }, [isModalOpen, currentPage, supplierId]);

  useEffect(() => {
    knownTotalRef.current = 0;
    fetchLiveBidsTotal();
  }, [isModalOpen, supplierId]);

  return {
    auctions,
    setAuctions,
    selectedLot,
    setSelectedLot,
    currentPage,
    setCurrentPage,
    totalAuctions,
    hasNextPage,
    loadingApi,
    fetchLiveBidsData,
  };
}
