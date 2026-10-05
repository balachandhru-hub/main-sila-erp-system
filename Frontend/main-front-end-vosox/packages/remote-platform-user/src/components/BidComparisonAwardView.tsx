import React, { useState, useMemo, useEffect, useRef } from "react";
import "./BidComparisonAward.css";
import { Button, QuestionAnswer, QuestionItem, QuestionList, QuestionProgress, StatusBadge } from "@vosox/shared-ui";
import { FaArrowDown, FaArrowUp, FaCheck, FaChevronDown, FaChevronRight, FaFlag, FaListUl, FaUsers } from "react-icons/fa";
import {
  fetchBuyerAsset,
  fetchSupplierAnswerAsset,
  getBidComparisonData,
  isBidComparisonError,
  awardRfq,
  unawardRfq,
  updateSupplierTermsConditionStatus,
  fetchBuyerRfqEsign,
  uploadBuyerRfqEsign,
  updateBuyerRfqTermsCondition,
} from "../api/platformApi";
import type { BidComparisonResponseDto } from "../api/platformApi";
import { ContractCreationView } from "./ContractCreationView";
import { fetchBuyerRFQById, createBuyerChatApi, type PersonDetailDto } from "../../../remote-buyer/src/api/Buyerapi";
import { useNetworkAdminAuthStore } from "../store/useAuthStore";
import { startRfqChatHub, stopRfqChatHub } from "@vosox/shared-ui";
import type { QuotationSubmittedEvent } from "@vosox/shared-ui";


