// Loads a single RFQ's detail plus the current supplier's own quotation for it, for the
// Supplier Dashboard's RFQ detail view. The quotation fetch is independent and non-fatal —
// multiple suppliers can quote on the same RFQ, and if it fails the form just falls back to
// defaults rather than blocking the RFQ detail from showing.
import { useState } from "react";
import {
  fetchRFQById,
  fetchSupplierQuotationBySupplierId,
  type RFQDetailResponse,
  type SupplierQuotationByIdItem,
} from "../api/supplierApi";

export function useRfqDetailLoader(supplierId: string | null) {
  const [ownQuotation, setOwnQuotation] = useState<SupplierQuotationByIdItem | null>(null);
  const [selectedRfqId, setSelectedRfqId] = useState<string | null>(null);
  const [selectedRfq, setSelectedRfq] = useState<RFQDetailResponse | null>(null);
  const [loadingRfqDetail, setLoadingRfqDetail] = useState(false);
  const [rfqDetailError, setRfqDetailError] = useState<string | null>(null);

  const loadRfqDetail = async (rfqId: string) => {
    setSelectedRfqId(rfqId);
    setLoadingRfqDetail(true);
    setRfqDetailError(null);
    setSelectedRfq(null);
    setOwnQuotation(null);
    try {
      const data = await fetchRFQById(rfqId);
      if (data && 'title' in data) {
        setSelectedRfq(data);
      } else {
        setRfqDetailError("Failed to load RFQ details.");
      }
    } catch (err: any) {
      setRfqDetailError(err.message || "Failed to load RFQ details.");
    } finally {
      setLoadingRfqDetail(false);
    }

    // Independently fetch this supplier's own quotation for this RFQ.
    // Multiple suppliers can quote on the same RFQ, so rfq-by-id's
    try {
      const quotationData = await fetchSupplierQuotationBySupplierId(rfqId);
      if (quotationData && 'suppliers' in quotationData && Array.isArray(quotationData.suppliers)) {
        const mine =
          quotationData.suppliers.find((s) => s.supplierId === supplierId) ||
          quotationData.suppliers[0] ||
          null;
        setOwnQuotation(mine);
      }
    } catch {
      // non-fatal — form will just fall back to defaults
    }
  };

  const clearRfqDetail = () => {
    setSelectedRfqId(null);
    setSelectedRfq(null);
    setRfqDetailError(null);
    setOwnQuotation(null);
  };

  return {
    ownQuotation,
    setOwnQuotation,
    selectedRfqId,
    setSelectedRfqId,
    selectedRfq,
    setSelectedRfq,
    loadingRfqDetail,
    rfqDetailError,
    setRfqDetailError,
    loadRfqDetail,
    clearRfqDetail,
  };
}
