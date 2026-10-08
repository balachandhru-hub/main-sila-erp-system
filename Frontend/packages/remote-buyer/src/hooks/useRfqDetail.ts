import { useMemo, useState } from "react";
import { toastService, type ChatCounterpartyRef } from "@vosox/shared-ui";
import { fetchBuyerRFQById, updateRfqStatus } from "../api/Buyerapi";

/** The RFQ opened on the full-page detail view, its freeze action and its chat participants. */
export const useRfqDetail = () => {
  const [fullPageRfq, setFullPageRfq] = useState<any | null>(null);
  const [fullPageRfqId, setFullPageRfqId] = useState<string | null>(null);
  const [loadingFullPageRfq, setLoadingFullPageRfq] = useState(false);
  const [fullPageRfqError, setFullPageRfqError] = useState<string | null>(null);
  const [freezingBid, setFreezingBid] = useState(false);

  /** Loads an RFQ's details; when that fails, falls back to the matching row in `fallbackRfqs`. */
  const openRfqDetail = async (rfqId: string, fallbackRfqs: any[]) => {
    setFullPageRfqId(rfqId);
    setLoadingFullPageRfq(true);
    setFullPageRfqError(null);
    try {
      const details = await fetchBuyerRFQById(rfqId);
      setFullPageRfq({ ...details, rfqId });
    } catch (err: any) {
      setFullPageRfqError(err.message || "Failed to fetch details.");
      setFullPageRfq(fallbackRfqs.find((r) => r.rfqId === rfqId) || null);
    } finally {
      setLoadingFullPageRfq(false);
    }
  };

  const clearRfqDetail = () => {
    setFullPageRfq(null);
    setFullPageRfqId(null);
    setFullPageRfqError(null);
  };

  const handleFreezeBid = async () => {
    if (!fullPageRfqId || freezingBid || fullPageRfq?.status === "Freezing") return;
    setFreezingBid(true);
    try {
      await updateRfqStatus({ rfqId: fullPageRfqId, status: "Freezing" });
      const updated = await fetchBuyerRFQById(fullPageRfqId);
      setFullPageRfq({ ...updated, rfqId: fullPageRfqId });
      toastService.success("Bid frozen. Suppliers can no longer submit quotations for this RFQ.");
    } catch (err: any) {
      toastService.error(err?.message || "Failed to freeze the bid.");
    } finally {
      setFreezingBid(false);
    }
  };

  // Known supplier org names from quotation data, used to give the chat a
  // real supplier name instead of an individual invited user's name.
  const chatSupplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    const quotations = Array.isArray(fullPageRfq?.supplierQuotation) ? fullPageRfq.supplierQuotation : [];
    for (const quote of quotations) {
      if (quote?.supplierId && quote?.supplierName) {
        map[quote.supplierId] = quote.supplierName;
      }
    }
    return map;
  }, [fullPageRfq]);

  // The ONLY source of which suppliers appear in the RFQ chat and their display names.
  const chatCounterparties = useMemo<ChatCounterpartyRef[]>(() => {
    const internal: ChatCounterpartyRef[] = (fullPageRfq?.supplierIds || [])
      .filter((s: any) => !!s?.supplierId)
      .map((s: any) => ({
        id: s.supplierId,
        name: s.supplierName || chatSupplierNames[s.supplierId] || "Supplier",
        isExternal: false,
      }));
    const external: ChatCounterpartyRef[] = (fullPageRfq?.externalSupplierIds || [])
      .filter((s: any) => !!s?.externalSupplierId)
      .map((s: any) => ({
        id: s.externalSupplierId,
        name: s.externalSupplierName || "External Supplier",
        isExternal: true,
      }));
    return [...internal, ...external];
  }, [fullPageRfq, chatSupplierNames]);

  return {
    fullPageRfq,
    fullPageRfqId,
    loadingFullPageRfq,
    fullPageRfqError,
    freezingBid,
    chatCounterparties,
    openRfqDetail,
    clearRfqDetail,
    handleFreezeBid,
  };
};