const IconMessageSquare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const getInitials = (name: string) =>
  (name || "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("") || "?";

const formatQuestionType = (type?: string) => {
  if (!type) return "Text";
  const normalized = String(type).toLowerCase();
  const labels: Record<string, string> = {
    text: "Text",
    textarea: "Long text",
    checkbox: "Checkbox",
    radio: "Single choice",
    select: "Dropdown",
    file: "File",
    number: "Number",
    date: "Date",
  };
  return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
};


interface BidComparisonAwardViewProps {
  rfq: any;
  rfqId?: string;
  loading: boolean;
  error: string | null;
  freezingBid: boolean;
  onFreeze: () => void;
  onBack: () => void;
  onQsAns: () => void;
  onChatClick: () => void;
  /** Passed through to the Contract Workspace's own chat trigger — see ContractCreationView. */
  buyerProfile?: PersonDetailDto | null;
  isLoadingBuyerProfile?: boolean;
}

const BidComparisonAwardView: React.FC<BidComparisonAwardViewProps> = ({
  rfq: rfqProp, rfqId, loading, error, freezingBid, onFreeze, onBack, onChatClick, buyerProfile = null, isLoadingBuyerProfile = false
}) => {
  const [refreshedRfq, setRefreshedRfq] = useState<any | null>(null);
  const rfq = refreshedRfq ?? rfqProp;

  const personDetail = useNetworkAdminAuthStore((state) => state.personDetail);
  const buyerId = useNetworkAdminAuthStore((state) => state.claims?.buyerId);

  const [viewMode, setViewMode] = useState<"summary" | "comparison" | "by-supplier" | "bid-history">("summary");
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [showUnawardModal, setShowUnawardModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState("all");
  const [selections, setSelections] = useState<Record<string, string>>({});
  // Line-item IDs the buyer picked a supplier for by hand (Comparison / By-supplier
  // tabs). Auto-selection re-runs on every new supplier bid (see autoSelectLowest),
  // but must never clobber one of these.
  const manualSelectionsRef = useRef<Set<string>>(new Set());
  const viewModeRef = useRef(viewMode);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Record<string, boolean>>({});
  const [viewingDoc, setViewingDoc] = useState<{ fileName: string; url: string; contentType: string } | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<string | null>(null);

  // Bid History API state
  const [bidHistoryApiData, setBidHistoryApiData] = useState<BidComparisonResponseDto | null>(null);
  const [bidHistoryLoading, setBidHistoryLoading] = useState(false);
  const [bidHistoryError, setBidHistoryError] = useState<string | null>(null);

  const [awardingRfq, setAwardingRfq] = useState(false);
  const [awardSuccess, setAwardSuccess] = useState(false);
  const [awardError, setAwardError] = useState<string | null>(null);

  const [unawardingRfq, setUnawardingRfq] = useState(false);
  const [unawardError, setUnawardError] = useState<string | null>(null);

  const [contractCreated, setContractCreated] = useState(false);
  const [screen, setScreen] = useState<"award" | "contract">("award");

  const questions: any[] = useMemo(() => Array.isArray(rfq?.questions) ? rfq.questions : [], [rfq]);

  const qaSuppliers: any[] = useMemo(() => {
    if (Array.isArray(rfq?.supplierAnswers?.suppliers) && rfq.supplierAnswers.suppliers.length > 0) {
      return rfq.supplierAnswers.suppliers;
    }
    if (Array.isArray(rfq?.supplierQuotation)) {
      return rfq.supplierQuotation;
    }
    return [];
  }, [rfq]);

  const getAnswerForQuestion = (supplier: any, question: any) => {
    const questionId = question?.id ?? question?.rfqQuestionId;
    const answerList = Array.isArray(supplier?.answers) ? supplier.answers : Array.isArray(supplier?.supplierAnswers) ? supplier.supplierAnswers : [];
    return answerList.find((a: any) => a?.rfqQuestionId === questionId || a?.questionId === questionId) || null;
  };

  /** The file a supplier uploaded for an answer, if any: `{ id, fileName }` or null. */
  const getAnswerFile = (match: any): { id: string; fileName: string } | null => {
    if (!match) return null;
    const attachment = match.attachment ?? match.asset ?? null;
    const id = attachment?.id ?? attachment?.assetId ?? match.assetId ?? match.attachmentId ?? match.answerAssetId ?? null;
    if (!id) return null;
    return { id: String(id), fileName: attachment?.fileName || match.fileName || match.answer || "attachment" };
  };

  const isFileQuestion = (question: any) => /file|attachment/i.test(String(question?.questionType || ""));

  const isQuestionAnswered = (supplier: any, question: any) => {
    const match = getAnswerForQuestion(supplier, question);
    return Boolean((match?.answer && String(match.answer).trim() !== "") || match?.attachment?.fileName || match?.attachment?.id);
  };

  // Q&A shows one supplier at a time; the tabs switch between them.
  const [qaSupplierIndex, setQaSupplierIndex] = useState(0);
  const activeQaSupplier = qaSuppliers[Math.min(qaSupplierIndex, Math.max(qaSuppliers.length - 1, 0))];

  const handleDocumentAction = async (
    doc: any,
    action: 'preview' | 'download',
    fetchAsset: (assetId: string) => Promise<any> = fetchBuyerAsset,
  ) => {
    const assetId = doc.id || doc.assetId;
    if (!assetId) {
      alert("Document asset ID is missing.");
      return;
    }
    try {
      setLoadingDocId(assetId);
      const data: any = await fetchAsset(assetId);
      if (data && 'statusCode' in data && data.statusCode) {
        throw new Error(data.message || 'Failed to fetch document.');
      }

      const fileBytes = data.fileBytes;
      const fileName = data.fileName || doc.fileName || doc.assetName || "document";
      const rawType = (data.contentType || data.fileType || doc.fileType || "pdf").toLowerCase();

      let mimeType = "application/pdf";
      if (rawType.includes("pdf")) mimeType = "application/pdf";
      else if (rawType.includes("png")) mimeType = "image/png";
      else if (rawType.includes("jpg") || rawType.includes("jpeg")) mimeType = "image/jpeg";
      else if (rawType.includes("txt")) mimeType = "text/plain";
      else if (rawType.includes("doc")) mimeType = "application/msword";

      let url = data.url || data.fileUrl;
      let createdBlobUrl = "";

      if (fileBytes) {
        const cleanBase64 = fileBytes.replace(/^data:.*?;base64,/, '');
        const byteCharacters = atob(cleanBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: mimeType });
        createdBlobUrl = URL.createObjectURL(blob);
        url = createdBlobUrl;
      }

      if (!url) {
        throw new Error("Document content not available.");
      }

      if (action === 'preview') {
        setViewingDoc({ fileName, url, contentType: mimeType });
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(err?.message || "Could not access document.");
    } finally {
      setLoadingDocId(null);
    }
  };
  const isBidFrozen = rfq?.status === "Freezing" || rfq?.status === "Frozen";
  const isRfqAwarded = rfq?.status === "AWARDED";
  // A contract has already been created for this RFQ (listed in the buyer's rfq-by-id).
  const hasContract = (rfq?.contracts?.length ?? 0) > 0;
  // A supplier has already been invited to the contract workspace (buyerTermsAndConditionStatuses[].isSupplierInvitedForContract).
  const isSupplierInvitedForContract = !!(rfq?.buyerTermsAndConditionStatuses || []).some(
    (s: any) => s.isSupplierInvitedForContract === true
  );
  const isLotOption = !!rfq?.addLotOption;
  const quotations: any[] = useMemo(() => {
    if (!rfq?.supplierQuotation) return [];
    return rfq.supplierQuotation.filter(
      (q: any) => q.quotationId || q.totalPrice !== null
    );
  }, [rfq]);
  const suppliers: { id: string; name: string; total: number }[] = useMemo(() => {
    const seen = new Map<string, { id: string; name: string; total: number }>();
    quotations.forEach((q: any) => {
      const id = q.quotationId || q.supplierId || "unknown";
      const name = q.supplierName || q.organizationName || `Supplier`;
      const total = q.totalPrice || 0;
      if (!seen.has(id)) seen.set(id, { id, name, total });
    });
    return Array.from(seen.values());
  }, [quotations]);

  const lineItems: any[] = useMemo(() => {
    const isUuidStr = (val?: string) => Boolean(val && val.includes('-') && val.length > 20);
    if (rfq?.items && rfq.items.length > 0) {
      return rfq.items.map((item: any) => {
        let cc = item.costCenterCode || item.costCenterName || item.costCenter || '—';
        if (isUuidStr(cc)) {
          if (item.costCenterCode && !isUuidStr(item.costCenterCode)) cc = item.costCenterCode;
          else if (item.costCenterName && !isUuidStr(item.costCenterName)) cc = item.costCenterName;
        }
        return {
          id: item.id || item.itemId || item._id,
          description: item.description || item.materialName || item.name || '—',
          costCenter: cc || '—',
          quantity: item.quantity || item.qty || 1,
          uom: item.uom || item.unit || 'PCS',
          materialCode: item.materialCode || item.code || '',
          isAwarded: item.isAwarded,
          awardedSupplierId: item.awardedSupplierId,
        };
      });
    }
    return [];
  }, [rfq]);

  const effectiveQuotations: any[] = useMemo(() => {
    if (rfq?.supplierQuotation && rfq.supplierQuotation.length > 0) {
      const filtered = rfq.supplierQuotation.filter(
        (q: any) => (q.supplierQuotationItems && q.supplierQuotationItems.length > 0) || (q.items && q.items.length > 0)
      );
      if (filtered.length > 0) return filtered;
      return rfq.supplierQuotation;
    }

    return [];
  }, [rfq]);

  const suppliersWithTotals = useMemo(() => {
    return effectiveQuotations.map((q: any) => {
      const id = q.quotationId || q.supplierId || 'unknown';
      const name = q.supplierName || q.organizationName || 'Supplier';
      const total = (q.totalPrice !== undefined && q.totalPrice !== null)
        ? q.totalPrice
        : (q.supplierQuotationItems || []).reduce(
            (sum: number, qi: any) => sum + (qi.subTotal ?? (qi.quotedPrice ?? 0) * (qi.quantity ?? 1)), 0
          );
      return { id, name, total };
    });
  }, [effectiveQuotations]);

  const displaySuppliers = suppliersWithTotals.length > 0 ? suppliersWithTotals : suppliers;
  const validSupplierTotals = displaySuppliers.map(s => s.total).filter(t => t > 0);
  const lowestBid = validSupplierTotals.length > 0 ? Math.min(...validSupplierTotals) : 0;
  const highestBid = validSupplierTotals.length > 0 ? Math.max(...validSupplierTotals) : 0;
  const selectedItemCount = Object.keys(selections).length;
  const distinctSelected = [...new Set(Object.values(selections))];

  const getQuoteItemForRfqItem = (quotation: any, rfqItem: any): any | null => {
    const rfqItemId = rfqItem.id;
    if (!rfqItemId || !quotation.supplierQuotationItems) return null;
    return quotation.supplierQuotationItems.find(
      (qi: any) => qi.buyerRFQItemId === rfqItemId || qi.supplierRFQItemId === rfqItemId
    ) || null;
  };

  const isRankL1 = (qi: any) => {
    if (!qi) return false;
    const r = (qi.rank ?? qi.ranking ?? '').toString().toUpperCase().trim();
    return r === 'L1' || r === '1';
  };

  const totalAwardValue = useMemo(() => {
    if (effectiveQuotations.length === 0) return 0;
    return lineItems.reduce((sum, item) => {
      const itemId = item.id || item.itemId || item._id;
      const suppId = selections[itemId];
      const q = suppId
        ? effectiveQuotations.find((q: any) => (q.quotationId || q.supplierId || q._id) === suppId)
        : (
          effectiveQuotations.find((q: any) => {
            const qi = getQuoteItemForRfqItem(q, item);
            return isRankL1(qi);
          }) || effectiveQuotations[0]
        );
      const qi = q && item ? getQuoteItemForRfqItem(q, item) : null;
      const qty = item?.quantity || item?.qty || 1;
      const rawSubtotal = qi?.subTotal ?? null;
      const rawUnitPrice = qi?.quotedAmount ?? qi?.quotedPrice ?? 0;
      const subtotal = rawSubtotal ?? (rawUnitPrice * qty);
      return sum + subtotal;
    }, 0);
  }, [selections, lineItems, effectiveQuotations]);

  // Applies a freshly computed lowest-bid selection, but keeps any item the
  // buyer already picked by hand (see manualSelectionsRef) untouched.
  const applyAutoSelections = (autoSel: Record<string, string>) => {
    setSelections((prev) => {
      const merged: Record<string, string> = { ...autoSel };
      manualSelectionsRef.current.forEach((itemId) => {
        if (prev[itemId]) merged[itemId] = prev[itemId];
      });
      return merged;
    });
  };

  const autoSelectLowest = () => {
    const newSel: Record<string, string> = {};

    // 1. If RFQ is already awarded, pre-select based on isAwarded flag from API response payload
    if (isRfqAwarded) {
      if (isLotOption) {
        const awardedQuotation = effectiveQuotations.find(
          (q: any) => q.isAwarded === true
        );
        if (awardedQuotation) {
          const suppId = awardedQuotation.quotationId || awardedQuotation.supplierId;
          lineItems.forEach((item: any) => {
            const itemId = item.id || item.itemId || item._id;
            newSel[itemId] = suppId;
          });
        }
      } else {
        lineItems.forEach((item: any) => {
          const itemId = item.id || item.itemId || item._id;
          effectiveQuotations.forEach((q: any) => {
            const qi = getQuoteItemForRfqItem(q, item);
            if (qi?.isAwarded === true || q.isAwarded === true) {
              newSel[itemId] = q.quotationId || q.supplierId;
            }
          });
        });
      }

      if (Object.keys(newSel).length > 0) {
        applyAutoSelections(newSel);
        return;
      }
    }

    // 2. Otherwise auto-select lowest (L1) per item or lot
    lineItems.forEach((item: any) => {
      const itemId = item.id || item.rfqItemId;
      let selectedQ: any = null;

      effectiveQuotations.forEach((q: any) => {
        const qi = getQuoteItemForRfqItem(q, item);
        if (isRankL1(qi)) selectedQ = q;
      });

      if (!selectedQ) {
        let lowestPrice = Infinity;
        effectiveQuotations.forEach((q: any) => {
          const qi = getQuoteItemForRfqItem(q, item);
          const price = qi?.quotedAmount ?? qi?.quotedPrice ?? 0;
          if (price > 0 && price < lowestPrice) {
            lowestPrice = price;
            selectedQ = q;
          }
        });
      }

      if (selectedQ) newSel[itemId] = selectedQ.quotationId || selectedQ.supplierId;
    });

    if (Object.keys(newSel).length > 0) {
      applyAutoSelections(newSel);
    } else {
      const totals = effectiveQuotations.map((q: any) => ({
        q,
        total: (q.totalPrice !== undefined && q.totalPrice !== null)
          ? q.totalPrice
          : (q.supplierQuotationItems || []).reduce(
              (sum: number, qi: any) => sum + (qi.subTotal ?? (qi.quotedAmount ?? qi.quotedPrice ?? 0) * (qi.quantity ?? 1)), 0
            ),
      })).filter((t) => t.total > 0);

      if (totals.length > 0) {
        const lowest = totals.reduce((min, cur) => (cur.total < min.total ? cur : min), totals[0]);
        const suppId = lowest.q.quotationId || lowest.q.supplierId;
        lineItems.forEach((item: any) => {
          newSel[item.id || item.rfqItemId] = suppId;
        });
        applyAutoSelections(newSel);
      }
    }
  };

  useEffect(() => {
    setSelections({});
    manualSelectionsRef.current.clear();
  }, [rfq?.id, rfq?._id]);

  useEffect(() => {
    setRefreshedRfq(null);
  }, [rfqId, rfqProp?.rfqId]);

  useEffect(() => {
    viewModeRef.current = viewMode;
  }, [viewMode]);

  // Live-refreshes the moment a supplier (registered or external) submits or
  // updates a quotation on this RFQ, so a buyer sitting on this screen sees
  // the new bid without reloading. Buyers are already auto-joined on the
  // hub connection to every (RFQId, SupplierId) group for their org (see
  // MessageHub.GetEntitledGroups on the backend), so no supplierId is
  // needed here — same connection the RFQ chat drawer opens on top of this
  // screen already uses, just a second event on it (see rfqChatHub.ts).
  const effectiveRfqIdForHub = rfqId || rfqProp?.rfqId || rfqProp?.id || rfqProp?._id;
  const quotationRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!effectiveRfqIdForHub) return;

    const handleQuotationSubmitted = (payload: QuotationSubmittedEvent) => {
      if (payload?.RFQId && payload.RFQId !== effectiveRfqIdForHub) return;

      // Coalesce a burst of near-simultaneous events (e.g. several suppliers
      // submitting close together) into a single re-fetch instead of one
      // per event.
      if (quotationRefetchTimerRef.current) clearTimeout(quotationRefetchTimerRef.current);
      quotationRefetchTimerRef.current = setTimeout(() => {
        fetchBuyerRFQById(effectiveRfqIdForHub)
          .then((updated) => setRefreshedRfq({ ...updated, rfqId: effectiveRfqIdForHub }))
          .catch(() => {
            // A missed live refresh isn't fatal - the next manual action
            // (freeze, award, tab switch) will fetch fresh data anyway.
          });

        // Bid History tracks first-vs-current bid per supplier from its own
        // endpoint, so it needs its own refetch here too - otherwise a buyer
        // sitting on that tab (or returning to it later) sees a stale
        // snapshot even though Bid Comparison already updated live above.
        getBidComparisonData(effectiveRfqIdForHub)
          .then((response) => {
            if (!isBidComparisonError(response)) setBidHistoryApiData(response);
          })
          .catch(() => {
            // Same reasoning as above - the next tab switch re-fetches anyway.
          });
      }, 500);
    };

    startRfqChatHub({ rfqId: effectiveRfqIdForHub }, () => {}, undefined, handleQuotationSubmitted).catch((err) => {
      console.error("[BidComparisonAwardView] SignalR connection failed:", err);
    });

    return () => {
      if (quotationRefetchTimerRef.current) clearTimeout(quotationRefetchTimerRef.current);
      stopRfqChatHub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveRfqIdForHub]);

  // Re-runs whenever the set of supplier quotations changes — including when
  // SignalR (see handleQuotationSubmitted above) brings in a new or updated
  // bid — so a newly-lowest supplier gets auto-selected without waiting for
  // a manual refresh. Items the buyer already selected by hand are left
  // alone (see applyAutoSelections).
  useEffect(() => {
    if (lineItems.length > 0 && effectiveQuotations.length > 0) {
      autoSelectLowest();
    }
  }, [lineItems, effectiveQuotations]);

  useEffect(() => {
    if (isLotOption && viewMode === "comparison") {
      setViewMode("by-supplier");
    }
  }, [isLotOption, viewMode]);

  useEffect(() => {
    if (isRfqAwarded && !isLotOption && viewMode === "by-supplier") {
      setViewMode("summary");
    }
  }, [isRfqAwarded, isLotOption, viewMode]);

  useEffect(() => {
    const effectiveRfqId = rfqId || rfq?.rfqId || rfq?.id || rfq?._id;
    if (viewMode !== 'bid-history' || !effectiveRfqId) return;
    if (bidHistoryApiData?.rfqId === effectiveRfqId) return;

    let cancelled = false;
    setBidHistoryLoading(true);
    setBidHistoryError(null);

    getBidComparisonData(effectiveRfqId)
      .then((response) => {
        if (cancelled) return;
        if (isBidComparisonError(response)) {
          setBidHistoryError(response.message || response.description || 'Failed to load bid history.');
        } else {
          setBidHistoryApiData(response);
        }
      })
      .catch((err: any) => {
        if (!cancelled) setBidHistoryError(err?.message || 'Failed to load bid history.');
      })
      .finally(() => {
        if (!cancelled) setBidHistoryLoading(false);
      });

    return () => { cancelled = true; };
  }, [viewMode, rfqId, rfq?.rfqId, rfq?.id, rfq?._id]);

  // Reset bid history when rfq changes
  useEffect(() => {
    setBidHistoryApiData(null);
    setBidHistoryError(null);
  }, [rfq?.rfqId, rfq?.id, rfq?._id]);

  // Handle RFQ Award API call
  const handleConfirmAward = async () => {
    const effectiveRfqId = rfqId || rfq?.rfqId || rfq?.id || rfq?._id;
    if (!effectiveRfqId) {
      setAwardError("RFQ ID is missing.");
      return;
    }

    const selectionsArray = Object.entries(selections)
      .filter(([_, sid]) => Boolean(sid))
      .map(([itemId, sid]) => {
        const quotation = effectiveQuotations.find(
          (q: any) => (q.quotationId || q.supplierId || q._id) === sid
        );
        if (!quotation?.supplierId) return null;
        return {
          rfqItemId: itemId,
          supplierId: quotation.supplierId,
        };
      })
      .filter((sel): sel is { rfqItemId: string; supplierId: string } => sel !== null);

    if (selectionsArray.length === 0) {
      setAwardError("Please select at least one item to award.");
      return;
    }

    setAwardingRfq(true);
    setAwardError(null);

    try {
      const res = await awardRfq({
        rfqId: effectiveRfqId,
        // selectionMode: "ITEM_WISE",
        remarks: "",
        selections: selectionsArray,
      });

      if ('statusCode' in res && res.statusCode && res.statusCode >= 400) {
        setAwardError(res.message || res.description || "Failed to award RFQ.");
      } else {
        setAwardSuccess(true);
        try {
          const updated = await fetchBuyerRFQById(effectiveRfqId);
          setRefreshedRfq({ ...updated, rfqId: effectiveRfqId });
        } catch {
          // Award already succeeded; a failed refresh shouldn't surface as an award error.
        }
      }
    } catch (err: any) {
      setAwardError(err?.message || "An error occurred while awarding the RFQ.");
    } finally {
      setAwardingRfq(false);
    }
  };

  const handleUnaward = async () => {
    const effectiveRfqId = rfqId || rfq?.rfqId || rfq?.id || rfq?._id;
    if (!effectiveRfqId) return;

    setUnawardingRfq(true);
    setUnawardError(null);

    try {
      const res = await unawardRfq(effectiveRfqId);

      if ('statusCode' in res && res.statusCode && res.statusCode >= 400) {
        setUnawardError(res.message || res.description || "Failed to unaward RFQ.");
      } else {
        setShowUnawardModal(false);
        try {
          const updated = await fetchBuyerRFQById(effectiveRfqId);
          setRefreshedRfq({ ...updated, rfqId: effectiveRfqId });
        } catch {
          // Unaward already succeeded; a failed refresh shouldn't surface as an error.
        }
      }
    } catch (err: any) {
      setUnawardError(err?.message || "An error occurred while unawarding the RFQ.");
    } finally {
      setUnawardingRfq(false);
    }
  };

  const bidHistoryData = useMemo(() => {
    if (!bidHistoryApiData) return [];
    return (bidHistoryApiData.suppliers || []).map((supplier) => {
      const { supplierId, supplierName, firstVersion, latestVersion } = supplier;

      const firstItemMap = new Map(
        (firstVersion?.items || []).map((qi) => [qi.buyerRFQItemId, qi])
      );
      const latestItemMap = new Map(
        (latestVersion?.items || []).map((qi) => [qi.buyerRFQItemId, qi])
      );

      const isUuidStr = (val?: string) => Boolean(val && val.includes('-') && val.length > 20);
      const resolvedItems = (bidHistoryApiData.rfqItems && bidHistoryApiData.rfqItems.length > 0)
        ? bidHistoryApiData.rfqItems.map((apiItem: any) => {
            const matchInLineItems = lineItems.find((li: any) =>
              li.id === apiItem.id ||
              (li.materialCode && apiItem.materialCode && li.materialCode === apiItem.materialCode) ||
              (li.description && apiItem.description && li.description.toLowerCase() === apiItem.description.toLowerCase())
            );

            let cc = apiItem.costCenterCode || apiItem.costCenterName || apiItem.costCenter || '';
            if (!cc || isUuidStr(cc)) {
              if (matchInLineItems?.costCenter && !isUuidStr(matchInLineItems.costCenter)) {
                cc = matchInLineItems.costCenter;
              } else if (apiItem.costCenterCode && !isUuidStr(apiItem.costCenterCode)) {
                cc = apiItem.costCenterCode;
              } else if (apiItem.costCenterName && !isUuidStr(apiItem.costCenterName)) {
                cc = apiItem.costCenterName;
              }
            }

            return {
              ...apiItem,
              description: apiItem.description || apiItem.name || matchInLineItems?.description || '—',
              costCenter: (cc && !isUuidStr(cc)) ? cc : (matchInLineItems?.costCenter || '—'),
              materialCode: apiItem.materialCode || apiItem.code || matchInLineItems?.materialCode || '—',
              quantity: apiItem.quantity || apiItem.qty || matchInLineItems?.quantity || 1,
              uom: apiItem.uom || apiItem.unit || matchInLineItems?.uom || '—',
            };
          })
        : lineItems.map((li: any) => ({
            id: li.id,
            description: li.description || li.name || '—',
            quantity: li.quantity || li.qty || 1,
            uom: li.uom || li.unit || '',
            costCenter: li.costCenter || li.costCenterCode || '',
            materialCode: li.materialCode || li.code || '',
          }));

      const itemPrices: Record<string, {
        firstBid: number;
        currentBid: number;
        firstBreakdown: { discount: number; discountType: string; tax: number; taxType: string; delivery: number; deliveryType: string; subTotal: number | null };
        currentBreakdown: { discount: number; discountType: string; tax: number; taxType: string; delivery: number; deliveryType: string; subTotal: number | null };
      }> = {};

      resolvedItems.forEach((rfqItem: any) => {
        const firstQi = firstItemMap.get(rfqItem.id);
        const latestQi = latestItemMap.get(rfqItem.id);

        const effQuotation = effectiveQuotations.find(
          (q: any) => (q.quotationId || q.supplierId || q._id) === supplierId
        );
        const effQi = effQuotation ? getQuoteItemForRfqItem(effQuotation, rfqItem) : null;

        itemPrices[rfqItem.id] = {
          firstBid: firstQi?.quotedPrice ?? firstQi?.quotedAmount ?? effQi?.quotedPrice ?? effQi?.quotedAmount ?? 0,
          currentBid: latestQi?.quotedPrice ?? latestQi?.quotedAmount ?? effQi?.quotedPrice ?? effQi?.quotedAmount ?? 0,
          firstBreakdown: {
            discount: firstQi?.discount ?? (firstQi as any)?.discountPercentage ?? effQi?.discount ?? effQi?.discountPercentage ?? 0,
            discountType: (firstQi as any)?.discountType || (effQi as any)?.discountType || 'PERCENTAGE',
            tax: firstQi?.tax ?? (firstQi as any)?.taxPercentage ?? (firstQi as any)?.gst ?? effQi?.tax ?? effQi?.taxPercentage ?? effQi?.gst ?? 0,
            taxType: (firstQi as any)?.taxType || (effQi as any)?.taxType || 'PERCENTAGE',
            delivery: firstQi?.deliveryCharge ?? (firstQi as any)?.deliveryAmount ?? effQi?.deliveryCharge ?? effQi?.deliveryAmount ?? 0,
            deliveryType: (firstQi as any)?.deliveryType || (effQi as any)?.deliveryType || 'AMOUNT',
            subTotal: firstQi?.subTotal ?? null,
          },
          currentBreakdown: {
            discount: latestQi?.discount ?? (latestQi as any)?.discountPercentage ?? effQi?.discount ?? effQi?.discountPercentage ?? 0,
            discountType: (latestQi as any)?.discountType || (effQi as any)?.discountType || 'PERCENTAGE',
            tax: latestQi?.tax ?? (latestQi as any)?.taxPercentage ?? (latestQi as any)?.gst ?? effQi?.tax ?? effQi?.taxPercentage ?? effQi?.gst ?? 0,
            taxType: (latestQi as any)?.taxType || (effQi as any)?.taxType || 'PERCENTAGE',
            delivery: latestQi?.deliveryCharge ?? (latestQi as any)?.deliveryAmount ?? effQi?.deliveryCharge ?? effQi?.deliveryAmount ?? 0,
            deliveryType: (latestQi as any)?.deliveryType || (effQi as any)?.deliveryType || 'AMOUNT',
            subTotal: latestQi?.subTotal ?? null,
          },
        };
      });

      return {
        id: supplierId,
        name: supplierName,
        badgeType: 'external' as string,
        itemPrices,
        firstTotal: firstVersion?.totalPrice ?? 0,
        currentTotal: latestVersion?.totalPrice ?? 0,
        firstLotBreakdown: {
          discount: firstVersion?.discount ?? 0,
          discountType: firstVersion?.discountType || 'PERCENTAGE',
          tax: firstVersion?.tax ?? 0,
          taxType: firstVersion?.taxType || 'PERCENTAGE',
          delivery: firstVersion?.deliveryCharge ?? 0,
          deliveryType: firstVersion?.deliveryType || 'AMOUNT',
        },
        currentLotBreakdown: {
          discount: latestVersion?.discount ?? 0,
          discountType: latestVersion?.discountType || 'PERCENTAGE',
          tax: latestVersion?.tax ?? 0,
          taxType: latestVersion?.taxType || 'PERCENTAGE',
          delivery: latestVersion?.deliveryCharge ?? 0,
          deliveryType: latestVersion?.deliveryType || 'AMOUNT',
        },
        resolvedItems,
      };
    });
  }, [bidHistoryApiData, lineItems]);

  const selectAllForSupplier = (suppId: string) => {
    const newSel: Record<string, string> = {};
    lineItems.forEach((item: any) => {
      const itemId = item.id || item.itemId;
      newSel[itemId] = suppId;
      manualSelectionsRef.current.add(itemId);
    });
    setSelections(newSel);
  };

  if (loading) {
    return (<div className="bca-loading"><div className="bca-spinner" aria-hidden="true" /><span>Loading Bid Comparison...</span></div>);
  }
  if (error && !rfq) {
    return (<div className="bca-error" role="alert"><p>{error}</p><button type="button" className="bca-btn bca-btn-outline" onClick={onBack}>Back</button></div>);
  }
  if (!rfq) return null;

  // The RFQ's own currency (e.g. "INR", "USD"), as returned by rfq-by-id —
  // every money value below is formatted in this currency rather than a
  // hardcoded symbol. Left blank (not defaulted to "INR") when the API
  // doesn't return one, since guessing a currency could mislead the buyer.
  const currency = rfq?.currency || "";
  const fmtINR = (val: number) => {
    if (!val && val !== 0) return "—";
    try {
      const formattedNumber = new Intl.NumberFormat("en-IN", {
        maximumFractionDigits: 2,
      }).format(val);
      return currency ? `${formattedNumber} ${currency}` : formattedNumber;
    } catch {
      return `${val.toLocaleString("en-IN")}${currency ? ` ${currency}` : ""}`;
    }
  };

  // Resolves a discount/tax/delivery-charge field to its actual currency
  // amount regardless of which representation the API sent: an AMOUNT-type
  // field already is one, a PERCENTAGE-type field is converted against
  // `basis` (e.g. the unit price the percentage applies to).
  const resolveBreakdownAmount = (raw: number, type: string, basis: number) =>
    type === "AMOUNT" ? raw : (basis > 0 ? Math.round(basis * (raw / 100)) : 0);

  // Renders a discount/tax/delivery-charge breakdown value with BOTH
  // representations, in whichever order matches what the API actually sent
  // (discountType/taxType/deliveryType) — "X% → Y <currency>" when the API
  // sent a percentage, "Y <currency> → X%" when it sent a flat amount —
  // rather than only ever showing one side.
  const fmtBreakdownPair = (raw: number, type: string, basis: number, sign: string = "") => {
    if (type === "AMOUNT") {
      const pct = basis > 0 ? Math.round((raw / basis) * 100) : 0;
      return `${sign}${fmtINR(raw)} → ${sign}${pct}%`;
    }
    const amt = basis > 0 ? Math.round(basis * (raw / 100)) : 0;
    return `${raw}% → ${sign}${fmtINR(amt)}`;
  };

  const kpis: { label: string; value: React.ReactNode; icon: React.ReactNode }[] = [
    { label: "Suppliers Participated", value: displaySuppliers.length, icon: <FaUsers /> },
    { label: "Line Items", value: lineItems.length, icon: <FaListUl /> },
    { label: "Lowest Bid", value: lowestBid > 0 ? fmtINR(lowestBid) : "—", icon: <FaArrowDown /> },
    { label: "Highest Bid", value: highestBid > 0 ? fmtINR(highestBid) : "—", icon: <FaArrowUp /> },
    { label: "Bid Status", value: <StatusBadge status={rfq?.status || "Active"} className="bca-kpi-status" />, icon: <FaFlag /> },
  ];

  const renderSupplierTag = (badgeType: string) => {
    if (badgeType === "verified") return <StatusBadge status="Verified" size="sm" className="bca-stag bca-stag-verified" />;
    if (badgeType === "unverified") return <StatusBadge status="Unverified" label="Unverified" tone="neutral" size="sm" className="bca-stag bca-stag-external" />;
    if (badgeType === "warning") return <StatusBadge status="Pending verification" label="Verification required" tone="warning" size="sm" className="bca-stag bca-stag-warning" />;
    if (badgeType === "external") return <StatusBadge status="External" label="External" tone="neutral" size="sm" className="bca-stag bca-stag-external" />;
    if (badgeType === "review") return <StatusBadge status="Pending review" label="Under review" tone="warning" size="sm" className="bca-stag bca-stag-review" />;
    return null;
  };

  const barButtonDisabled = !isBidFrozen || selectedItemCount === 0;
  const barButtonLabel = !isBidFrozen ? "Freeze Bid to Continue" : selectedItemCount === 0 ? "Select Supplier(s)" : "Award Selected";

  const chatRfqId = rfqId || rfq?.rfqId || rfq?.id || rfq?._id;

  return (
    <div className="bca-page">
      {screen === "contract" ? (
        <ContractCreationView
          rfq={rfq}
          lineItems={lineItems}
          effectiveQuotations={effectiveQuotations}
          displaySuppliers={displaySuppliers}
          selections={selections}
          distinctSelected={distinctSelected}
          getQuoteItemForRfqItem={getQuoteItemForRfqItem}
          onBack={() => setScreen("award")}
          fetchESigns={fetchBuyerRfqEsign}
          onAcceptSupplierTerms={updateSupplierTermsConditionStatus}
          onUploadBuyerEsign={uploadBuyerRfqEsign}
          onUploadBuyerTerms={(rfqIdForUpload, document) =>
            updateBuyerRfqTermsCondition({ rfqId: rfqIdForUpload, buyerId: buyerId || "", isSingletonAsset: true, document })
          }
          refetchRfq={async (id) => {
            const updated = await fetchBuyerRFQById(id);
            if (!(updated && "statusCode" in updated)) setRefreshedRfq({ ...updated, rfqId: id });
          }}
          chatApi={chatRfqId ? createBuyerChatApi(chatRfqId) : undefined}
          chatHubParams={chatRfqId ? { rfqId: chatRfqId } : undefined}
          currentUserProfile={buyerProfile}
          isLoadingCurrentUserProfile={isLoadingBuyerProfile}
          buyerName={personDetail?.name}
          buyerDesignation={personDetail?.roleName}
        />
      ) : (
        <>
      <div className="bca-page-header">
        <div className="bca-header-left">
          <button type="button" className="bca-back-circle-btn" onClick={onBack} title="Back" aria-label="Back">
            <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div>
            <h1 className="bca-page-title">Bid Comparison &amp; Award</h1>
            <p className="bca-page-subtitle">Compare supplier quotations, evaluate line-item pricing, and award the RFQ.</p>
          </div>
        </div>
        <div className="bca-page-header-right">
          <StatusBadge
            status={isRfqAwarded ? "Awarded" : isBidFrozen ? "Frozen" : "Active"}
            label={isRfqAwarded ? "RFQ Awarded" : isBidFrozen ? "Bid Frozen" : "Bidding Active"}
            dot
            className={`bca-status-badge ${isRfqAwarded ? "bca-status-awarded" : isBidFrozen ? "bca-status-frozen" : "bca-status-active"}`}
          />
          {isRfqAwarded ? (
            <>
              <Button
                variant="primary"
                type="button"
                className="bca-btn-icon-gap"
                disabled
              >
                <span className="bca-icon-lock bca-icon-lock-muted" aria-hidden="true">
                  <span className="bca-icon-lock-shackle"></span>
                  <span className="bca-icon-lock-body"></span>
                </span>
                <span>Bid Close</span>
              </Button>
              <Button
                variant="outline"
                type="button"
                className="bca-btn-icon-gap"
                onClick={() => setShowUnawardModal(true)}
                disabled={unawardingRfq}
              >
                <span>{unawardingRfq ? "Unawarding..." : "Unaward RFQ"}</span>
              </Button>
            </>
          ) : isBidFrozen ? (
            <Button
              variant="primary"
              type="button"
              className="bca-btn-icon-gap"
              disabled
            >
              <span className="bca-icon-lock bca-icon-lock-muted" aria-hidden="true">
                <span className="bca-icon-lock-shackle"></span>
                <span className="bca-icon-lock-body"></span>
              </span>
              <span>Bid Frozen</span>
            </Button>
          ) : (
            <Button variant="primary" className="bca-btn-icon-gap" onClick={() => setShowFreezeModal(true)} disabled={freezingBid}>
              <span className="bca-icon-lock" aria-hidden="true">
                <span className="bca-icon-lock-shackle"></span>
                <span className="bca-icon-lock-body"></span>
              </span>
              <span>{freezingBid ? "Freezing..." : "Freeze Bid"}</span>
            </Button>
          )}
          {Array.isArray(rfq?.supplierIds) && rfq?.supplierIds?.length > 0 && (
            <Button
              type="button"
              variant="outline"
              className="bca-btn-icon-gap"
              onClick={onChatClick}
              title="Chat with invited suppliers"
            >
              <IconMessageSquare /> Chat
            </Button>
          )}
        </div>
      </div>

      <div className="bca-details-card">
        <div className="bca-details-title">RFQ Details</div>
        <div className="bca-details-grid">
          <div><div className="bca-detail-label">RFQ Title</div><div className="bca-detail-value">{rfq.title || "—"}</div></div>
          <div>
            <div className="bca-detail-label">Start Date &amp; Time (UTC)</div>
            <div className="bca-detail-value">{rfq.startDate ? new Date(rfq.startDate).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
          </div>
          <div>
            <div className="bca-detail-label">Close Date &amp; Time (UTC)</div>
            <div className="bca-detail-value">{rfq.endDate ? new Date(rfq.endDate).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</div>
          </div>
          <div><div className="bca-detail-label">Delivery Location</div><div className="bca-detail-value">{rfq.deliveryLocation || "—"}</div></div>
          <div className="bca-details-two"><div className="bca-detail-label">Description</div><div className="bca-detail-value">{rfq.description || "—"}</div></div>
          <div>
            <div className="bca-detail-label">Lot</div>
            {rfq.addLotOption ? <span className="bca-lot-badge">LOT Enabled</span> : <span className="bca-lot-badge-disabled">Not Enabled</span>}
          </div>
        </div>
      </div>

      <div className="bca-kpi-row">
        {kpis.map((k) => (
          <div key={k.label} className="bca-kpi-card">
            <div className="bca-kpi-top">
              <div className="bca-kpi-label">{k.label}</div>
              <div className="bca-kpi-icon" aria-hidden="true">{k.icon}</div>
            </div>
            <div className="bca-kpi-value">{k.value}</div>
          </div>
        ))}
      </div>

      {effectiveQuotations.length > 0 && (() => {
        const chartSuppliers = effectiveQuotations.map((q: any, idx: number) => {
          const id = q.quotationId || q.supplierId || q._id || `s${idx}`;
          const name = q.supplierName || q.organizationName || `Supplier ${idx + 1}`;
          const total = (q.totalPrice !== undefined && q.totalPrice !== null)
            ? q.totalPrice
            : (q.supplierQuotationItems || []).reduce(
                (sum: number, qi: any) => sum + (qi.subTotal ?? (qi.quotedPrice ?? 0) * (qi.quantity ?? 1)), 0
              );
          return { id, name, quotation: q, total };
        });

        const isAllSelected = selectedMaterial === "all" || !lineItems.some((m: any) => (m.id || m.itemId || m._id) === selectedMaterial);
        const selMat = isAllSelected ? null : lineItems.find((m: any) => (m.id || m.itemId || m._id) === selectedMaterial);

        const rawChartData = chartSuppliers.map(s => {
          let price = 0;
          if (isAllSelected) {
            price = s.total;
          } else if (selMat) {
            const qi = getQuoteItemForRfqItem(s.quotation, selMat);
            price = qi?.quotedAmount ?? qi?.quotedPrice ?? qi?.subTotal ?? 0;
          }
          return {
            id: s.id,
            name: s.name.length > 14 ? `${s.name.substring(0, 12)}...` : s.name,
            fullName: s.name,
            price,
            isLowest: false,
          };
        });

        const validPrices = rawChartData.map(d => d.price).filter(p => p > 0);
        const minPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;
        const chartData = rawChartData.map(d => ({
          ...d,
          isLowest: d.price > 0 && d.price === minPrice,
        }));

        return (
          <div className="bca-chart-card">
            <div className="bca-chart-header">
              <div>
                <div className="bca-chart-title">Price Comparison by Supplier</div>
                <div className="bca-chart-subtitle">
                  {isAllSelected
                    ? "Total quotation price comparison across all participating suppliers"
                    : `Unit price comparison for "${selMat?.description || 'selected item'}"`}
                </div>
              </div>
              <select
                className="bca-chart-dropdown"
                aria-label="Compare by line item"
                value={isAllSelected ? "all" : selectedMaterial}
                onChange={e => setSelectedMaterial(e.target.value)}
              >
                <option value="all">All Items (Total Price)</option>
                {lineItems.map((m: any) => (
                  <option key={m?.id || m?.itemId || m?._id} value={m?.id || m?.itemId || m?._id}>
                    {m?.description || m?.name || `Item ${m?.id}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="bca-chart-body">
              {chartData?.map((item: any, idx: number) => {
                const maxVal = Math.max(...(chartData?.map((d: any) => d?.price || 0) || []), 1);
                const percentage = item?.price > 0 ? Math.max((item.price / maxVal) * 100, 3) : 0;
                const formattedPrice = item?.price > 0 ? fmtINR(item.price) : 'No Quote';

                return (
                  <div key={item?.id || idx} className={`bca-bar-row${item?.isLowest ? " bca-bar-row-lowest" : ""}`}>
                    <div className="bca-bar-label" title={item?.fullName}>
                      {item?.name}
                    </div>
                    <div className="bca-bar-track">
                      <div
                        className="bca-bar-fill"
                        style={{ '--bca-bar-width': `${percentage}%` } as React.CSSProperties}
                      />
                      <span className="bca-bar-value">
                        {formattedPrice}
                        {item?.isLowest && (
                          <span className="bca-bar-lowest-tag">Lowest Bid</span>
                        )}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bca-chart-legend">
              {chartSuppliers?.map((s, i) => {
                const isLow = chartData[i]?.isLowest;
                return (
                  <div key={s?.id} className={`bca-chart-legend-item${isLow ? " bca-chart-legend-item-lowest" : ""}`}>
                    <span className="bca-chart-legend-dot" aria-hidden="true" />
                    <span>
                      {s?.name}{isLow ? ' · Lowest' : ''}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      <div className="bca-award-header">
        <div>
          <h2 className="bca-award-title">
            {viewMode === "summary"
              ? (isRfqAwarded ? "Awarded Suppliers" : "Award Selection")
              : viewMode === "bid-history"
                ? "Bid History"
                : isLotOption
                  ? "Bid Comparison"
                  : viewMode === "comparison"
                    ? "Bid Comparison"
                    : "Select by Supplier"}
          </h2>
          <p className="bca-award-subtitle">
            {viewMode === "summary"
              ? (isRfqAwarded ? "Suppliers awarded for each line item of this RFQ." : "Lowest-priced supplier auto-selected for every line item. Compare manually or award one supplier for all items.")
              : viewMode === "bid-history"
                ? "Track supplier bid progression — compare First Bid vs Current Bid for each line item."
                : isLotOption
                  ? "Compare supplier quotations before awarding the RFQ."
                  : viewMode === "comparison"
                    ? "Compare supplier quotations across each line item before awarding the RFQ."
                    : "Award all line items to a single supplier at once."}
          </p>
        </div>
        <div className="bca-tabs" role="tablist" aria-label="Award views">
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "summary"}
            className={`bca-tab${viewMode === "summary" ? " bca-tab-active" : ""}`}
            onClick={() => setViewMode("summary")}
          >
            {isRfqAwarded ? "Awarded Suppliers" : "Award Selection"}
          </button>
          {!isLotOption && (
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "comparison"}
              className={`bca-tab${viewMode === "comparison" ? " bca-tab-active" : ""}`}
              onClick={() => setViewMode("comparison")}
            >
              Bid Comparison
            </button>
          )}
          {(isLotOption || !isRfqAwarded) && (
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "by-supplier"}
              className={`bca-tab${viewMode === "by-supplier" ? " bca-tab-active" : ""}`}
              onClick={() => setViewMode("by-supplier")}
            >
              {isLotOption ? "Bid Comparison" : "Select by Supplier"}
            </button>
          )}
          <button
            type="button"
            role="tab"
            aria-selected={viewMode === "bid-history"}
            className={`bca-tab${viewMode === "bid-history" ? " bca-tab-active" : ""}`}
            onClick={() => setViewMode("bid-history")}
          >
            Bid History
          </button>
        </div>
      </div>

      <div className="bca-award-subbar">
        <div className="bca-award-chips">
          <span className="bca-award-chip">
            {viewMode === "summary" ? (isRfqAwarded ? "Awarded Suppliers" : "Award Selection") : viewMode === "comparison" ? "Bid Comparison" : viewMode === "bid-history" ? "Bid History" : "Select by Supplier"}
          </span>
          {effectiveQuotations.length > 0 && (() => {
            const supplierItemCount: Record<string, number> = {};
            Object.values(selections).forEach(sid => {
              supplierItemCount[sid] = (supplierItemCount[sid] || 0) + 1;
            });
            const supplierNameMap: Record<string, string> = {};
            effectiveQuotations.forEach((q: any) => {
              const sid = q.quotationId || q.supplierId || q._id || 'unknown';
              supplierNameMap[sid] = q.supplierName || q.organizationName || 'Supplier';
            });
            return Object.entries(supplierItemCount).map(([sid, cnt]) => (
              <span key={sid} className="bca-award-chip bca-award-chip-supplier">
                {supplierNameMap[sid] || sid} — {cnt} {cnt === 1 ? 'Item' : 'Items'}
              </span>
            ));
          })()}
        </div>
        <div className="bca-total-award">
          Total Award Value: <strong>{effectiveQuotations.length > 0 && totalAwardValue > 0 ? fmtINR(totalAwardValue) : "—"}</strong>
        </div>
      </div>

      <div className="bca-award-section">
        {viewMode === "summary" && (
          <div className="bca-table-wrap">
            {lineItems.length === 0 || effectiveQuotations.length === 0 ? (
              <div className="bca-empty">
                {lineItems.length === 0 ? "No line items found for this RFQ." : "No supplier quotations submitted yet for this RFQ."}
              </div>
            ) : (
              <table className="bca-table">
                <thead>
                  <tr>
                    <th className="bca-th-num">#</th>
                    <th>Material</th>
                    <th>Cost Center</th>
                    <th className="bca-th-right">Qty</th>
                    <th>Selected Supplier</th>
                    <th className="bca-th-right">Unit Price</th>
                    <th className="bca-th-right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                   {lineItems.map((item: any, idx: number) => {
                    const itemId = item.id;
                    const awardedQuotation = isRfqAwarded
                      ? effectiveQuotations.find((q: any) => getQuoteItemForRfqItem(q, item)?.isAwarded === true)
                      : null;
                    const selSuppId = awardedQuotation
                      ? (awardedQuotation.quotationId || awardedQuotation.supplierId)
                      : selections[itemId];
                    const selQuotation = selSuppId
                      ? effectiveQuotations.find((q: any) => (q.quotationId || q.supplierId) === selSuppId)
                      : effectiveQuotations[0];
                    const selSupp = selSuppId
                      ? displaySuppliers.find((s) => s.id === selSuppId)
                      : displaySuppliers[0];
                    const selQI = selQuotation ? getQuoteItemForRfqItem(selQuotation, item) : null;

                    const qty = item.quantity || item.qty || 1;
                    const rawUnitPrice = selQI?.quotedPrice ?? selQI?.quotedAmount ?? null;
                    const rawSubtotal  = selQI?.subTotal ?? null;
                    const fallbackTotal  = selQuotation?.totalPrice ?? 0;
                    const fallbackUnit   = fallbackTotal > 0 && lineItems.length > 0
                      ? Math.round(fallbackTotal / lineItems.length / qty)
                      : 0;
                    const unitPrice = rawUnitPrice ?? fallbackUnit;
                    const subtotal  = rawSubtotal  ?? (unitPrice * qty);

                    const itemPrices = effectiveQuotations.map((q: any) => {
                      const qi = getQuoteItemForRfqItem(q, item);
                      return qi?.quotedPrice ?? qi?.quotedAmount ?? 0;
                    }).filter(p => p > 0);
                    const onlyOneSupplier = effectiveQuotations.length === 1;
                    const lowestItemPrice = itemPrices.length > 0 ? Math.min(...itemPrices) : 0;
                    const isLowest = onlyOneSupplier || (unitPrice > 0 && unitPrice <= lowestItemPrice);

                    return (
                      <tr key={itemId}>
                        <td className="bca-td-num">{idx + 1}</td>
                        <td className="bca-td-material-bold">{item.description || item.name || item.materialName || '—'}</td>
                        <td className="bca-cmp-td-muted">{item.costCenter || item.costCenterCode || '—'}</td>
                        <td className="bca-td-price">{qty}</td>
                        <td>
                          <span className="bca-supplier-cell">
                            {selSupp?.name || '—'}
                            {selSupp && isLowest && <span className="bca-lowest-badge">LOWEST</span>}
                          </span>
                        </td>
                        <td className="bca-td-price">{unitPrice > 0 ? fmtINR(unitPrice) : '—'}</td>
                        <td className="bca-td-price bca-td-subtotal">{subtotal > 0 ? fmtINR(subtotal) : '—'}</td>
                      </tr>
                    );
                  })}
                 </tbody>
              </table>
            )}
          </div>
        )}

        {viewMode === "comparison" && (() => {
          if (lineItems.length === 0 || effectiveQuotations.length === 0) {
            return (
              <div className="bca-empty">
                {lineItems.length === 0 ? "No line items found for this RFQ." : "No supplier quotations submitted yet for this RFQ."}
              </div>
            );
          }
          const cmpSuppliers = effectiveQuotations.map((q: any) => {
            const id = q.quotationId || q.supplierId || q._id || 'unknown';
            const name = q.supplierName || q.organizationName || 'Supplier';
            const vs = (q.verificationStatus || q.status || '').toLowerCase().trim();
            let badgeType = 'external';
            if (vs === 'verified' || (vs.includes('verified') && !vs.includes('unverified') && !vs.includes('required') && !vs.includes('not'))) {
              badgeType = 'verified';
            } else if (vs.includes('unverified') || vs.includes('not verified')) {
              badgeType = 'unverified';
            } else if (vs.includes('required') || vs.includes('pending')) {
              badgeType = 'warning';
            } else if (vs.includes('review')) {
              badgeType = 'review';
            }
            const total = (q.totalPrice !== undefined && q.totalPrice !== null)
              ? q.totalPrice
              : (q.supplierQuotationItems || []).reduce(
                  (sum: number, qi: any) => sum + (qi.subTotal ?? (qi.quotedAmount ?? qi.quotedPrice ?? 0) * (qi.quantity ?? 1)), 0
                );
            return { id, name, badgeType, total };
          });

          const cmpItems = lineItems.map((item: any) => {
            const prices: Record<string, number> = {};
            const ranks: Record<string, string> = {};
            const breakdown: Record<string, { discount: number; discountType: string; tax: number; taxType: string; delivery: number; deliveryType: string; subTotal: number | null }> = {};
            const awarded: Record<string, boolean> = {};
            const notAvailable: Record<string, boolean> = {};
            effectiveQuotations.forEach((q: any) => {
              const suppId = q.quotationId || q.supplierId || q._id || 'unknown';
              const qi = getQuoteItemForRfqItem(q, item);
              prices[suppId] = qi?.quotedPrice ?? qi?.quotedAmount ?? 0;
              ranks[suppId] = (qi?.rank ?? qi?.ranking ?? '').toString().toUpperCase().trim();
              breakdown[suppId] = {
                discount: qi?.discount ?? qi?.discountPercentage ?? 0,
                discountType: qi?.discountType || 'PERCENTAGE',
                tax: qi?.tax ?? qi?.taxPercentage ?? qi?.gst ?? 0,
                taxType: qi?.taxType || 'PERCENTAGE',
                delivery: qi?.deliveryCharge ?? qi?.deliveryAmount ?? 0,
                deliveryType: qi?.deliveryType || 'AMOUNT',
                subTotal: qi?.subTotal ?? null,
              };
              awarded[suppId] = qi?.isAwarded === true;
              notAvailable[suppId] = qi?.isLineitemAvailable === true;
            });
            return {
              id: item.id,
              name: item.description || item.name || '—',
              cc: item.costCenter || '—',
              code: item.materialCode || item.code || '—',
              qty: item.quantity || item.qty || 1,
              uom: item.uom || item.unit || '—',
              prices,
              ranks,
              breakdown,
              awarded,
              notAvailable,
            };
          });

          const minTotal = cmpSuppliers.length > 0 ? Math.min(...cmpSuppliers.map(s => s.total)) : 0;

          return (
            <div className="bca-cmp-wrap">
              <table className="bca-cmp-table">
                <thead>
                  <tr>
                    <th className="bca-cmp-th-fixed bca-cmp-th-num">#</th>
                    <th className="bca-cmp-th-fixed bca-cmp-th-mat">Material</th>
                    <th className="bca-cmp-th-fixed">Cost Center</th>
                    <th className="bca-cmp-th-fixed">Code</th>
                    <th className="bca-cmp-th-fixed bca-cmp-th-sm">Qty</th>
                    <th className="bca-cmp-th-fixed bca-cmp-th-sm">UOM</th>
                    {cmpSuppliers.map(s => (
                      <th key={s.id} className={`bca-cmp-th-supp${Object.values(selections).includes(s.id) ? " bca-cmp-th-selected" : ""}`}>
                        <div className="bca-cmp-supp-name">{s.name}</div>
                        <div className="bca-cmp-supp-badge">
                          {renderSupplierTag(s.badgeType)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {cmpItems.map((item, idx) => {
                    const priceValues = Object.values(item.prices as Record<string, number>).filter(p => p > 0);
                    const minPrice = priceValues.length > 0 ? Math.min(...priceValues) : 0;
                    return (
                      <tr key={item.id} className="bca-cmp-row">
                        <td className="bca-cmp-td-fixed bca-td-num">{idx + 1}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-mat">
                          <div className="bca-cmp-mat-name">{item.name}</div>
                        </td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted">{item.cc}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted">{item.code}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted bca-cmp-td-center">{item.qty}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted bca-cmp-td-center">{item.uom}</td>
                        {cmpSuppliers.map(s => {
                          const price = (item.prices as Record<string, number>)[s.id] ?? 0;
                          const total = price * (item.qty || 1);
                          const bd = (item.breakdown as Record<string, any>)[s.id] ?? { discount: 0, discountType: 'PERCENTAGE', tax: 0, taxType: 'PERCENTAGE', delivery: 0, deliveryType: 'AMOUNT' };
                          const rankLabel = (item.ranks as Record<string, string>)?.[s.id] ?? '';
                          const hasRankData = Object.values((item.ranks as Record<string, string>) ?? {}).some(r => r !== '');
                          const isLowest = hasRankData ? (rankLabel === 'L1') : (price > 0 && price === minPrice);
                          const hasManualSelection = !!selections[item.id];
                          const isSelected = hasManualSelection
                            ? selections[item.id] === s.id
                            : isLowest;
                          const isAwardedItem = (item.awarded as Record<string, boolean>)?.[s.id] === true;
                          const isNotAvailable = (item.notAvailable as Record<string, boolean>)?.[s.id] === true;
                          const discAmtResolved = resolveBreakdownAmount(bd.discount, bd.discountType, price);
                          const taxBasis = price - discAmtResolved;
                          const rank = rankLabel || (price > 0 ? String([...Object.values(item.prices as Record<string, number>)].filter(p => p > 0).sort((a, b) => a - b).indexOf(price) + 1) : '');
                          const isCellHighlighted = isRfqAwarded ? isAwardedItem : isSelected;

                          return (
                            <td key={s.id} className={`bca-cmp-td-supp${isCellHighlighted ? " bca-cmp-td-selected" : ""}${isNotAvailable ? " bca-cmp-td-unavailable" : ""}`}>
                              <div className="bca-cmp-price-row">
                                <span className="bca-cmp-price">{total > 0 ? fmtINR(total) : '—'}</span>
                                {isLowest && <span className="bca-lowest-badge">LOWEST</span>}
                                {isNotAvailable && <span className="bca-unavailable-badge">NOT AVAILABLE</span>}
                              </div>
                              {isRfqAwarded ? (
                                isAwardedItem ? (
                                  <button type="button" className="bca-btn bca-cmp-sel-btn bca-cmp-awarded-btn" disabled>
                                    <FaCheck aria-hidden="true" /> Awarded
                                  </button>
                                ) : (
                                  <div className="bca-btn bca-cmp-sel-btn bca-cmp-btn-placeholder" aria-hidden="true">&nbsp;</div>
                                )
                              ) : (
                                <button
                                  type="button"
                                  className={`bca-btn bca-cmp-sel-btn ${isSelected ? "bca-btn-selected" : "bca-btn-outline"}`}
                                  aria-pressed={isSelected}
                                  onClick={() => {
                                    manualSelectionsRef.current.add(item.id);
                                    setSelections(prev => ({ ...prev, [item.id]: s.id }));
                                  }}
                                >
                                  {isSelected ? <><FaCheck aria-hidden="true" /> Selected</> : "Select"}
                                </button>
                              )}
                              <div className="bca-cmp-breakdown">
                                <div className="bca-cmp-breakdown-title">Breakdown</div>
                                <div className="bca-cmp-breakdown-row"><span>Unit Price</span><span>{price > 0 ? fmtINR(price) : '—'}</span></div>
                                {bd.discount > 0 && (
                                  <div className="bca-cmp-breakdown-row bca-cmp-disc">
                                    <span>Discount</span>
                                    <span className="bca-discount">{fmtBreakdownPair(bd.discount, bd.discountType, price, "-")}</span>
                                  </div>
                                )}
                                {bd.tax > 0 && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Tax</span>
                                    <span>{fmtBreakdownPair(bd.tax, bd.taxType, taxBasis)}</span>
                                  </div>
                                )}
                                {bd.delivery > 0 && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Delivery Charge</span>
                                    <span>{fmtBreakdownPair(bd.delivery, bd.deliveryType, price)}</span>
                                  </div>
                                )}
                                {bd.subTotal != null && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Sub Total</span>
                                    <span>{fmtINR(bd.subTotal)}</span>
                                  </div>
                                )}
                                {rank && <div className={`bca-cmp-breakdown-rank${rank === 'L1' ? ' bca-cmp-rank-l1' : ''}`}>
                                  Rank {rank} of {cmpSuppliers.length}
                                </div>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bca-cmp-total-row">
                    <td className="bca-cmp-td-fixed" colSpan={6}><strong>Total</strong></td>
                    {cmpSuppliers.map(s => (
                      <td key={s.id} className={`bca-cmp-td-supp${s.total === minTotal && minTotal > 0 ? " bca-cmp-td-selected" : ""}`}>
                        <div className="bca-cmp-total-price">{s.total > 0 ? fmtINR(s.total) : '—'}</div>
                        {s.total === minTotal && minTotal > 0 && <div className="bca-stag bca-stag-lowest bca-mt-xs">Lowest overall</div>}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}


        {viewMode === "bid-history" && (() => {
          if (bidHistoryLoading) {
            return (
              <div className="bca-loading bca-loading-inline">
                <div className="bca-spinner" aria-hidden="true" />
                <span>Loading Bid History...</span>
              </div>
            );
          }

          if (bidHistoryError) {
            return (
              <div className="bca-empty bca-empty-error" role="alert">
                {bidHistoryError}
              </div>
            );
          }

          if (bidHistoryData.length === 0) {
            return (
              <div className="bca-empty">No bid history found for this RFQ.</div>
            );
          }

          // Use resolvedItems from first supplier (all suppliers share same rfqItems)
          const historyItems = bidHistoryData[0]?.resolvedItems || [];

          const allCurrentTotals = bidHistoryData.map(s => s.currentTotal).filter(t => t > 0);
          const minCurrentTotal = allCurrentTotals.length > 0 ? Math.min(...allCurrentTotals) : 0;

          const isLotOptionEffective = isLotOption || !!bidHistoryApiData?.addLotOption;

          return (
            <div className="bca-cmp-wrap">
              <table className="bca-cmp-table">
                <thead>
                  <tr>
                    <th className="bca-cmp-th-fixed bca-cmp-th-num">#</th>
                    <th className="bca-cmp-th-fixed bca-cmp-th-mat">Material</th>
                    <th className="bca-cmp-th-fixed">Cost Center</th>
                    <th className="bca-cmp-th-fixed">Code</th>
                    <th className="bca-cmp-th-fixed bca-cmp-th-sm">Qty</th>
                    <th className="bca-cmp-th-fixed bca-cmp-th-sm">UOM</th>
                    {bidHistoryData.map(s => (
                      <th key={s.id} className="bca-cmp-th-supp bca-hist-th-supp" colSpan={2}>
                        <div className="bca-cmp-supp-name">{s.name}</div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th className="bca-cmp-th-fixed bca-cmp-th-spacer" colSpan={6} />
                    {bidHistoryData.map(s => (
                      <React.Fragment key={s.id}>
                        <th className="bca-hist-sub-th bca-hist-first">First Bid</th>
                        <th className="bca-hist-sub-th bca-hist-current">Current Bid</th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {historyItems.map((item: any, idx: number) => {
                    return (
                      <tr key={item.id} className="bca-cmp-row">
                        <td className="bca-cmp-td-fixed bca-td-num">{idx + 1}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-mat">
                          <div className="bca-cmp-mat-name">{item.description || item.name || '—'}</div>
                        </td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted">{item.costCenter || '—'}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted">{item.materialCode || '—'}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted bca-cmp-td-center">{item.quantity || 1}</td>
                        <td className="bca-cmp-td-fixed bca-cmp-td-muted bca-cmp-td-center">{item.uom || '—'}</td>
                        {bidHistoryData.map(s => {
                          if (isLotOptionEffective) {
                            return (
                              <React.Fragment key={s.id}>
                                <td className="bca-hist-td bca-hist-first-td">
                                  <span className="bca-cmp-td-muted">NA</span>
                                </td>
                                <td className="bca-hist-td bca-hist-current-td">
                                  <span className="bca-cmp-td-muted">NA</span>
                                </td>
                              </React.Fragment>
                            );
                          }

                          const emptyBreakdown = { discount: 0, discountType: 'PERCENTAGE', tax: 0, taxType: 'PERCENTAGE', delivery: 0, deliveryType: 'AMOUNT', subTotal: null };
                          const itemData = s.itemPrices[item.id] || {
                            firstBid: 0,
                            currentBid: 0,
                            firstBreakdown: emptyBreakdown,
                            currentBreakdown: emptyBreakdown,
                          };
                          const firstPrice = itemData.firstBid;
                          const currentPrice = itemData.currentBid;
                          const qty = item.quantity || 1;
                          const firstLineTotal = firstPrice * qty;
                          const currentLineTotal = currentPrice * qty;
                          const firstBd = itemData.firstBreakdown || emptyBreakdown;
                          const currentBd = itemData.currentBreakdown || emptyBreakdown;

                          const firstDiscAmtResolved = resolveBreakdownAmount(firstBd.discount, firstBd.discountType, firstPrice);
                          const firstTaxBasis = firstPrice - firstDiscAmtResolved;

                          const currentDiscAmtResolved = resolveBreakdownAmount(currentBd.discount, currentBd.discountType, currentPrice);
                          const currentTaxBasis = currentPrice - currentDiscAmtResolved;

                          const decreased = firstPrice > 0 && currentPrice > 0 && currentPrice < firstPrice;
                          const increased = firstPrice > 0 && currentPrice > 0 && currentPrice > firstPrice;
                          const pctChange = firstPrice > 0
                            ? Math.round(((currentPrice - firstPrice) / firstPrice) * 100)
                            : 0;

                          return (
                            <React.Fragment key={s.id}>
                              <td className="bca-hist-td bca-hist-first-td">
                                <span className="bca-cmp-price">{firstLineTotal > 0 ? fmtINR(firstLineTotal) : '—'}</span>
                                <div className="bca-cmp-breakdown bca-cmp-breakdown-tight">
                                  <div className="bca-cmp-breakdown-title">Breakdown</div>
                                  <div className="bca-cmp-breakdown-row"><span>Unit Price</span><span>{firstPrice > 0 ? fmtINR(firstPrice) : '—'}</span></div>
                                  {firstBd.discount > 0 && (
                                    <div className="bca-cmp-breakdown-row bca-cmp-disc">
                                      <span>Discount</span>
                                      <span className="bca-discount">{fmtBreakdownPair(firstBd.discount, firstBd.discountType, firstPrice, "-")}</span>
                                    </div>
                                  )}
                                  {firstBd.tax > 0 && (
                                    <div className="bca-cmp-breakdown-row">
                                      <span>Tax</span>
                                      <span>{fmtBreakdownPair(firstBd.tax, firstBd.taxType, firstTaxBasis)}</span>
                                    </div>
                                  )}
                                  {firstBd.delivery > 0 && (
                                    <div className="bca-cmp-breakdown-row">
                                      <span>Delivery</span>
                                      <span>{fmtBreakdownPair(firstBd.delivery, firstBd.deliveryType, firstPrice)}</span>
                                    </div>
                                  )}
                                  {firstBd.subTotal != null && (
                                    <div className="bca-cmp-breakdown-row">
                                      <span>Sub Total</span>
                                      <span>{fmtINR(firstBd.subTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="bca-hist-td bca-hist-current-td">
                                <div className="bca-hist-current-row">
                                  <span className="bca-cmp-price">{currentLineTotal > 0 ? fmtINR(currentLineTotal) : '—'}</span>
                                  {firstPrice > 0 && currentPrice > 0 && (
                                    <span className={`bca-hist-delta ${decreased ? 'bca-hist-delta-down' : increased ? 'bca-hist-delta-up' : 'bca-hist-delta-same'}`}>
                                      {decreased ? <FaArrowDown aria-hidden="true" /> : increased ? <FaArrowUp aria-hidden="true" /> : '='} {Math.abs(pctChange)}%
                                    </span>
                                  )}
                                </div>
                                <div className="bca-cmp-breakdown bca-cmp-breakdown-tight">
                                  <div className="bca-cmp-breakdown-title">Breakdown</div>
                                  <div className="bca-cmp-breakdown-row"><span>Unit Price</span><span>{currentPrice > 0 ? fmtINR(currentPrice) : '—'}</span></div>
                                  {currentBd.discount > 0 && (
                                    <div className="bca-cmp-breakdown-row bca-cmp-disc">
                                      <span>Discount</span>
                                      <span className="bca-discount">{fmtBreakdownPair(currentBd.discount, currentBd.discountType, currentPrice, "-")}</span>
                                    </div>
                                  )}
                                  {currentBd.tax > 0 && (
                                    <div className="bca-cmp-breakdown-row">
                                      <span>Tax</span>
                                      <span>{fmtBreakdownPair(currentBd.tax, currentBd.taxType, currentTaxBasis)}</span>
                                    </div>
                                  )}
                                  {currentBd.delivery > 0 && (
                                    <div className="bca-cmp-breakdown-row">
                                      <span>Delivery</span>
                                      <span>{fmtBreakdownPair(currentBd.delivery, currentBd.deliveryType, currentPrice)}</span>
                                    </div>
                                  )}
                                  {currentBd.subTotal != null && (
                                    <div className="bca-cmp-breakdown-row">
                                      <span>Sub Total</span>
                                      <span>{fmtINR(currentBd.subTotal)}</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bca-cmp-total-row">
                    <td className="bca-cmp-td-fixed" colSpan={6}><strong>Total</strong></td>
                    {bidHistoryData.map(s => {
                      const isLowest = s.currentTotal > 0 && s.currentTotal === minCurrentTotal;
                      const fLot = s.firstLotBreakdown || { discount: 0, tax: 0, delivery: 0 };
                      const cLot = s.currentLotBreakdown || { discount: 0, tax: 0, delivery: 0 };
                      const fLotTaxBasis = s.firstTotal - resolveBreakdownAmount((fLot as any).discount, (fLot as any).discountType, s.firstTotal);
                      const cLotTaxBasis = s.currentTotal - resolveBreakdownAmount((cLot as any).discount, (cLot as any).discountType, s.currentTotal);

                      return (
                        <React.Fragment key={s.id}>
                          <td className="bca-hist-td bca-hist-first-td">
                            <div className="bca-cmp-total-price">{s.firstTotal > 0 ? fmtINR(s.firstTotal) : '—'}</div>
                            {isLotOptionEffective && s.firstTotal > 0 && (
                              <div className="bca-cmp-breakdown bca-cmp-breakdown-tight">
                                <div className="bca-cmp-breakdown-title">Breakdown</div>
                                {fLot.discount > 0 && (
                                  <div className="bca-cmp-breakdown-row bca-cmp-disc">
                                    <span>Discount</span>
                                    <span className="bca-discount">{fmtBreakdownPair(fLot.discount, (fLot as any).discountType, s.firstTotal, "-")}</span>
                                  </div>
                                )}
                                {fLot.tax > 0 && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Tax</span>
                                    <span>{fmtBreakdownPair(fLot.tax, (fLot as any).taxType, fLotTaxBasis)}</span>
                                  </div>
                                )}
                                {fLot.delivery > 0 && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Delivery Charge</span>
                                    <span>{fmtBreakdownPair(fLot.delivery, (fLot as any).deliveryType, s.firstTotal)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={`bca-hist-td bca-hist-current-td${isLowest ? ' bca-cmp-td-selected' : ''}`}>
                            <div className="bca-cmp-total-price">{s.currentTotal > 0 ? fmtINR(s.currentTotal) : '—'}</div>
                            {isLowest && <div className="bca-stag bca-stag-lowest bca-mt-xs">Lowest current</div>}
                            {isLotOptionEffective && s.currentTotal > 0 && (
                              <div className="bca-cmp-breakdown bca-cmp-breakdown-tight">
                                <div className="bca-cmp-breakdown-title">Breakdown</div>
                                {cLot.discount > 0 && (
                                  <div className="bca-cmp-breakdown-row bca-cmp-disc">
                                    <span>Discount</span>
                                    <span className="bca-discount">{fmtBreakdownPair(cLot.discount, (cLot as any).discountType, s.currentTotal, "-")}</span>
                                  </div>
                                )}
                                {cLot.tax > 0 && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Tax</span>
                                    <span>{fmtBreakdownPair(cLot.tax, (cLot as any).taxType, cLotTaxBasis)}</span>
                                  </div>
                                )}
                                {cLot.delivery > 0 && (
                                  <div className="bca-cmp-breakdown-row">
                                    <span>Delivery Charge</span>
                                    <span>{fmtBreakdownPair(cLot.delivery, (cLot as any).deliveryType, s.currentTotal)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </React.Fragment>
                      );
                    })}
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}


        {viewMode === "by-supplier" && (isLotOption || !isRfqAwarded) && (() => {
          const isLotOptionEffective = isLotOption || !!bidHistoryApiData?.addLotOption;

          const supps = effectiveQuotations.map((q: any, index: number) => {
            const id = q.quotationId || q.supplierId || q._id || 'unknown';
            const rawName = (q.supplierName || q.organizationName || '').trim();
            const isMissingOrGeneric = !rawName || rawName.toLowerCase() === 'null' || rawName.toLowerCase() === 'undefined' || rawName.toLowerCase() === 'supplier';

            let name = rawName;
            if (isLotOptionEffective && isMissingOrGeneric) {
              name = effectiveQuotations.length > 1 ? `Supplier ${index + 1}` : 'Supplier';
            } else if (!name) {
              name = 'Supplier';
            }

            const vs = (q.verificationStatus || q.status || '').toLowerCase().trim();
            let badgeType = 'external';
            if (vs === 'verified' || (vs.includes('verified') && !vs.includes('unverified') && !vs.includes('required') && !vs.includes('not'))) {
              badgeType = 'verified';
            } else if (vs.includes('unverified') || vs.includes('not verified')) {
              badgeType = 'unverified';
            } else if (vs.includes('required') || vs.includes('pending')) {
              badgeType = 'warning';
            } else if (vs.includes('review')) {
              badgeType = 'review';
            }

            const itemsCount = (q.supplierQuotationItems && q.supplierQuotationItems.length > 0)
              ? q.supplierQuotationItems.length
              : lineItems.length;

            const total = (q.totalPrice !== undefined && q.totalPrice !== null)
              ? q.totalPrice
              : (q.supplierQuotationItems || []).reduce(
                  (sum: number, qi: any) => sum + (qi.subTotal ?? (qi.quotedAmount ?? qi.quotedPrice ?? 0) * (qi.quantity ?? 1)), 0
                );

            const outerRankRaw = (q.rank !== undefined && q.rank !== null && q.rank !== '')
              ? String(q.rank).trim().toUpperCase()
              : (q.supplierQuotationRank !== undefined && q.supplierQuotationRank !== null && q.supplierQuotationRank !== '')
                ? String(q.supplierQuotationRank).trim().toUpperCase()
                : '';

            return { id, name, badgeType, itemsCount, total, outerRankRaw, isAwarded: q.isAwarded === true, rawQuotation: q };
          });

          const validTotals = supps.map(s => s.total).filter(t => t > 0);
          const minTotal = validTotals.length > 0 ? Math.min(...validTotals) : 0;
          const lowestSupp = supps.find(s => s.total > 0 && s.total === minTotal) || supps[0];
          const sortedTotals = [...supps].filter(s => s.total > 0).sort((a, b) => a.total - b.total);

          return (
            <div className="bca-supplier-list">
              {supps.length === 0 ? (
                <div className="bca-empty">No supplier quotations found for this RFQ.</div>
              ) : (
                supps.map((s) => {
                  const isLowest = minTotal > 0 && s.total === minTotal;
                  const hasSelections = Object.keys(selections).length > 0;
                  const isSelected = hasSelections
                    ? (lineItems.length > 0 && lineItems.every((i: any) => selections[i.id || i.itemId || i._id] === s.id))
                    : (lowestSupp && lowestSupp.id === s.id);

                  const isExpanded = !!expandedSuppliers[s.id];

                  // Determine rank label strictly from supplierQuotation level rank (q.rank)
                  let rankLabel = '';
                  let isL1 = isLowest;
                  if (s.outerRankRaw) {
                    let cleanR = s.outerRankRaw;
                    if (!cleanR.startsWith('L') && !cleanR.startsWith('RANK')) {
                      cleanR = `L${cleanR}`;
                    }
                    rankLabel = cleanR.startsWith('RANK') ? cleanR : `Rank ${cleanR}`;
                    isL1 = s.outerRankRaw === 'L1' || s.outerRankRaw === '1' || cleanR === 'L1';
                  } else if (!isLotOptionEffective && s.total > 0) {
                    const idx = sortedTotals.findIndex(st => st.id === s.id);
                    if (idx >= 0) {
                      rankLabel = `Rank L${idx + 1}`;
                      isL1 = idx === 0;
                    }
                  }

                  return (
                    <div
                      key={s.id}
                      className={`bca-supplier-row${isSelected ? " bca-supplier-row-selected" : ""} bca-supplier-row-expanded`}
                    >
                      <div className="bca-supplier-row-header">
                        <div className="bca-supplier-row-left">
                          <div className="bca-supplier-row-title">
                            {isLotOptionEffective && (
                              <button
                                type="button"
                                className="bca-expand-plus-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedSuppliers(prev => ({ ...prev, [s.id]: !prev[s.id] }));
                                }}
                                title={isExpanded ? "Collapse item details" : "Expand item details"}
                                aria-label={isExpanded ? "Collapse item details" : "Expand item details"}
                                aria-expanded={isExpanded}
                              >
                                {isExpanded ? <FaChevronDown aria-hidden="true" /> : <FaChevronRight aria-hidden="true" />}
                              </button>
                            )}
                            <div className="bca-supplier-row-name">{s.name}</div>
                            {isLotOptionEffective && rankLabel && (
                              <span className={`bca-stag bca-stag-rank ${isL1 ? 'bca-stag-lowest' : 'bca-stag-verified'}`}>
                                {rankLabel}
                              </span>
                            )}
                            {isLotOptionEffective && s.isAwarded && (
                              <StatusBadge status="Awarded" size="sm" className="bca-stag bca-stag-awarded" />
                            )}
                          </div>
                          <div className="bca-supplier-row-tags">
                            {renderSupplierTag(s.badgeType)}
                            {isLowest && <span className="bca-stag bca-stag-lowest">Lowest overall</span>}
                          </div>
                        </div>
                        <div className="bca-supplier-row-right">
                          <div className="bca-supplier-row-total-block">
                            <div className="bca-supplier-row-total-label">Total ({s.itemsCount} items)</div>
                            <div className="bca-supplier-row-total">{s.total > 0 ? fmtINR(s.total) : '—'}</div>
                          </div>
                          <button
                            type="button"
                            className={`bca-btn ${isSelected ? "bca-btn-selected" : "bca-btn-outline"}`}
                            aria-pressed={!!isSelected}
                            onClick={() => selectAllForSupplier(s.id)}
                          >
                            {isSelected && s.rawQuotation?.isAwarded === true
                              ? <><FaCheck aria-hidden="true" /> Awarded</>
                              : isSelected
                                ? <><FaCheck aria-hidden="true" /> Selected</>
                                : "Select All Items"}
                          </button>
                        </div>
                      </div>

                      {isLotOptionEffective && isExpanded && (() => {
                        const q = effectiveQuotations.find((qItem: any) => (qItem.quotationId || qItem.supplierId || qItem._id) === s.id);
                        return (
                          <div className="bca-supplier-expanded-content">
                            <div className="bca-supplier-expanded-title">
                              Items &amp; Breakdown for {s.name}
                            </div>
                            <div className="bca-table-wrap">
                              <table className="bca-table bca-expanded-table">
                                <thead>
                                  <tr>
                                    <th className="bca-th-num">#</th>
                                    <th>Material</th>
                                    <th>Cost Center</th>
                                    <th>Code</th>
                                    <th className="bca-td-center-text">Qty</th>
                                    <th className="bca-td-center-text">UOM</th>
                                    <th className="bca-th-right">Unit Price</th>
                                    <th className="bca-th-right">Subtotal</th>
                                    <th>Breakdown &amp; Rank</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {lineItems.map((item: any, idx: number) => {
                                    const qi = q ? getQuoteItemForRfqItem(q, item) : null;
                                    const price = qi?.quotedPrice ?? qi?.quotedAmount ?? 0;
                                    const qty = item.quantity || item.qty || 1;
                                    const subtotal = qi?.subTotal ?? (price * qty);
                                    const discount = qi?.discount ?? qi?.discountPercentage ?? 0;
                                    const tax = qi?.tax ?? qi?.taxPercentage ?? qi?.gst ?? 0;
                                    const delivery = qi?.deliveryCharge ?? qi?.deliveryAmount ?? 0;
                                    const discountType = (qi as any)?.discountType || 'PERCENTAGE';
                                    const taxType = (qi as any)?.taxType || 'PERCENTAGE';
                                    const deliveryType = (qi as any)?.deliveryType || 'AMOUNT';
                                    const rank = (qi?.rank ?? qi?.ranking ?? '').toString().toUpperCase().trim();

                                    const extendedPrice = price * qty;
                                    const discAmtResolved = resolveBreakdownAmount(discount, discountType, extendedPrice);
                                    const taxBasis = extendedPrice - discAmtResolved;

                                    return (
                                      <tr key={item.id || idx}>
                                        <td className="bca-td-num">{idx + 1}</td>
                                        <td className="bca-td-material-bold">{item.description || item.name || '—'}</td>
                                        <td className="bca-cmp-td-muted">{item.costCenter || '—'}</td>
                                        <td className="bca-cmp-td-muted">{item.materialCode || item.code || '—'}</td>
                                        <td className="bca-td-center-text">{qty}</td>
                                        <td className="bca-td-center-text">{item.uom || '—'}</td>
                                        <td className="bca-td-price">{price > 0 ? fmtINR(price) : '—'}</td>
                                        <td className="bca-td-price bca-td-subtotal">{subtotal > 0 ? fmtINR(subtotal) : '—'}</td>
                                        <td>
                                          <div className="bca-expanded-breakdown">
                                            {discount > 0 && (
                                              <span>Discount: {fmtBreakdownPair(discount, discountType, extendedPrice, "-")}</span>
                                            )}
                                            {tax > 0 && (
                                              <span>Tax: {fmtBreakdownPair(tax, taxType, taxBasis)}</span>
                                            )}
                                            {delivery > 0 && (
                                              <span>Delivery: {fmtBreakdownPair(delivery, deliveryType, extendedPrice)}</span>
                                            )}
                                            {rank && (
                                              <span className={`bca-cmp-breakdown-rank${rank === 'L1' ? ' bca-cmp-rank-l1' : ''} bca-rank-fit`}>
                                                Rank {rank}
                                              </span>
                                            )}
                                            {!discount && !tax && !delivery && !rank && <span className="bca-mono">—</span>}
                                          </div>
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })
              )}
            </div>
          );
        })()}
      </div>

      {/* Create Contract Entry Card - Right Above RFQ Documents */}
      {isRfqAwarded && <div
        className="bca-section-card bca-contract-entry-card"
        style={{
          marginBottom: '24px',
          padding: '36px 24px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: '#ECFDF5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', margin: '0 0 8px 0' }}>
          Award Completed
        </h2>
        <p style={{ fontSize: '14px', color: '#475569', margin: '0 0 24px 0', maxWidth: '540px', lineHeight: '1.5' }}>
          {hasContract
            ? "The RFQ has been awarded and a contract has been created. View the contract details."
            : "The RFQ has been awarded. Continue to create the supplier contract."}
        </p>
        <button
          type="button"
          className="bca-btn bca-btn-primary"
          onClick={() => {
            setContractCreated(true);
            setScreen("contract");
          }}
          style={{
            padding: '10px 24px',
            fontSize: '14px',
            fontWeight: 600,
            borderRadius: '8px',
            background: hasContract || contractCreated || isSupplierInvitedForContract ? '#059669' : '#2563eb',
            color: '#ffffff',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 2px 4px rgba(37, 99, 235, 0.2)',
          }}
        >
          {hasContract
            ? 'View Contract'
            : contractCreated || isSupplierInvitedForContract
              ? '✓ Contract Workspace'
              : 'Create Contract'}
        </button>
      </div>}

      {/* RFQ Documents Section */}
      {((rfq?.technicalSpecificationDocuments && rfq.technicalSpecificationDocuments.length > 0) ||
        (rfq?.termsConditionDocuments && rfq.termsConditionDocuments.length > 0)) && (
        <div className="bca-section-card">
          <div className="bca-section-header">
            <h3 className="bca-section-title">RFQ Documents</h3>
            <p className="bca-section-sub">Technical specifications, requirements, and Terms &amp; Conditions documents attached to this RFQ.</p>
          </div>

          {/* Technical Specification Documents */}
          {rfq?.technicalSpecificationDocuments && rfq.technicalSpecificationDocuments.length > 0 && (
            <div className={rfq?.termsConditionDocuments && rfq.termsConditionDocuments.length > 0 ? "bca-doc-group bca-doc-group-spaced" : "bca-doc-group"}>
              <div className="bca-doc-group-title">
                <span className="bca-doc-icon bca-doc-icon-blue bca-doc-icon-sm" aria-hidden="true"><IconFile /></span>
                Technical Specification Documents
              </div>
              <div className="bca-docs-grid">
                {rfq.technicalSpecificationDocuments.map((doc: any, i: number) => (
                  <div key={`tech-${i}`} className="bca-doc-card">
                    <div className="bca-doc-info">
                      <div className="bca-doc-icon bca-doc-icon-blue" aria-hidden="true"><IconFile /></div>
                      <div className="bca-doc-text">
                        <div className="bca-doc-name" title={doc.fileName || doc.assetName}>{doc.fileName || doc.assetName || `Tech Spec Document ${i + 1}`}</div>
                        <div className="bca-doc-type">Tech Spec Doc</div>
                      </div>
                    </div>
                    <div className="bca-doc-actions">
                      <button
                        type="button"
                        className="bca-doc-action-btn bca-doc-eye"
                        title="Preview document"
                        aria-label="Preview document"
                        disabled={loadingDocId === (doc.id || doc.assetId)}
                        onClick={() => handleDocumentAction(doc, 'preview')}
                      >
                        <IconEye />
                      </button>
                      <button
                        type="button"
                        className="bca-doc-action-btn bca-doc-download"
                        title="Download document"
                        aria-label="Download document"
                        disabled={loadingDocId === (doc.id || doc.assetId)}
                        onClick={() => handleDocumentAction(doc, 'download')}
                      >
                        <IconDownload />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms & Conditions Documents */}
          {rfq?.termsConditionDocuments && rfq.termsConditionDocuments.length > 0 && (
            <div>
              <div className="bca-doc-group-title">
                <span className="bca-doc-icon bca-doc-icon-amber bca-doc-icon-sm" aria-hidden="true"><IconFile /></span>
                Terms &amp; Conditions Documents
              </div>
              <div className="bca-docs-grid">
                {rfq.termsConditionDocuments.map((doc: any, i: number) => (
                  <div key={`terms-${i}`} className="bca-doc-card">
                    <div className="bca-doc-info">
                      <div className="bca-doc-icon bca-doc-icon-amber" aria-hidden="true"><IconFile /></div>
                      <div className="bca-doc-text">
                        <div className="bca-doc-name" title={doc.fileName || doc.assetName}>{doc.fileName || doc.assetName || `Terms Document ${i + 1}`}</div>
                        <div className="bca-doc-type">Terms &amp; Conditions</div>
                      </div>
                    </div>
                    <div className="bca-doc-actions">
                      <button
                        type="button"
                        className="bca-doc-action-btn bca-doc-eye"
                        title="Preview document"
                        aria-label="Preview document"
                        disabled={loadingDocId === (doc.id || doc.assetId)}
                        onClick={() => handleDocumentAction(doc, 'preview')}
                      >
                        <IconEye />
                      </button>
                      <button
                        type="button"
                        className="bca-doc-action-btn bca-doc-download"
                        title="Download document"
                        aria-label="Download document"
                        disabled={loadingDocId === (doc.id || doc.assetId)}
                        onClick={() => handleDocumentAction(doc, 'download')}
                      >
                        <IconDownload />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Evaluation Questions & Answers Section */}
      {questions?.length > 0 && qaSuppliers?.length > 0 && (
        <div className="bca-section-card">
          <div className="bca-section-header">
            <h3 className="bca-section-title">Evaluation Questions &amp; Answers</h3>
            <p className="bca-section-sub">Responses submitted by each supplier for this RFQ. Select a supplier to review their answers.</p>
          </div>

          <div className="sila-tabs bca-qa-tabs" role="tablist" aria-label="Suppliers">
            {qaSuppliers.map((supplier: any, sIdx: number) => {
              const displayName = supplier?.supplierName || supplier?.organizationName || `Supplier ${sIdx + 1}`;
              const answered = questions.filter((q: any) => isQuestionAnswered(supplier, q)).length;
              const selected = supplier === activeQaSupplier;
              return (
                <button
                  key={supplier?.supplierRFQId ? `${supplier.supplierRFQId}-${sIdx}` : sIdx}
                  type="button"
                  role="tab"
                  id={`bca-qa-tab-${sIdx}`}
                  aria-selected={selected}
                  aria-controls="bca-qa-panel"
                  className="sila-tab bca-qa-tab"
                  onClick={() => setQaSupplierIndex(sIdx)}
                >
                  <span className="bca-qa-avatar" aria-hidden="true">{getInitials(displayName)}</span>
                  {displayName}
                  <span className={`sila-count ${answered >= questions.length ? "sila-count--success" : "sila-count--neutral"}`}>
                    {answered}/{questions.length}
                  </span>
                </button>
              );
            })}
          </div>

          {activeQaSupplier && (() => {
            const activeIndex = qaSuppliers.indexOf(activeQaSupplier);
            const displayName = activeQaSupplier?.supplierName || activeQaSupplier?.organizationName || `Supplier ${activeIndex + 1}`;
            const answered = questions.filter((q: any) => isQuestionAnswered(activeQaSupplier, q)).length;

            return (
              <div id="bca-qa-panel" role="tabpanel" aria-labelledby={`bca-qa-tab-${activeIndex}`} className="bca-qa-panel">
                <div className="bca-qa-panel-header">
                  <span className="bca-qa-panel-name">{displayName}</span>
                  <QuestionProgress answered={answered} total={questions.length} />
                </div>

                <QuestionList aria-label={`${displayName} answers`}>
                  {questions.map((q: any, qIdx: number) => {
                    const match = getAnswerForQuestion(activeQaSupplier, q);
                    const file = getAnswerFile(match);
                    const text = match?.answer && String(match.answer).trim() !== "" ? match.answer : file?.fileName || "";

                    return (
                      <QuestionItem
                        key={q?.id || qIdx}
                        index={qIdx + 1}
                        question={q?.question}
                        typeLabel={formatQuestionType(q?.questionType)}
                        required={Boolean(q?.isRequired)}
                      >
                        <QuestionAnswer value={text} emptyText="No response yet">
                          {file ? (
                            <div className="bca-doc-actions">
                              <button
                                type="button"
                                className="sila-btn sila-btn--secondary sila-btn--sm"
                                onClick={() => handleDocumentAction(file, 'preview', fetchSupplierAnswerAsset)}
                                disabled={loadingDocId === file.id}
                                aria-label={`View ${file.fileName}`}
                              >
                                {loadingDocId === file.id ? <span className="sila-spinner" aria-hidden="true" /> : <IconEye />} View
                              </button>
                              <button
                                type="button"
                                className="sila-btn sila-btn--secondary sila-btn--sm"
                                onClick={() => handleDocumentAction(file, 'download', fetchSupplierAnswerAsset)}
                                disabled={loadingDocId === file.id}
                                aria-label={`Download ${file.fileName}`}
                              >
                                <IconDownload /> Download
                              </button>
                            </div>
                          ) : (
                            isFileQuestion(q) && text && (
                              <span className="sila-help">File not available for viewing</span>
                            )
                          )}
                        </QuestionAnswer>
                      </QuestionItem>
                    );
                  })}
                </QuestionList>
              </div>
            );
          })()}
        </div>
      )}

      {/* Document Preview Overlay Modal */}
      {viewingDoc && (
        <div className="bca-modal-overlay">
          <div className="bca-doc-viewer-modal" role="dialog" aria-modal="true" aria-label={viewingDoc?.fileName || "Document preview"}>
            <div className="bca-doc-viewer-header">
              <span className="bca-doc-viewer-title">{viewingDoc?.fileName}</span>
              <button
                type="button"
                className="bca-back-circle-btn"
                aria-label="Close preview"
                onClick={() => {
                  if (viewingDoc?.url?.startsWith('blob:')) {
                    URL.revokeObjectURL(viewingDoc.url);
                  }
                  setViewingDoc(null);
                }}
              >
                <IconClose />
              </button>
            </div>
            <iframe
              src={viewingDoc?.url}
              title={viewingDoc?.fileName}
              className="bca-doc-viewer-iframe"
            />
          </div>
        </div>
      )}

      {!isRfqAwarded && (
      <div className="bca-bottom-bar">
        <div className="bca-bottom-left">
          <StatusBadge
            status={isBidFrozen ? "Frozen" : "Active"}
            label={isBidFrozen ? "Bid Frozen" : "Bidding Active"}
            dot
            className={`bca-bar-status ${isBidFrozen ? "bca-bar-frozen" : "bca-bar-active"}`}
          />
          <span className="bca-bar-text">{selectedItemCount} of {lineItems.length} Line Items Selected</span>
          <span className="bca-bar-text">{distinctSelected.length} Supplier{distinctSelected.length !== 1 ? "s" : ""}</span>
          {totalAwardValue > 0 && <span className="bca-total-award">Total Award Value: <strong>{fmtINR(totalAwardValue)}</strong></span>}
        </div>
        <button
          type="button"
          className={`bca-btn ${barButtonDisabled ? "bca-btn-disabled" : "bca-btn-primary"}`}
          disabled={barButtonDisabled}
          onClick={() => {
            if (isBidFrozen) setShowAwardModal(true);
            else setShowFreezeModal(true);
          }}
        >
          {barButtonLabel}
        </button>
      </div>
      )}

      {showFreezeModal && (
        <div className="bca-modal-overlay">
          <div className="bca-modal-content" role="alertdialog" aria-modal="true" aria-labelledby="bca-freeze-title">
            <h2 className="bca-modal-title" id="bca-freeze-title">Freeze Bidding?</h2>
            <p className="bca-modal-text">
              Freezing the bid will stop suppliers from submitting or modifying quotations.
              You can then compare the final bids and proceed with the award.
            </p>
            <div className="bca-modal-stats">
              <div className="bca-modal-stat">
                <div className="bca-modal-stat-label">Current Participants</div>
                <div className="bca-modal-stat-value">{displaySuppliers.length}</div>
              </div>
              <div className="bca-modal-stat">
                <div className="bca-modal-stat-label">Line Items</div>
                <div className="bca-modal-stat-value">{lineItems.length}</div>
              </div>
            </div>
            <div className="bca-modal-actions">
              <button type="button" className="bca-btn bca-btn-ghost bca-modal-cancel" onClick={() => setShowFreezeModal(false)}>Cancel</button>
              <button type="button" className="bca-btn bca-btn-primary bca-modal-confirm" onClick={() => { setShowFreezeModal(false); onFreeze(); }}>Freeze Bid</button>
            </div>
          </div>
        </div>
      )}

      {showUnawardModal && (
        <div className="bca-modal-overlay">
          <div className="bca-modal-content" role="alertdialog" aria-modal="true" aria-labelledby="bca-unaward-title">
            <h2 className="bca-modal-title" id="bca-unaward-title">Unaward RFQ?</h2>
            <p className="bca-modal-text">
              This will revert the RFQ's status back to bid freezing so you can select and award a
              different supplier. The current award will no longer apply.
            </p>
            {unawardError && (
              <div className="bca-award-error" role="alert">
                {unawardError}
              </div>
            )}
            <div className="bca-modal-actions">
              <button
                type="button"
                className="bca-btn bca-btn-ghost bca-modal-cancel"
                onClick={() => { setShowUnawardModal(false); setUnawardError(null); }}
                disabled={unawardingRfq}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`bca-btn ${unawardingRfq ? 'bca-btn-disabled' : 'bca-btn-primary'} bca-modal-confirm`}
                onClick={handleUnaward}
                disabled={unawardingRfq}
              >
                {unawardingRfq ? 'Unawarding...' : 'Unaward RFQ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAwardModal && (() => {
        // Group selections by supplier ID to calculate totals and item counts per selected supplier
        const supplierSummaryMap: Record<string, { name: string; itemsCount: number; totalValue: number }> = {};

        lineItems.forEach((item: any) => {
          const itemId = item.id || item.itemId || item._id;
          const sid = selections[itemId];
          if (!sid) return;

          const quotation = effectiveQuotations.find(
            (q: any) => (q.quotationId || q.supplierId || q._id) === sid
          );
          const sName = quotation?.supplierName || quotation?.organizationName || 'Supplier';

          const qi = quotation ? getQuoteItemForRfqItem(quotation, item) : null;
          const qty = item?.quantity || item?.qty || 1;
          const rawSubtotal = qi?.subTotal ?? null;
          const rawUnitPrice = qi?.quotedAmount ?? qi?.quotedPrice ?? 0;
          const subtotal = rawSubtotal ?? (rawUnitPrice * qty);

          if (!supplierSummaryMap[sid]) {
            supplierSummaryMap[sid] = { name: sName, itemsCount: 0, totalValue: 0 };
          }
          supplierSummaryMap[sid].itemsCount += 1;
          supplierSummaryMap[sid].totalValue += subtotal;
        });

        const selectedSuppliersList = Object.values(supplierSummaryMap);
        const displayList = selectedSuppliersList.length > 0
          ? selectedSuppliersList
          : displaySuppliers.slice(0, 1).map((s: any) => ({
              name: s.name || 'Global Supplies',
              itemsCount: lineItems.length || 1,
              totalValue: s.total || totalAwardValue,
            }));

        return (
          <div className="bca-modal-overlay">
            <div className="bca-modal-content bca-modal-lg" role="dialog" aria-modal="true" aria-labelledby="bca-award-title">
              {awardSuccess ? (
                <div className="bca-award-success">
                  <div className="bca-award-success-icon" aria-hidden="true"><FaCheck /></div>
                  <h2 className="bca-modal-title bca-award-success-title" id="bca-award-title">RFQ Awarded Successfully!</h2>
                  <p className="bca-modal-text">The award has been processed. Selected suppliers have been notified.</p>
                  <div className="bca-modal-stats bca-award-success-stats">
                    <div className="bca-modal-stat">
                      <div className="bca-modal-stat-label">Awarded Value</div>
                      <div className="bca-modal-stat-value">{fmtINR(totalAwardValue)}</div>
                    </div>
                    <div className="bca-modal-stat">
                      <div className="bca-modal-stat-label">Items Awarded</div>
                      <div className="bca-modal-stat-value">{selectedItemCount}</div>
                    </div>
                  </div>
                  <div className="bca-modal-actions bca-award-success-actions">
                    <button
                      type="button"
                      className="bca-btn bca-btn-primary"
                      onClick={() => { setShowAwardModal(false); setAwardSuccess(false); }}
                    >
                      Close
                    </button>
                    <button
                      className="bca-btn bca-btn-primary"
                      onClick={() => {
                        setShowAwardModal(false);
                        setAwardSuccess(false);
                        setContractCreated(true);
                        setScreen("contract");
                      }}
                    >
                      Create Contract
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <h2 className="bca-modal-title bca-modal-title-lg" id="bca-award-title">Confirm Award Selection</h2>
                  <p className="bca-modal-text bca-modal-text-lg">
                    Review the selected supplier(s) and confirm the award for this RFQ.
                  </p>

                  {displayList.map((sup, idx) => (
                    <div key={idx} className="bca-award-veri-card">
                      <div className="bca-award-veri-header">
                        <div>
                          <div className="bca-award-veri-name">{sup.name}</div>
                          <div className="bca-stag bca-stag-external bca-mt-sm">Selected supplier</div>
                        </div>
                        <div className="bca-award-veri-totals">
                          <div className="bca-award-veri-items">{sup.itemsCount} {sup.itemsCount === 1 ? 'Item' : 'Items'}</div>
                          <div className="bca-award-veri-price">{fmtINR(sup.totalValue)}</div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {awardError && (
                    <div className="bca-award-error" role="alert">
                      {awardError}
                    </div>
                  )}

                  <div className="bca-modal-footer">
                    <div className="bca-modal-footer-left">
                      <span className="bca-total-award">Total Award Value: <strong>{fmtINR(totalAwardValue)}</strong></span>
                    </div>
                    <div className="bca-modal-actions">
                      <button
                        type="button"
                        className="bca-btn bca-btn-ghost bca-modal-cancel"
                        onClick={() => { setShowAwardModal(false); setAwardError(null); }}
                        disabled={awardingRfq}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={`bca-btn ${awardingRfq ? 'bca-btn-disabled' : 'bca-btn-primary'} bca-modal-confirm`}
                        onClick={handleConfirmAward}
                        disabled={awardingRfq}
                      >
                        {awardingRfq ? 'Awarding...' : 'Confirm Award'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}
        </>
      )}
    </div>
  );
};

export default BidComparisonAwardView;
