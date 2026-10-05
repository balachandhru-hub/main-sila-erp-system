import React, { useEffect, useMemo, useRef, useState } from "react";
import "./SupplierRfqQuotationSummary.css";
import ContractCreationView from "../../../remote-platform-user/src/components/ContractCreationView";
import {
  fetchRFQById,
  fetchSupplierQuotationBySupplierId,
  submitSupplierQuotation,
  submitRfqAnswers,
  fetchMetadataReferenceList,
  uploadSupplierTermsAndCondition,
  uploadSupplierEsign,
  updateBuyerTermsConditionStatus,
  fetchSupplierContractById,
  createSupplierChatApi,
  type RFQDetailResponse,
  type SubmitQuotationPayload,
  type RfqDocumentAssetDto,
  type SupplierQuotationByIdItem,
  type PersonDetailDto,
  fetchBuyerAsset,
} from "../api/supplierApi";
import { apiKey as supplierApiKey } from "../api/supplierInstance";
import { useSupplierAuthStore } from "../store/useSupplierAuthStore";
import {
  Button,
  ChatPanel,
  EmptyState,
  Loader,
  PageHeader,
  StatusBadge,
  isErrorResponse,
  Dropdown,
  startRfqChatHub,
  stopRfqChatHub,
} from "@vosox/shared-ui";
import type { QuotationSubmittedEvent } from "@vosox/shared-ui";
import { useOtpVerification, getCookie, deleteCookie, VERIFICATION_TOKEN_COOKIE } from "../hooks/useOtpVerification";
import { useQuotationExcelSync, type QuoteLineItem } from "../hooks/useQuotationExcelSync";
import { useBulkApply } from "../hooks/useBulkApply";

const TYPE_OPTIONS = [
  { name: "Percentage", value: "PERCENTAGE" },
  { name: "Amount", value: "AMOUNT" },
];

const getTypeOption = (type: string) => TYPE_OPTIONS.find((option) => option.value === type) ?? null;

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconMessageSquare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconContract = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);

const IconCheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconAlertCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

interface SupplierRfqQuotationSummaryProps {
  selectedRfq: RFQDetailResponse | null;
  selectedRfqId: string | null;
  ownQuotation: SupplierQuotationByIdItem | null;
  loadingRfqDetail: boolean;
  rfqDetailError: string | null;
  supplierId: string | null;
  onClose: () => void;
  onRetry: () => void;
  setSelectedRfq: React.Dispatch<React.SetStateAction<RFQDetailResponse | null>>;
  setOwnQuotation: React.Dispatch<React.SetStateAction<SupplierQuotationByIdItem | null>>;
  onRfqsRefresh: () => void;
  /** Passed by hosts whose logged-in profile isn't in the supplier auth store (Supplier Admin). */
  personDetail?: PersonDetailDto | null;
}

