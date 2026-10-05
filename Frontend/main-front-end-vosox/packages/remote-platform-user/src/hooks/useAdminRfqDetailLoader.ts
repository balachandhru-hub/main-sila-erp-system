import { useState } from "react";
import {
  fetchRFQById,
  fetchSupplierQuotationBySupplierId,
  type RFQDetailResponse,
  type SupplierQuotationByIdItem,
} from "../../../remote-supplier/src/api/supplierApi";
import { isErrorResponse } from "@vosox/shared-ui";

export function useAdminRfqDetailLoader(supplierId: string | null) {
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

      if (isErrorResponse(data)) {
        setRfqDetailError(data.description || data.message || "Failed to load RFQ details.");
        setSelectedRfq(null);
        setLoadingRfqDetail(false);
        return;
      }

      setSelectedRfq(data);
    } catch (err: any) {
      setRfqDetailError(err.message || "Failed to load RFQ details.");
    } finally {
      setLoadingRfqDetail(false);
    }

    try {
      const quotationData = await fetchSupplierQuotationBySupplierId(rfqId);
      if (
        !isErrorResponse(quotationData) &&
        quotationData &&
        'suppliers' in quotationData &&
        Array.isArray(quotationData.suppliers)
      ) {
        const mine =
          quotationData.suppliers.find((s) => s.supplierId === supplierId) ||
          quotationData.suppliers[0] ||
          null;
        setOwnQuotation(mine);
      }
    } catch {
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