const SupplierRfqQuotationSummary: React.FC<SupplierRfqQuotationSummaryProps> = ({
  selectedRfq,
  selectedRfqId,
  ownQuotation,
  loadingRfqDetail,
  rfqDetailError,
  supplierId,
  onClose,
  onRetry,
  setSelectedRfq,
  setOwnQuotation,
  onRfqsRefresh,
  personDetail,
}) => {
  // Sourced from the store, which fetches it once (on login and on reload) via
  // SupplierApp's mount effect - no per-component fetch, no local cache.
  const storePersonDetail = useSupplierAuthStore((state) => state.personDetail);
  const chatProfile = personDetail ?? storePersonDetail;
  const isLoadingChatProfile = useSupplierAuthStore((state) => state.personDetailLoading);

  const [isChatOpen, setIsChatOpen] = useState(false);

  // The RFQ's own currency (e.g. "INR", "USD") — RFQDetailResponse doesn't
  // declare this field, but the supplier's own quotation does, so fall back
  // to that. Left blank (not defaulted to "INR") when neither returns one,
  // since guessing a currency could mislead the supplier.
  const currency = (selectedRfq as any)?.currency || ownQuotation?.currency || "";
  const fmtCurrency = (val: number) => `${(val || 0).toFixed(2)}${currency ? ` ${currency}` : ""}`;

  const [showConfirmSubmit, setShowConfirmSubmit] = useState(false);
  const {
    otpStage,
    setOtpStage,
    otpCode,
    setOtpCode,
    otpError,
    setOtpError,
    sendingOtp,
    verifyingOtp,
    otpRemaining,
    handleSendOtp,
    handleVerifyOtp,
  } = useOtpVerification({ onVerified: () => setShowConfirmSubmit(true) });

  const formatOtpTimer = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, "0");
    const s = (secs % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const parseAsUtcMs = (dateStr?: string | null): number | null => {
    if (!dateStr) return null;
    const hasTz = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr);
    const ms = Date.parse(hasTz ? dateStr : `${dateStr}Z`);
    return Number.isNaN(ms) ? null : ms;
  };

  const getRfqSubmissionWindowStatus = (rfq: RFQDetailResponse | null) => {
    if (!rfq) return { notYetOpen: false, closed: false, frozen: false, canSubmit: false };
    const startMs = parseAsUtcMs(rfq.startDate);
    const endMs = parseAsUtcMs(rfq.endDate);
    const nowMs = Date.now();

    const notYetOpen = startMs !== null && nowMs < startMs;
    const closed = endMs !== null && nowMs > endMs;
    const frozen = rfq.status === "Freezing";

    return { notYetOpen, closed, frozen, canSubmit: !notYetOpen && !closed && !frozen };
  };

  const [rfqAnswers, setRfqAnswers] = useState<{
    [questionId: string]: {
      rfqQuestionId: string;
      answer: string;
      questionOptionId: string | null;
      questionOptionIds: string[];
      file?: File;
      fileBase64?: string;
      contentType?: string;
    };
  }>({});
  const [submittingAnswers, setSubmittingAnswers] = useState(false);
  const [submitAnswersError, setSubmitAnswersError] = useState<string | null>(null);
  const [submitAnswersSuccess, setSubmitAnswersSuccess] = useState(false);
  const [rfqWindowTick, setRfqWindowTick] = useState(0);

  useEffect(() => {
    if (!selectedRfq) return;
    const t = setInterval(() => setRfqWindowTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [selectedRfq]);

  // Live-refreshes this supplier's own quotation/rank the moment it changes
  // server-side - e.g. a teammate at the same supplier org submitting from
  // another tab/session. Uses the same shared hub connection the RFQ chat
  // drawer below opens on top of this screen (see rfqChatHub.ts) rather
  // than a second parallel connection.
  const quotationRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selectedRfqId || !supplierId) return;

    const handleQuotationSubmitted = (payload: QuotationSubmittedEvent) => {
      if (payload?.SupplierId && payload.SupplierId !== supplierId) return;

      // Coalesce a burst of near-simultaneous events into a single re-fetch.
      if (quotationRefetchTimerRef.current) clearTimeout(quotationRefetchTimerRef.current);
      quotationRefetchTimerRef.current = setTimeout(async () => {
        try {
          const updatedDetails = await fetchRFQById(selectedRfqId);
          if (!isErrorResponse(updatedDetails)) setSelectedRfq(updatedDetails);

          const updatedQuotation = await fetchSupplierQuotationBySupplierId(selectedRfqId);
          if (
            !isErrorResponse(updatedQuotation) &&
            updatedQuotation &&
            "suppliers" in updatedQuotation &&
            Array.isArray(updatedQuotation.suppliers)
          ) {
            const mine =
              updatedQuotation.suppliers.find((s) => s.supplierId === supplierId) ||
              updatedQuotation.suppliers[0] ||
              null;
            setOwnQuotation(mine);
          }
        } catch {
          // A missed live refresh isn't fatal - reopening the RFQ re-fetches anyway.
        }
      }, 500);
    };

    startRfqChatHub(
      { rfqId: selectedRfqId, supplierId, headers: { "X-API-Key": supplierApiKey } },
      () => {},
      undefined,
      handleQuotationSubmitted
    ).catch((err) => {
      console.error("[SupplierRfqQuotationSummary] SignalR connection failed:", err);
    });

    return () => {
      if (quotationRefetchTimerRef.current) clearTimeout(quotationRefetchTimerRef.current);
      stopRfqChatHub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRfqId, supplierId]);

  const { notYetOpen, closed, frozen, canSubmit } = useMemo(
    () => getRfqSubmissionWindowStatus(selectedRfq),
    [selectedRfq, rfqWindowTick],
  );

  const [quoteQuotationId, setQuoteQuotationId] = useState<string | null>(null);
  const [quoteTotalPrice, setQuoteTotalPrice] = useState<number>(0);
  const [quoteDeliveryCharge, setQuoteDeliveryCharge] = useState<number>(0);
  const [quoteDeliveryType, setQuoteDeliveryType] = useState<string>("PERCENTAGE");
  const [quoteDiscount, setQuoteDiscount] = useState<number>(0);
  const [quoteDiscountType, setQuoteDiscountType] = useState<string>("PERCENTAGE");
  const [quoteTax, setQuoteTax] = useState<number>(0);
  const [quoteTaxType, setQuoteTaxType] = useState<string>("PERCENTAGE");
  const [quoteItemPrices, setQuoteItemPrices] = useState<{ [key: string]: number }>({});

  const [quoteLineItems, setQuoteLineItems] = useState<{ [supplierRFQItemId: string]: QuoteLineItem }>({});

  const [submittingQuote, setSubmittingQuote] = useState(false);
  const [submitQuoteError, setSubmitQuoteError] = useState<string | null>(null);
  const [submitQuoteSuccess, setSubmitQuoteSuccess] = useState(false);

  const [showContractView, setShowContractView] = useState(false);
  const [openingContract, setOpeningContract] = useState(false);
  const [contractLoadError, setContractLoadError] = useState<string | null>(null);

  // Reload the RFQ first so the contract screen shows the latest terms & conditions, buyer acceptance and e-signature.
  const handleReviewContract = async () => {
    if (!selectedRfqId) return;
    setOpeningContract(true);
    setContractLoadError(null);
    try {
      const latest = await fetchRFQById(selectedRfqId);
      if (isErrorResponse(latest)) {
        setContractLoadError(latest.description || latest.message || "Failed to load the contract details.");
        return;
      }
      setSelectedRfq(latest);
      setShowContractView(true);
    } catch (err: any) {
      setContractLoadError(err?.message || "Failed to load the contract details.");
    } finally {
      setOpeningContract(false);
    }
  };

  useEffect(() => {
    if (selectedRfq) {
      const rfqQuote = selectedRfq.supplierQuotation?.[0];
      const activeQuote = ownQuotation || rfqQuote;

      if (activeQuote) {
        setQuoteQuotationId(
          ownQuotation?.quotationId ||
          rfqQuote?.qutationId ||
          rfqQuote?.id ||
          null
        );
        setQuoteTotalPrice(activeQuote.totalPrice || 0);
        setQuoteDeliveryCharge(activeQuote.deliveryCharge || 0);
        setQuoteDeliveryType(activeQuote.deliveryType || "PERCENTAGE");
        setQuoteDiscount(activeQuote.discount || 0);
        setQuoteDiscountType(rfqQuote?.discountType || "PERCENTAGE");
        setQuoteTax(activeQuote.tax || 0);
        setQuoteTaxType(rfqQuote?.taxType || "PERCENTAGE");
      } else {
        setQuoteQuotationId(null);
        setQuoteTotalPrice(0);
        setQuoteDeliveryCharge(0);
        setQuoteDeliveryType("PERCENTAGE");
        setQuoteDiscount(0);
        setQuoteDiscountType("PERCENTAGE");
        setQuoteTax(0);
        setQuoteTaxType("PERCENTAGE");
      }

      const prices: { [key: string]: number } = {};
      selectedRfq.items?.forEach((item, idx) => {
        const ownItemQuote = ownQuotation?.supplierQuotationItems?.[idx];
        const key = item.id || item.buyerRFQItemId || `item-${idx}`;
        prices[key] = ownItemQuote?.quotedPrice ?? 0;
      });
      setQuoteItemPrices(prices);
      if (!selectedRfq.addLotOption) {
        const lineItems: { [supplierRFQItemId: string]: QuoteLineItem } = {};
        selectedRfq.items?.forEach((item) => {
          const itemKey = item.supplierRFQItemId;
          if (!itemKey) return;
          const matchedOwnItem = ownQuotation?.supplierQuotationItems?.find(
            (qi) => qi.supplierRFQItemId === itemKey
          );
          const matchedRfqItem = selectedRfq.supplierQuotationItems?.find(
            (qi) => qi.supplierRFQItemId === itemKey
          );
          const source = matchedOwnItem || matchedRfqItem;
          lineItems[itemKey] = {
            deliveryCharge: source?.deliveryCharge ?? 0,
            deliveryType: source?.deliveryType || "PERCENTAGE",
            discount: source?.discount ?? 0,
            discountType: source?.discountType || "PERCENTAGE",
            tax: source?.tax ?? 0,
            taxType: source?.taxType || "PERCENTAGE",
            quotedPrice: source?.quotedPrice ?? 0,
            subTotal: source?.subTotal ?? 0,
            quotedAmount: source?.quotedAmount ?? 0,
            isLineitemAvailable: source?.isLineitemAvailable ?? false,
          };
        });
        setQuoteLineItems(lineItems);
      } else {
        setQuoteLineItems({});
      }

      setSubmitQuoteSuccess(false);
      setSubmitQuoteError(null);
      const answers: typeof rfqAnswers = {};
      selectedRfq.questions?.forEach((q) => {
        answers[q.questionId] = {
          rfqQuestionId: q.questionId,
          answer: "",
          questionOptionId: null,
          questionOptionIds: [],
        };
      });
      setRfqAnswers(answers);
      setSubmitAnswersSuccess(false);
      setSubmitAnswersError(null);
    }
  }, [selectedRfq, ownQuotation]);

  const handleLineItemFieldChange = (
    supplierRFQItemId: string,
    field: keyof QuoteLineItem,
    value: string
  ) => {
    setQuoteLineItems((prev) => {
      const existing: QuoteLineItem = prev[supplierRFQItemId] || {
        deliveryCharge: 0,
        deliveryType: "PERCENTAGE",
        discount: 0,
        discountType: "PERCENTAGE",
        tax: 0,
        taxType: "PERCENTAGE",
        quotedPrice: 0,
        subTotal: 0,
        quotedAmount: 0,
        isLineitemAvailable: false,
      };
      const isNumericField = field === "deliveryCharge" || field === "discount" || field === "tax" || field === "quotedPrice";
      return {
        ...prev,
        [supplierRFQItemId]: {
          ...existing,
          [field]: isNumericField ? (Number(value) || 0) : value,
        },
      };
    });
  };

  const handleLineItemAvailabilityChange = (supplierRFQItemId: string, checked: boolean) => {
    setQuoteLineItems((prev) => {
      const existing: QuoteLineItem = prev[supplierRFQItemId] || {
        deliveryCharge: 0,
        deliveryType: "PERCENTAGE",
        discount: 0,
        discountType: "PERCENTAGE",
        tax: 0,
        taxType: "PERCENTAGE",
        quotedPrice: 0,
        subTotal: 0,
        quotedAmount: 0,
        isLineitemAvailable: false,
      };
      return {
        ...prev,
        [supplierRFQItemId]: {
          ...existing,
          isLineitemAvailable: checked,
        },
      };
    });
  };

  const handleOtherFieldChange = (field: string, value: any) => {
    if (field === "deliveryCharge") {
      setQuoteDeliveryCharge(Number(value) || 0);
    } else if (field === "tax") {
      setQuoteTax(Number(value) || 0);
    } else if (field === "discount") {
      setQuoteDiscount(Number(value) || 0);
    } else if (field === "deliveryType") {
      setQuoteDeliveryType(value);
    } else if (field === "discountType") {
      setQuoteDiscountType(value);
    } else if (field === "taxType") {
      setQuoteTaxType(value);
    } else if (field === "totalPrice") {
      setQuoteTotalPrice(Number(value) || 0);
    }
  };

  const {
    bulkValue,
    setBulkValue,
    bulkValueType,
    setBulkValueType,
    bulkFields,
    handleBulkFieldToggle,
    handleBulkApply,
  } = useBulkApply({
    items: selectedRfq?.items,
    onFieldChange: handleLineItemFieldChange,
  });

  const {
    excelFileInputRef,
    handleDownloadQuotationExcel,
    handleQuotationExcelFileChange,
  } = useQuotationExcelSync({
    items: selectedRfq?.items,
    lineItems: quoteLineItems,
    setLineItems: setQuoteLineItems,
    fileNameId: selectedRfqId,
    fullMatchSuccessMessage: "Spreadsheet values applied. Review the table below, then submit your quotation.",
  });

  const handleTextAnswerChange = (questionId: string, value: string) => {
    setRfqAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { rfqQuestionId: questionId, questionOptionId: null, questionOptionIds: [] }),
        rfqQuestionId: questionId,
        answer: value,
      },
    }));
  };

  const handleRadioAnswerChange = (questionId: string, optionId: string) => {
    setRfqAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { rfqQuestionId: questionId, answer: "" }),
        rfqQuestionId: questionId,
        questionOptionId: optionId,
        questionOptionIds: [optionId],
      },
    }));
  };

  const handleCheckboxAnswerChange = (questionId: string, optionId: string, checked: boolean) => {
    setRfqAnswers((prev) => {
      const current = prev[questionId]?.questionOptionIds || [];
      const updated = checked ? [...current, optionId] : current.filter((id) => id !== optionId);
      return {
        ...prev,
        [questionId]: {
          ...(prev[questionId] || { rfqQuestionId: questionId, answer: "", questionOptionId: null }),
          rfqQuestionId: questionId,
          questionOptionIds: updated,
        },
      };
    });
  };

  const handleFileAnswerChange = (questionId: string, file: File | null) => {
    if (!file) {
      setRfqAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || { rfqQuestionId: questionId, answer: "", questionOptionId: null, questionOptionIds: [] }),
          rfqQuestionId: questionId,
          answer: "",
          file: undefined,
          fileBase64: "",
          contentType: "",
        },
      }));
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(',')[1] || result;
      setRfqAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || { rfqQuestionId: questionId, answer: "", questionOptionId: null, questionOptionIds: [] }),
          rfqQuestionId: questionId,
          answer: file.name,
          file: file,
          fileBase64: base64Data,
          contentType: file.type,
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitRfqAnswers = async () => {
    if (!selectedRfq) return;
    const supplierRFQId = selectedRfq.items?.[0]?.supplierRFQId || null;

    const unanswered = (selectedRfq.questions || []).find((q) => {
      if (!q.isRequired) return false;
      const a = rfqAnswers[q.questionId];
      if (!a) return true;
      if (q.questionType === "Text") return !a.answer?.trim();
      if (q.questionType === "Radio") return !a.questionOptionId;
      if (q.questionType === "File" || q.questionType === "FILE") return !a.file;
      return (a.questionOptionIds?.length ?? 0) === 0;
    });
    if (unanswered) {
      setSubmitAnswersError(`Please answer the required question: "${unanswered.question}"`);
      return;
    }

    if (!supplierRFQId) {
      setSubmitAnswersError("This RFQ has no supplier record yet, so answers can't be saved. Please reload and try again.");
      return;
    }

    setSubmittingAnswers(true);
    setSubmitAnswersError(null);
    setSubmitAnswersSuccess(false);
    try {
      const entityTypes = await fetchMetadataReferenceList(['ENTITY_TYPE']);

      // ✅ ADD ERROR CHECK HERE
      if (isErrorResponse(entityTypes)) {
        setSubmitAnswersError(entityTypes.description || entityTypes.message || "Failed to fetch metadata.");
        setSubmittingAnswers(false);
        return;
      }

      const entityType = entityTypes.find((e) => e.key === 'SUPPLIER')?.key || 'SUPPLIER';

      const payload = {
        supplierRFQId: supplierRFQId as string,
        supplierId: supplierId as string,
        answers: Object.values(rfqAnswers).map((a) => {
          const question = selectedRfq.questions?.find(q => q.questionId === a.rfqQuestionId);

          let questionOptionId: string | null = a.questionOptionId || (a.questionOptionIds?.length ? a.questionOptionIds[0] : null);
          let questionOptionIds: string[] = a.questionOptionIds || [];
          if (question?.questionType === "Radio") {
            questionOptionIds = [];
          } else if (question?.questionType === "Checkbox") {
            questionOptionId = null;
          }

          const answerAttachment: RfqDocumentAssetDto | null =
            a.file && a.fileBase64
              ? {
                entityType: entityType,
                // Stored against this supplier's own RFQ, and never as a singleton: a singleton
                // upload deactivates (and deletes) every other active asset with the same entity
                // and type, so a shared id here wiped other suppliers' answer files.
                entityId: supplierRFQId as string,
                assetType: "RFQ_ANSWER_ATTACHMENT",
                fileBytes: a.fileBase64,
                fileName: a.file.name,
                contentType: a.contentType || a.file.type,
                isSingletonAsset: false,
              }
              : null;

          return {
            rfqQuestionId: a.rfqQuestionId,
            answer: a.answer || "",
            questionOptionId,
            questionOptionIds,
            attachment: answerAttachment
          };
        }),
      };

      await submitRfqAnswers(payload);
      setSubmitAnswersSuccess(true);
    } catch (err: any) {
      setSubmitAnswersError(err.message || "Failed to submit answers.");
    } finally {
      setSubmittingAnswers(false);
    }
  };

  const handleDocumentAction = async (doc: any, action: 'preview' | 'download') => {
    const assetId = doc.id || doc.assetId;
    if (!assetId) {
      alert("Document asset ID is missing.");
      return;
    }

    try {
      const data = await fetchBuyerAsset(assetId);
      if ('statusCode' in data && data.statusCode) {
        throw new Error(data.message || 'Failed to fetch document.');
      }

      const fileBytes = (data as any).fileBytes;
      const fileName = (data as any).fileName || doc.fileName || doc.assetName || "document";
      const rawType = ((data as any).contentType || (data as any).fileType || doc.fileType || "pdf").toLowerCase();

      let mimeType = "application/pdf";
      if (rawType.includes("pdf")) mimeType = "application/pdf";
      else if (rawType.includes("png")) mimeType = "image/png";
      else if (rawType.includes("jpg") || rawType.includes("jpeg")) mimeType = "image/jpeg";
      else if (rawType.includes("txt")) mimeType = "text/plain";
      else if (rawType.includes("doc")) mimeType = "application/msword";

      let url = (data as any).url || (data as any).fileUrl;
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
        window.open(url, '_blank');
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
    }
  };

  // ✅ UPDATED: Handle submit button click - shows confirmation modal
  const handleSubmitQuotationClick = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setOtpError(null);

    const { canSubmit: withinWindow } = getRfqSubmissionWindowStatus(selectedRfq);
    if (!withinWindow) {
      setSubmitQuoteError("This RFQ is outside its active submission window and can no longer accept quotations.");
      return;
    }

    const verificationToken = getCookie(VERIFICATION_TOKEN_COOKIE);

    if (verificationToken) {
      setShowConfirmSubmit(true);
      return;
    }

    sessionStorage.removeItem("vsx_otp_expiry");
    setOtpCode("");
    setOtpStage("send");
  };

  const handleConfirmSubmitQuotation = async () => {
    if (!selectedRfq) return;

    const { canSubmit: withinWindow } = getRfqSubmissionWindowStatus(selectedRfq);
    if (!withinWindow) {
      setShowConfirmSubmit(false);
      setSubmitQuoteError("This RFQ's submission window has closed. You can no longer submit a quotation.");
      return;
    }

    const verificationToken = getCookie(VERIFICATION_TOKEN_COOKIE);
    if (!verificationToken) {
      setShowConfirmSubmit(false);
      setOtpCode("");
      setOtpError(null);
      setOtpStage("send");
      return;
    }

    setShowConfirmSubmit(false);
    setSubmittingQuote(true);
    setSubmitQuoteError(null);
    setSubmitQuoteSuccess(false);

    try {
      const supplierRFQId = selectedRfq.items?.[0]?.supplierRFQId || null;

      const payload: SubmitQuotationPayload = {
        supplierQuotationId: quoteQuotationId,
        supplierRFQId: supplierRFQId,
        totalPrice: Number(quoteTotalPrice),
        deliveryCharge: Number(quoteDeliveryCharge),
        deliveryType: quoteDeliveryType,
        discount: Number(quoteDiscount),
        discountType: quoteDiscountType,
        tax: Number(quoteTax),
        taxType: quoteTaxType,
        temporaryVerificationToken: verificationToken,
        ...(selectedRfq.addLotOption ? {
          items: selectedRfq.items.map((item, idx) => {
            const key = item.id || item.buyerRFQItemId || `item-${idx}`;
            const itemQuote = selectedRfq.supplierQuotationItems?.[idx];
            // supplierQuotationItems can hold an empty draft-quotation stub whose IDs are
            // the all-zero placeholder GUID — that string is still "truthy" in JS, so it
            // must be filtered out explicitly rather than relying on `||` alone.
            const validId = (id?: string | null) =>
              id && id !==  "00000000-0000-0000-0000-000000000000" ? id : null;
            return {
              supplierRFQItemId: validId(item.supplierRFQItemId) || validId(itemQuote?.supplierRFQItemId) || validId(itemQuote?.id) || null,
              buyerRFQItemId: item.id || item.buyerRFQItemId || "",
              quotedPrice: Number(quoteItemPrices[key] ?? 0),
            };
          })
        } : {
          items: selectedRfq.items.map((item) => {
            const itemKey = item.supplierRFQItemId;
            const line = itemKey ? quoteLineItems[itemKey] : undefined;
            return {
              supplierRFQItemId: itemKey || null,
              buyerRFQItemId: item.id || item.buyerRFQItemId || "",
              quotedPrice: Number(line?.quotedPrice ?? 0),
              deliveryCharge: Number(line?.deliveryCharge ?? 0),
              deliveryType: line?.deliveryType || "PERCENTAGE",
              discount: Number(line?.discount ?? 0),
              discountType: line?.discountType || "PERCENTAGE",
              tax: Number(line?.tax ?? 0),
              taxType: line?.taxType || "PERCENTAGE",
              isLineitemAvailable: Boolean(line?.isLineitemAvailable),
            };
          })
        })
      };

      const result = await submitSupplierQuotation(payload);
      if (result && "statusCode" in result && (result as any).statusCode >= 400) {
        const statusCode = (result as any).statusCode;
        const message = (result as any).message || "";
        const isTokenExpired = statusCode === 400 && /expired/i.test(message);
        if (isTokenExpired) {
          deleteCookie(VERIFICATION_TOKEN_COOKIE);
          setOtpCode("");
          setOtpError("Your verification has expired, please verify again.");
          setOtpStage("send");
          return;
        }
        setSubmitQuoteError(message || "Failed to submit quotation.");
        return;
      }
      sessionStorage.removeItem("vsx_otp_expiry");
      setSubmitQuoteSuccess(true);

      const updatedDetails = await fetchRFQById(selectedRfqId!);

      if (!isErrorResponse(updatedDetails)) {
        setSelectedRfq(updatedDetails);
      } else {
        setSubmitQuoteError(updatedDetails.description || updatedDetails.message || "Failed to refresh RFQ details.");
      }

      if (selectedRfqId) {
        try {
          const updatedQuotation = await fetchSupplierQuotationBySupplierId(selectedRfqId);
          if (
            !isErrorResponse(updatedQuotation) &&
            updatedQuotation &&
            'suppliers' in updatedQuotation &&
            Array.isArray(updatedQuotation.suppliers)
          ) {
            const mine =
              updatedQuotation.suppliers.find((s) => s.supplierId === supplierId) ||
              updatedQuotation.suppliers[0] ||
              null;
            setOwnQuotation(mine);
          }
        } catch {
        }
      }

      onRfqsRefresh();
    } catch (err: any) {
      setSubmitQuoteError(err.message || "Failed to submit quotation.");
    } finally {
      setSubmittingQuote(false);
    }
  };

  const isLeadQuote = Boolean(
    (ownQuotation?.isLead === true || (ownQuotation as any)?.isLead === "true") &&
    ownQuotation?.status === "SUBMITTED"
  );

  const isRfqAwarded = Boolean(
    selectedRfq?.status === "AWARDED" ||
    ownQuotation?.isAwarded === true ||
    (ownQuotation as any)?.status === "AWARDED" ||
    ownQuotation?.supplierQuotationItems?.some((qi: any) => qi.isAwarded === true) ||
    selectedRfq?.items?.some((it: any) => it.isAwarded === true && (it.awardedSupplierId === supplierId || !it.awardedSupplierId))
  );

  // The supplier can review the contract only once the buyer has created it.
  const isContractCreated = selectedRfq?.status === "AWARDED" && !!selectedRfq?.isSupplierInvitedForContract;

  if (showContractView && selectedRfq) {
    const chatSupplierId = supplierId || ownQuotation?.supplierId || undefined;
    return (
      <ContractCreationView
        rfq={{ ...selectedRfq, rfqId: selectedRfqId || (selectedRfq as any)?.rfqId, id: selectedRfqId || (selectedRfq as any)?.id }}
        lineItems={selectedRfq.items || []}
        effectiveQuotations={ownQuotation ? [ownQuotation] : (selectedRfq.supplierQuotation || [])}
        role="supplier"
        supplierId={chatSupplierId}
        supplierName={ownQuotation?.supplierName || undefined}
        onUploadSupplierTerms={uploadSupplierTermsAndCondition}
        onUploadSupplierEsign={uploadSupplierEsign}
        onAcceptBuyerTerms={updateBuyerTermsConditionStatus}
        fetchContract={fetchSupplierContractById}
        refetchRfq={async (id) => {
          const latest = await fetchRFQById(id);
          if (!isErrorResponse(latest)) setSelectedRfq(latest);
        }}
        onBack={() => setShowContractView(false)}
        chatApi={selectedRfqId && chatSupplierId ? createSupplierChatApi(selectedRfqId, chatSupplierId) : undefined}
        chatHubParams={
          selectedRfqId && chatSupplierId
            ? { rfqId: selectedRfqId, supplierId: chatSupplierId, headers: { "X-API-Key": supplierApiKey } }
            : undefined
        }
        currentUserProfile={chatProfile}
        isLoadingCurrentUserProfile={isLoadingChatProfile}
      />
    );
  }

  const formatDateTime = (value?: string | null) =>
    value
      ? new Date(value).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
      : "—";

  const windowMessage = notYetOpen
    ? "This RFQ hasn't opened for bidding yet — check back after the start date."
    : frozen
      ? "The buyer has frozen this RFQ's bid. You can no longer submit a quotation."
      : "This RFQ's submission window has closed. You can no longer submit a quotation.";

  // Enter inside the dropdown's search box would otherwise submit the surrounding form.
  const renderTypeDropdown = (value: string, onChange: (next: string) => void, className: string) => (
    <div
      className={className}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      <Dropdown
        options={TYPE_OPTIONS}
        value={getTypeOption(value)}
        onChange={(next) => {
          if (next) onChange(next.value);
        }}
      />
    </div>
  );

  const renderDocumentGroup = (
    docs: NonNullable<RFQDetailResponse["technicalSpecificationDocuments"]>,
    title: string,
    typeLabel: string,
    tone: "primary" | "neutral",
  ) => (
    <div className="sqs-doc-group">
      <h3 className="sqs-doc-group-title">{title}</h3>
      <ul className="sila-file-list sqs-doc-list">
        {docs.map((doc) => (
          <li key={doc.id} className="sila-file">
            <span className={`sila-file-icon${tone === "neutral" ? " sqs-file-icon--neutral" : ""}`} aria-hidden="true">
              <IconFile />
            </span>
            <div className="sqs-doc-text">
              <div className="sila-file-name" title={doc.fileName}>{doc.fileName}</div>
              <div className="sila-file-meta">{typeLabel} · {doc.fileType.toUpperCase()}</div>
            </div>
            <div className="sqs-doc-actions">
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                title="Preview document"
                aria-label={`Preview ${doc.fileName}`}
                onClick={() => handleDocumentAction(doc, "preview")}
              >
                <IconEye />
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                title="Download document"
                aria-label={`Download ${doc.fileName}`}
                onClick={() => handleDocumentAction(doc, "download")}
              >
                <IconDownload />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <>
      <div className="sqs-page">
        <PageHeader
          className="sqs-header"
          title="RFQ Specification"
          description="Request supplier quotations and manage your procurement requirements."
          onBack={onClose}
          backLabel="Back"
          meta={isLeadQuote ? <StatusBadge status="Leading" tone="success" label="Leading" /> : undefined}
          actions={
            <div className="sqs-header-actions">
              {isRfqAwarded && (
                <Button
                  variant="primary"
                  type="button"
                  className="pud-btn sqs-btn-review-contract"
                  onClick={handleReviewContract}
                  disabled={openingContract || !isContractCreated}
                  title={isContractCreated ? "Review Contract & Terms" : "The buyer has not created the contract yet."}
                >
                  <IconContract /> {openingContract ? "Loading..." : "Review Contract"}
                </Button>
              )}
              {selectedRfq && supplierId && (
                <Button
                  variant="primary"
                  type="button"
                  className="pud-btn pud-btn-outline pud-btn-chat"
                  onClick={() => setIsChatOpen(true)}
                  title="Chat with the buyer"
                >
                  <IconMessageSquare /> Chat
                </Button>
              )}
            </div>
          }
        />

        {contractLoadError && (
          <div className="sila-alert sila-alert--danger sqs-alert" role="alert">
            <span className="sqs-alert-icon sqs-alert-icon--danger" aria-hidden="true"><IconAlertCircle /></span>
            <span>{contractLoadError}</span>
          </div>
        )}

        <form onSubmit={handleSubmitQuotationClick} className="sqs-form">
          <div className="sqs-body">
            {loadingRfqDetail && (
              <div className="sila-card">
                <Loader size={24} message="Fetching RFQ data from secure server..." />
              </div>
            )}

            {rfqDetailError && (
              <div className="sila-card">
                <EmptyState
                  variant="error"
                  title={rfqDetailError}
                  action={
                    <button type="button" className="sila-btn sila-btn--secondary" onClick={onRetry}>
                      Retry Loading
                    </button>
                  }
                />
              </div>
            )}

            {selectedRfq && !canSubmit && (
              <div className="sila-alert sila-alert--warning sqs-window-alert" role="status">
                <span className="sqs-alert-icon" aria-hidden="true"><IconAlertCircle /></span>
                <span>{windowMessage}</span>
              </div>
            )}

            {selectedRfq && (
              <>
                <section className="sila-card">
                  <div className="sila-card-header">
                    <h2 className="sila-card-title">RFQ Details</h2>
                  </div>
                  <div className="sila-card-body">
                    <dl className="sila-meta-grid sqs-details-grid">
                      <div className="sila-meta-item sqs-details-wide">
                        <dt className="sila-meta-label">RFQ title</dt>
                        <dd className="sila-meta-value">{selectedRfq.title || "—"}</dd>
                      </div>
                      <div className="sila-meta-item">
                        <dt className="sila-meta-label">Start date &amp; time (UTC)</dt>
                        <dd className="sila-meta-value sqs-tabular">{formatDateTime(selectedRfq.startDate)}</dd>
                      </div>
                      <div className="sila-meta-item">
                        <dt className="sila-meta-label">Close date &amp; time (UTC)</dt>
                        <dd className="sila-meta-value sqs-tabular">{formatDateTime(selectedRfq.endDate)}</dd>
                      </div>
                      <div className="sila-meta-item">
                        <dt className="sila-meta-label">Delivery location</dt>
                        <dd className="sila-meta-value">{selectedRfq.deliveryLocation || "—"}</dd>
                      </div>
                      <div className="sila-meta-item">
                        <dt className="sila-meta-label">Lot</dt>
                        <dd className="sila-meta-value">
                          {selectedRfq.addLotOption ? (
                            <StatusBadge status="Allowed" tone="success" label="Allowed" />
                          ) : (
                            <StatusBadge status="Not allowed" tone="neutral" label="Not Allowed" />
                          )}
                        </dd>
                      </div>
                      <div className="sila-meta-item">
                        <dt className="sila-meta-label">Sourcing items</dt>
                        <dd className="sila-meta-value sqs-tabular">{selectedRfq.items?.length || 0}</dd>
                      </div>
                      <div className="sila-meta-item sqs-details-full">
                        <dt className="sila-meta-label">Description</dt>
                        <dd className="sila-meta-value sqs-description">{selectedRfq.description || "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </section>

                {/* Sourcing Items Table */}
                {(() => {
                  const formatRank = (val: any): string => {
                    if (val == null || val === "") return "";
                    if (typeof val === "object") return String(val.rank ?? val.value ?? "");
                    return String(val);
                  };

                  const allQuotationItems: any[] = [];
                  const pushItems = (arr: any) => {
                    if (Array.isArray(arr)) allQuotationItems.push(...arr);
                  };

                  pushItems(ownQuotation?.supplierQuotationItems);
                  pushItems(selectedRfq?.supplierQuotationItems);

                  if (Array.isArray(selectedRfq?.supplierQuotation)) {
                    selectedRfq.supplierQuotation.forEach((sq: any) => pushItems(sq?.supplierQuotationItems));
                  } else if ((selectedRfq as any)?.supplierQuotation) {
                    pushItems((selectedRfq as any).supplierQuotation.supplierQuotationItems);
                  }

                  const rawSuppliers = (selectedRfq as any)?.suppliers;
                  if (Array.isArray(rawSuppliers)) {
                    rawSuppliers.forEach((s: any) => {
                      pushItems(s?.supplierQuotationItems);
                      if (Array.isArray(s?.supplierQuotation)) {
                        s.supplierQuotation.forEach((sq: any) => pushItems(sq?.supplierQuotationItems));
                      } else if (s?.supplierQuotation) {
                        pushItems(s.supplierQuotation.supplierQuotationItems);
                      }
                    });
                  } else if (rawSuppliers) {
                    pushItems(rawSuppliers.supplierQuotationItems);
                    pushItems(rawSuppliers.supplierQuotation?.supplierQuotationItems);
                  }

                  const showRankColumn = !selectedRfq.addLotOption;

                  const headerRank = formatRank(
                    ownQuotation?.rank ??
                    (selectedRfq?.supplierQuotation?.[0] as any)?.rank ??
                    (selectedRfq as any)?.suppliers?.[0]?.rank ??
                    (selectedRfq as any)?.suppliers?.rank
                  );

                  return (
                    <section className="sila-card quotation-summary-table">
                      <div className="sila-card-header">
                        <div>
                          <h2 className="sila-card-title">Quotation Summary</h2>
                          <p className="sila-card-subtitle quotation-summary-subtitle">
                            Review item pricing and enter applicable delivery charges, discounts, taxes, and quoted amounts.
                          </p>
                        </div>
                        {selectedRfq.addLotOption && headerRank !== "" && (
                          <StatusBadge status="Rank" tone="info" label={<>Rank: {headerRank}</>} />
                        )}
                      </div>

                      {!selectedRfq.addLotOption && (
                        <div className="sqs-excel-apply" role="group" aria-labelledby="sqs-excel-apply-title">
                          <div className="sqs-excel-apply-head">
                            <div className="sqs-excel-apply-title" id="sqs-excel-apply-title">Excel Apply</div>
                            <p className="sqs-excel-apply-subtitle">
                              Download this table as a spreadsheet, edit the values offline, then upload it to apply your changes.
                            </p>
                          </div>

                          <div className="sqs-excel-apply-controls">
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={handleDownloadQuotationExcel}
                              title="Download this table as an Excel-compatible spreadsheet"
                            >
                              <IconDownload /> Download Excel
                            </Button>
                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              onClick={() => excelFileInputRef.current?.click()}
                              title="Upload a filled-in spreadsheet to bulk-update these fields"
                            >
                              <IconFile /> Upload Excel
                            </Button>
                            <input
                              ref={excelFileInputRef}
                              type="file"
                              accept=".csv"
                              className="sqs-excel-file-input"
                              onChange={handleQuotationExcelFileChange}
                              tabIndex={-1}
                              aria-hidden="true"
                            />
                          </div>
                        </div>
                      )}

                      {!selectedRfq.addLotOption && (
                        <div className="sqs-bulk" role="group" aria-labelledby="sqs-bulk-title">
                          <div className="sqs-bulk-head">
                            <div className="sqs-bulk-title" id="sqs-bulk-title">Bulk Apply</div>
                            <p className="sqs-bulk-subtitle">
                              Enter a value, then toggle the columns you want it applied to.
                            </p>
                          </div>

                          <div className="sqs-bulk-controls">
                            <input
                              id="sqs-bulk-value-input"
                              className="sila-input sqs-bulk-input"
                              type="number"
                              value={bulkValue}
                              onChange={(e) => setBulkValue(e.target.value)}
                              placeholder="Enter value"
                              aria-label="Bulk value"
                            />

                            <div className="sqs-segmented" role="group" aria-label="Bulk value type">
                              <button
                                type="button"
                                className={bulkValueType === "PERCENTAGE" ? "active" : ""}
                                aria-pressed={bulkValueType === "PERCENTAGE"}
                                onClick={() => setBulkValueType("PERCENTAGE")}
                              >
                                Percentage
                              </button>
                              <button
                                type="button"
                                className={bulkValueType === "AMOUNT" ? "active" : ""}
                                aria-pressed={bulkValueType === "AMOUNT"}
                                onClick={() => setBulkValueType("AMOUNT")}
                              >
                                Amount
                              </button>
                            </div>

                            <div className="sqs-bulk-fields">
                              {([
                                ["deliveryCharge", "Delivery Charge"],
                                ["discount", "Discount"],
                                ["tax", "Tax"],
                                ["quotedPrice", "Quoted Price"],
                              ] as [keyof typeof bulkFields, string][]).map(([field, label]) => (
                                <label className="pud-bulk-toggle" key={field}>
                                  <span className="pud-switch">
                                    <input
                                      type="checkbox"
                                      checked={bulkFields[field]}
                                      onChange={(e) => handleBulkFieldToggle(field, e.target.checked)}
                                    />
                                    <span className="pud-slider" aria-hidden="true"></span>
                                  </span>
                                  <span>{label}</span>
                                </label>
                              ))}
                            </div>

                            <Button
                              variant="secondary"
                              size="sm"
                              type="button"
                              className="sqs-bulk-apply"
                              onClick={handleBulkApply}
                            >
                              Apply
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedRfq.addLotOption ? (
                        <>
                          <div className="sila-table-wrap">
                            <table className="sila-table sqs-items-table">
                              <thead>
                                <tr>
                                  <th scope="col">Material Info</th>
                                  <th scope="col">Code</th>
                                  <th scope="col" className="sila-num">Qty Required</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRfq.items?.map((item, idx) => (
                                  <tr key={idx}>
                                    <td className="sila-cell-strong">{item.description}</td>
                                    <td><span className="sila-ref">{item.materialCode || "N/A"}</span></td>
                                    <td className="sila-num">
                                      <span className="sila-cell-strong">{item.quantity}</span>{" "}
                                      <span className="sqs-uom">{item.uom}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="sqs-pricing">
                            <div className="sqs-pricing-head">
                              <h3 className="sqs-subsection-title">Pricing</h3>
                              {isLeadQuote && <StatusBadge status="Leading" tone="success" size="sm" label="Leading" />}
                            </div>

                            {submitQuoteSuccess && (
                              <div className="sila-alert sila-alert--success sqs-alert" role="status">
                                <span className="sqs-alert-icon sqs-alert-icon--success" aria-hidden="true"><IconCheckCircle /></span>
                                <span>Quotation submitted successfully!</span>
                              </div>
                            )}

                            {submitQuoteError && (
                              <div className="sila-alert sila-alert--danger sqs-alert" role="alert">
                                <span className="sqs-alert-icon sqs-alert-icon--danger" aria-hidden="true"><IconAlertCircle /></span>
                                <span>{submitQuoteError}</span>
                              </div>
                            )}

                            <div className="sila-form-grid sqs-pricing-grid">
                              <div className="sila-field">
                                <label className="sila-label" htmlFor="sqs-lot-delivery-charge">Delivery Charge</label>
                                <input
                                  id="sqs-lot-delivery-charge"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-num-input pud-rfq-form-input"
                                  value={quoteDeliveryCharge || ""}
                                  onChange={(e) => handleOtherFieldChange("deliveryCharge", e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="sila-field">
                                <span className="sila-label">Delivery Type</span>
                                {renderTypeDropdown(quoteDeliveryType, (v) => handleOtherFieldChange("deliveryType", v), "sqs-field-dropdown")}
                              </div>

                              <div className="sila-field">
                                <label className="sila-label" htmlFor="sqs-lot-discount">Discount</label>
                                <input
                                  id="sqs-lot-discount"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-num-input pud-rfq-form-input"
                                  value={quoteDiscount || ""}
                                  onChange={(e) => handleOtherFieldChange("discount", e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="sila-field">
                                <span className="sila-label">Discount Type</span>
                                {renderTypeDropdown(quoteDiscountType, (v) => handleOtherFieldChange("discountType", v), "sqs-field-dropdown")}
                              </div>

                              <div className="sila-field">
                                <label className="sila-label" htmlFor="sqs-lot-tax">Tax</label>
                                <input
                                  id="sqs-lot-tax"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-num-input pud-rfq-form-input"
                                  value={quoteTax || ""}
                                  onChange={(e) => handleOtherFieldChange("tax", e.target.value)}
                                  placeholder="0.00"
                                />
                              </div>

                              <div className="sila-field">
                                <span className="sila-label">Tax Type</span>
                                {renderTypeDropdown(quoteTaxType, (v) => handleOtherFieldChange("taxType", v), "sqs-field-dropdown")}
                              </div>
                            </div>

                            <div className="sqs-total">
                              <label className="sqs-total-label" htmlFor="sqs-lot-total">
                                Total Price Quote{currency ? ` (${currency})` : ""}<span className="sila-required" aria-hidden="true">*</span>
                              </label>
                              <input
                                id="sqs-lot-total"
                                type="number"
                                step="0.01"
                                className="sila-input sqs-num-input sqs-total-input pud-rfq-form-input"
                                value={quoteTotalPrice}
                                onChange={(e) => handleOtherFieldChange("totalPrice", e.target.value)}
                                placeholder="0.00"
                                required
                              />
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="sila-table-wrap">
                            <table className="sila-table sqs-items-table sqs-line-table">
                              <thead>
                                <tr>
                                  <th scope="col">Material Info</th>
                                  <th scope="col">Code</th>
                                  <th scope="col" className="sila-num">Qty</th>
                                  <th scope="col">Delivery Charge</th>
                                  <th scope="col">Delivery Type</th>
                                  <th scope="col">Discount</th>
                                  <th scope="col">Discount Type</th>
                                  <th scope="col">Tax</th>
                                  <th scope="col">Tax Type</th>
                                  <th scope="col">
                                    Quoted Price<span className="sila-required" aria-hidden="true">*</span>
                                  </th>
                                  <th scope="col" className="sqs-availability-cell">Available</th>

                                  {showRankColumn && (
                                    <th scope="col" className="sila-num">Rank</th>
                                  )}

                                  <th scope="col" className="sila-num">Sub Total{currency ? ` (${currency})` : ""}</th>
                                  <th scope="col" className="sila-num">Quoted Amount{currency ? ` (${currency})` : ""}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRfq.items?.map((item, idx) => {
                                  const itemKey = item.supplierRFQItemId || `item-${idx}`;
                                  const itemId = item.id || item.buyerRFQItemId;
                                  const line = quoteLineItems[itemKey] || {
                                    deliveryCharge: 0,
                                    deliveryType: "PERCENTAGE",
                                    discount: 0,
                                    discountType: "PERCENTAGE",
                                    tax: 0,
                                    taxType: "PERCENTAGE",
                                    quotedPrice: 0,
                                    subTotal: 0,
                                    quotedAmount: 0,
                                    isLineitemAvailable: false,
                                  };
                                  const matchedItem = allQuotationItems.find(
                                    (qi) =>
                                      (qi.supplierRFQItemId && (qi.supplierRFQItemId === itemKey || qi.supplierRFQItemId === itemId)) ||
                                      (qi.buyerRFQItemId && (qi.buyerRFQItemId === itemKey || qi.buyerRFQItemId === itemId)) ||
                                      (qi.id && (qi.id === itemKey || qi.id === itemId))
                                  ) || allQuotationItems[idx];
                                  const itemRank = formatRank(matchedItem?.rank) || "--";
                                  const quotationStatus = ownQuotation?.status
                                  const itemLabel = item.description || `item ${idx + 1}`;

                                  return (
                                    <tr key={itemKey}>
                                      <td className="sila-cell-strong sqs-material">{item.description}</td>
                                      <td><span className="sila-ref">{item.materialCode || "N/A"}</span></td>
                                      <td className="sila-num">
                                        <span className="sila-cell-strong">{item.quantity}</span>{" "}
                                        <span className="sqs-uom">{item.uom}</span>
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="sila-input sqs-cell-input sqs-num-input pud-rfq-item-input"
                                          value={line.deliveryCharge || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "deliveryCharge", e.target.value)}
                                          placeholder="0.00"
                                          aria-label={`Delivery charge for ${itemLabel}`}
                                        />
                                      </td>
                                      <td>
                                        {renderTypeDropdown(
                                          line.deliveryType,
                                          (next) => handleLineItemFieldChange(itemKey, "deliveryType", next),
                                          "sqs-cell-dropdown"
                                        )}
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="sila-input sqs-cell-input sqs-num-input pud-rfq-item-input"
                                          value={line.discount || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "discount", e.target.value)}
                                          placeholder="0.00"
                                          aria-label={`Discount for ${itemLabel}`}
                                        />
                                      </td>
                                      <td>
                                        {renderTypeDropdown(
                                          line.discountType,
                                          (next) => handleLineItemFieldChange(itemKey, "discountType", next),
                                          "sqs-cell-dropdown"
                                        )}
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="sila-input sqs-cell-input sqs-num-input pud-rfq-item-input"
                                          value={line.tax || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "tax", e.target.value)}
                                          placeholder="0.00"
                                          aria-label={`Tax for ${itemLabel}`}
                                        />
                                      </td>
                                      <td>
                                        {renderTypeDropdown(
                                          line.taxType,
                                          (next) => handleLineItemFieldChange(itemKey, "taxType", next),
                                          "sqs-cell-dropdown"
                                        )}
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          className="sila-input sqs-cell-input sqs-num-input sqs-price-input pud-rfq-item-input"
                                          value={line.quotedPrice || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "quotedPrice", e.target.value)}
                                          placeholder="0.00"
                                          aria-label={`Quoted price for ${itemLabel}`}
                                          required
                                        />
                                      </td>
                                      <td className="sqs-availability-cell">
                                        <input
                                          type="checkbox"
                                          className="sqs-availability-checkbox"
                                          checked={!line.isLineitemAvailable}
                                          onChange={(e) => handleLineItemAvailabilityChange(itemKey, !e.target.checked)}
                                          aria-label={`Mark ${itemLabel} as available`}
                                        />
                                      </td>
                                      {showRankColumn && (
                                        <td className="sila-num sila-cell-strong">
                                          {quotationStatus === 'SUBMITTED' ? itemRank : "-"}
                                        </td>
                                      )}
                                      <td className="sila-num">
                                        {fmtCurrency(line.subTotal)}
                                      </td>
                                      <td className="sila-num sila-cell-strong">
                                        {fmtCurrency(line.quotedAmount)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          <div className="sqs-total sqs-total--readonly">
                            <span className="sqs-total-label">Total Price Quote</span>
                            <span className="sqs-total-value">
                              {fmtCurrency(Number(quoteTotalPrice))}
                            </span>
                          </div>
                        </>
                      )}
                    </section>
                  );
                })()}

                {((selectedRfq.technicalSpecificationDocuments?.length ?? 0) > 0 ||
                  (selectedRfq.termsConditionDocuments?.length ?? 0) > 0) && (
                    <section className="sila-card">
                      <div className="sila-card-header">
                        <div>
                          <h2 className="sila-card-title">Reference Documents</h2>
                          <p className="sila-card-subtitle">
                            Technical specifications, requirements, and Terms &amp; Conditions
                            documents attached to this RFQ.
                          </p>
                        </div>
                      </div>
                      <div className="sila-card-body sqs-docs-body">
                        {selectedRfq.technicalSpecificationDocuments?.length > 0 &&
                          renderDocumentGroup(selectedRfq.technicalSpecificationDocuments, "Technical Requirements", "Tech Spec", "primary")}

                        {selectedRfq.termsConditionDocuments?.length > 0 &&
                          renderDocumentGroup(selectedRfq.termsConditionDocuments, "Terms & Conditions", "Terms & Conditions", "neutral")}
                      </div>
                    </section>
                  )}

                {(selectedRfq.questions?.length ?? 0) > 0 && (
                  <section className="sila-card">
                    <div className="sila-card-header">
                      <h2 className="sila-card-title sqs-title-with-icon">
                        <IconMessageSquare /> Additional Questions from Buyer
                      </h2>
                    </div>

                    <div className="sila-card-body sqs-questions">
                      {submitAnswersSuccess && (
                        <div className="sila-alert sila-alert--success sqs-alert" role="status">
                          <span className="sqs-alert-icon sqs-alert-icon--success" aria-hidden="true"><IconCheckCircle /></span>
                          <span>All answers successfully saved!</span>
                        </div>
                      )}
                      {submitAnswersError && (
                        <div className="sila-alert sila-alert--danger sqs-alert" role="alert">
                          <span className="sqs-alert-icon sqs-alert-icon--danger" aria-hidden="true"><IconAlertCircle /></span>
                          <span>{submitAnswersError}</span>
                        </div>
                      )}
                      {[...selectedRfq.questions]
                        .sort((a, b) => a.displayOrder - b.displayOrder)
                        .map((q, index) => {
                          const current = rfqAnswers[q.questionId];
                          const inputId = `sqs-question-${q.questionId}`;
                          const isChoice = q.questionType !== 'Text' && q.questionType !== 'FILE';
                          const questionLabel = (
                            <>
                              <span className="sqs-question-index">Q{index + 1}.</span> {q.question}
                              {q.isRequired && <span className="sila-required" aria-hidden="true">*</span>}
                            </>
                          );
                          return (
                            <div key={q.questionId} className="sqs-question">
                              {isChoice ? (
                                <div className="sqs-question-label" id={`${inputId}-label`}>{questionLabel}</div>
                              ) : (
                                <label className="sqs-question-label" htmlFor={inputId}>{questionLabel}</label>
                              )}

                              {q.questionType === 'Text' && (
                                <input
                                  id={inputId}
                                  type="text"
                                  className="sila-input pud-rfq-item-input"
                                  value={current?.answer || ''}
                                  onChange={(e) => handleTextAnswerChange(q.questionId, e.target.value)}
                                  placeholder="Type your answer..."
                                  required={q.isRequired}
                                />
                              )}

                              {q.questionType === 'Radio' && (
                                <div className="sqs-options" role="radiogroup" aria-labelledby={`${inputId}-label`}>
                                  {[...(q.options || [])]
                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                    .map((opt) => (
                                      <label key={opt.optionId} className="sqs-option">
                                        <input
                                          type="radio"
                                          name={`rfq-question-${q.questionId}`}
                                          checked={current?.questionOptionId === opt.optionId}
                                          onChange={() => handleRadioAnswerChange(q.questionId, opt.optionId)}
                                          required={q.isRequired}
                                        />
                                        {opt.optionText}
                                      </label>
                                    ))}
                                </div>
                              )}

                              {q.questionType === 'FILE' && (
                                <input
                                  id={inputId}
                                  type="file"
                                  className="sila-input sqs-file-input pud-rfq-item-input"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    handleFileAnswerChange(q.questionId, file);
                                  }}
                                  required={q.isRequired}
                                />
                              )}

                              {q.questionType !== 'Text' && q.questionType !== 'Radio' && q.questionType !== 'File' && (q.options?.length ?? 0) > 0 && (
                                <div className="sqs-options" role="group" aria-labelledby={`${inputId}-label`}>
                                  {[...(q.options || [])]
                                    .sort((a, b) => a.displayOrder - b.displayOrder)
                                    .map((opt) => (
                                      <label key={opt.optionId} className="sqs-option">
                                        <input
                                          type="checkbox"
                                          checked={current?.questionOptionIds?.includes(opt.optionId) || false}
                                          onChange={(e) => handleCheckboxAnswerChange(q.questionId, opt.optionId, e.target.checked)}
                                        />
                                        {opt.optionText}
                                      </label>
                                    ))}
                                </div>
                              )}
                              <div className="sqs-question-actions">
                                <button
                                  type="button"
                                  className="sila-btn sila-btn--secondary sila-btn--sm"
                                  onClick={handleSubmitRfqAnswers}
                                  disabled={submittingAnswers}
                                >
                                  {submittingAnswers ? 'Saving...' : 'Save Answer'}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </section>
                )}
              </>
            )}
          </div>

          {/* Sticky action bar */}
          {selectedRfq?.status !== "AWARDED" && (
            <div className="sqs-footer pud-rfq-page-footer">
              <div className="sqs-footer-status">
                {selectedRfq && !canSubmit && (
                  <StatusBadge
                    status={frozen ? "Frozen" : notYetOpen ? "Pending" : "Closed"}
                    label={notYetOpen ? "Not yet open" : frozen ? "Bid frozen" : "Submission closed"}
                    dot
                  />
                )}
              </div>
              <div className="sqs-footer-actions">
                <button
                  type="button"
                  className="sila-btn sila-btn--secondary"
                  onClick={onClose}
                >
                  Close
                </button>
                {selectedRfq && (
                  <button
                    type="submit"
                    className="sila-btn sila-btn--primary"
                    disabled={submittingQuote || !canSubmit}
                    aria-busy={submittingQuote || undefined}
                    title={
                      notYetOpen
                        ? "This RFQ hasn't opened for bidding yet."
                        : frozen
                          ? "The buyer has frozen this RFQ's bid."
                          : closed
                            ? "This RFQ's submission window has closed."
                            : undefined
                    }
                  >
                    {submittingQuote && <span className="sila-spinner" aria-hidden="true" />}
                    {submittingQuote
                      ? "Submitting..."
                      : notYetOpen
                        ? "Not Yet Open"
                        : frozen
                          ? "Bid Frozen"
                          : closed
                            ? "Submission Closed"
                            : "Submit Quotation"}
                  </button>
                )}
              </div>
            </div>
          )}
        </form>
      </div>

      {otpStage === "send" && (
        <div className="sila-overlay sqs-overlay" onClick={() => setOtpStage("none")}>
          <div
            className="sila-modal sqs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sqs-otp-send-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <h2 className="sila-modal-title sqs-title-with-icon" id="sqs-otp-send-title">
                <IconMail /> Verify It's You
              </h2>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                onClick={() => setOtpStage("none")}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <div className="sila-modal-body">
              <h3 className="sqs-modal-heading">Confirm Your Quotation</h3>
              <p className="sila-modal-text">
                For security, we'll send a one-time code to your registered email before this quotation goes to the buyer.
              </p>
              {otpError && (
                <p className="sila-error-text sqs-modal-error" role="alert">{otpError}</p>
              )}
            </div>

            <div className="sila-modal-footer">
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setOtpStage("none")}>
                Cancel
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--primary"
                onClick={handleSendOtp}
                disabled={sendingOtp}
              >
                {sendingOtp && <span className="sila-spinner" aria-hidden="true" />}
                {sendingOtp ? "Sending..." : "Send OTP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {otpStage === "verify" && (
        <div className="sila-overlay sqs-overlay" onClick={() => setOtpStage("none")}>
          <div
            className="sila-modal sqs-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="sqs-otp-verify-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <h2 className="sila-modal-title sqs-title-with-icon" id="sqs-otp-verify-title">
                <IconMail /> Enter Verification Code
              </h2>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                onClick={() => setOtpStage("none")}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <div className="sila-modal-body">
              <p className="sila-modal-text sqs-otp-intro">
                We've sent a 6-digit code to your email. It expires in{" "}
                <strong className={`sqs-otp-timer${otpRemaining <= 30 ? " sqs-otp-timer--urgent" : ""}`}>
                  {formatOtpTimer(otpRemaining)}
                </strong>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="sila-input sqs-otp-input pud-rfq-item-input"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter OTP"
                aria-label="One-time code"
                aria-invalid={otpRemaining <= 0 || Boolean(otpError) || undefined}
              />
              {otpRemaining <= 0 ? (
                <p className="sila-error-text sqs-modal-error" role="alert">
                  Code expired. Please resend the OTP.
                </p>
              ) : otpError ? (
                <p className="sila-error-text sqs-modal-error" role="alert">{otpError}</p>
              ) : null}
              <div className="sqs-otp-resend">
                <button
                  type="button"
                  className="sila-btn sila-btn--ghost sila-btn--sm"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || otpRemaining > 0}
                >
                  Resend OTP
                </button>
              </div>
            </div>

            <div className="sila-modal-footer">
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setOtpStage("none")}>
                Cancel
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--primary"
                onClick={handleVerifyOtp}
                disabled={verifyingOtp || otpRemaining <= 0}
              >
                {verifyingOtp && <span className="sila-spinner" aria-hidden="true" />}
                {verifyingOtp ? "Verifying..." : "Verify OTP"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConfirmSubmit && (
        <div className="sila-overlay sqs-overlay" onClick={() => setShowConfirmSubmit(false)}>
          <div
            className="sila-modal sqs-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sqs-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <div className="sqs-modal-heading-group">
                <StatusBadge
                  status="Pending"
                  tone="warning"
                  size="sm"
                  label={<><IconAlertCircle /> Confirmation Required</>}
                />
                <h2 className="sila-modal-title" id="sqs-confirm-title">Submit Quotation?</h2>
              </div>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                onClick={() => setShowConfirmSubmit(false)}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <div className="sila-modal-body">
              <p className="sila-modal-text">
                Are you sure you want to submit this quotation? Once submitted, it will be sent to the buyer and cannot be easily modified.
              </p>
            </div>

            <div className="sila-modal-footer">
              <button
                type="button"
                className="sila-btn sila-btn--secondary"
                onClick={() => setShowConfirmSubmit(false)}
              >
                No, Cancel
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--primary"
                onClick={handleConfirmSubmitQuotation}
                disabled={submittingQuote}
              >
                {submittingQuote ? "Submitting..." : "Yes, Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isChatOpen && selectedRfqId && supplierId && (
        <ChatPanel
          role="supplier"
          onClose={() => setIsChatOpen(false)}
          rfqId={selectedRfqId}
          rfqTitle={selectedRfq?.title}
          counterparties={[{ id: supplierId, name: selectedRfq?.buyerName || "Buyer", isExternal: false }]}
          currentUserProfile={chatProfile}
          isLoadingCurrentUserProfile={isLoadingChatProfile}
          api={createSupplierChatApi(selectedRfqId, supplierId)}
          hubParams={{ rfqId: selectedRfqId, supplierId, headers: { "X-API-Key": supplierApiKey } }}
        />
      )}
    </>
  );
};

export default SupplierRfqQuotationSummary;
