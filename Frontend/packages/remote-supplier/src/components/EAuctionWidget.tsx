import React, { useState, useEffect } from 'react';
import './EAuctionWidget.css';
import { FaBolt, FaDownload, FaEnvelope, FaFileUpload, FaKey, FaTimes } from 'react-icons/fa';
import {
  fetchRFQById,
  fetchSupplierQuotationBySupplierId,
  submitSupplierQuotation,
  type RFQDetailResponse,
  type SupplierQuotationByIdItem,
  type SubmitQuotationPayload,
} from '../api/supplierApi';
import { useOtpVerification, getCookie, deleteCookie, VERIFICATION_TOKEN_COOKIE, VERIFICATION_TOKEN_STORAGE_KEY, OTP_EXPIRY_STORAGE_KEY } from '../hooks/useOtpVerification';
import { useQuotationExcelSync, type QuoteLineItem } from '../hooks/useQuotationExcelSync';
import { useBulkApply } from '../hooks/useBulkApply';
import { formatUtcToLocal } from '@vosox/shared-ui';
import { useLiveBids, formatEndDateStr, type LiveAuctionItem } from '../hooks/useLiveBids';
import LiveBidList from './EAuction/LiveBidList';
import AuctionTriggerBar from './EAuction/AuctionTriggerBar';

/* ---------------------------------- Interfaces ---------------------------------- */

interface EAuctionWidgetProps {
  supplierId: string | null;
}

const formatRank = (val: any): string => {
  if (val == null || val === "") return "";
  if (typeof val === "object") return String(val.rank ?? val.value ?? "");
  return String(val);
};

const IconBoltFilled = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

/* ---------------------------------- Component ---------------------------------- */

export const EAuctionWidget: React.FC<EAuctionWidgetProps> = ({ supplierId }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
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
  } = useLiveBids(supplierId, isModalOpen);

  // Small screens only (CSS-driven): show either the RFQ list or the selected RFQ's workspace
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const handleSelectLot = (lot: LiveAuctionItem) => {
    setSelectedLot(lot);
    setMobileView("detail");
  };

  const handleCloseEauctionModal = () => {
    setIsModalOpen(false);
    setCurrentPage(1);
    setSelectedLot(null);
    setMobileView("list");
  };

  // API State for selected RFQ details & existing quotation
  const [selectedRfqDetails, setSelectedRfqDetails] = useState<RFQDetailResponse | null>(null);
  const [ownQuotation, setOwnQuotation] = useState<SupplierQuotationByIdItem | null>(null);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  // The RFQ's own currency (e.g. "INR", "USD") — RFQDetailResponse doesn't
  // declare this field, but the supplier's own quotation does, so fall back
  // to that. Left blank (not defaulted to "INR") when neither returns one,
  // since guessing a currency could mislead the supplier.
  const currency = (selectedRfqDetails as any)?.currency || ownQuotation?.currency || "";
  const fmtCurrency = (val: number) => `${(val || 0).toFixed(2)}${currency ? ` ${currency}` : ""}`;

  // Supplier's rank on the current lot (single-lot / addLotOption bidding only)
  const headerRank = React.useMemo(() => formatRank(
    ownQuotation?.rank ??
    (selectedRfqDetails?.supplierQuotation?.[0] as any)?.rank ??
    (selectedRfqDetails as any)?.suppliers?.[0]?.rank ??
    (selectedRfqDetails as any)?.suppliers?.rank
  ), [ownQuotation, selectedRfqDetails]);

  // Per-item ranks (line-item / non-lot bidding only)
  const allQuotationItems = React.useMemo(() => {
    const items: any[] = [];
    const pushItems = (arr: any) => {
      if (Array.isArray(arr)) items.push(...arr);
    };
    pushItems(ownQuotation?.supplierQuotationItems);
    pushItems(selectedRfqDetails?.supplierQuotationItems);
    if (Array.isArray(selectedRfqDetails?.supplierQuotation)) {
      selectedRfqDetails.supplierQuotation.forEach((sq: any) => pushItems(sq?.supplierQuotationItems));
    }
    return items;
  }, [ownQuotation, selectedRfqDetails]);

  // Form State for SUBMIT COMPETITIVE BID
  const [deliveryCharge, setDeliveryCharge] = useState<string>("0.00");
  const [deliveryType, setDeliveryType] = useState<string>("PERCENTAGE");
  const [discount, setDiscount] = useState<string>("0.00");
  const [discountType, setDiscountType] = useState<string>("PERCENTAGE");
  const [tax, setTax] = useState<string>("0.00");
  const [taxType, setTaxType] = useState<string>("PERCENTAGE");
  const [totalPriceQuote, setTotalPriceQuote] = useState<string>("0");
  const [itemPrices, setItemPrices] = useState<{ [key: string]: string }>({});
  const [quoteLineItems, setQuoteLineItems] = useState<{ [supplierRFQItemId: string]: QuoteLineItem }>({});

  const [submittingBid, setSubmittingBid] = useState<boolean>(false);
  const [submitBidError, setSubmitBidError] = useState<string | null>(null);
  const [bidSubmittedMessage, setBidSubmittedMessage] = useState<string | null>(null);

  const loadRfqDetailsAndQuotation = async (rfqId: string) => {
    setLoadingDetails(true);
    let isAddLotOption = false;
    try {
      const [detailsRes, quoteRes] = await Promise.all([
        fetchRFQById(rfqId),
        fetchSupplierQuotationBySupplierId(rfqId),
      ]);

      if (detailsRes && !('statusCode' in detailsRes) && 'title' in detailsRes) {
        const det = detailsRes as RFQDetailResponse;
        setSelectedRfqDetails(det);
        isAddLotOption = Boolean(det.addLotOption);

        // Enrich auction list row with detailed RFQ info (delivery location, endDate, orgName)
        setAuctions((prev) =>
          prev.map((auc) => {
            if (auc.id === rfqId) {
              const loc = det.deliveryLocation || auc.deliveryLocation;
              const end = det.endDate || auc.endDate;
              const org = (det as any).organizationName || auc.organizationName;
              return {
                ...auc,
                deliveryLocation: loc,
                organizationName: org,
                endDate: end,
                formattedEndDate: end ? formatEndDateStr(end) : auc.formattedEndDate,
              };
            }
            return auc;
          })
        );

        // Pre-fill item prices if available
        const prices: { [key: string]: string } = {};
        if (det.items) {
          det.items.forEach((item, idx) => {
            const key = item.id || item.buyerRFQItemId || `item-${idx}`;
            const itemQuote = det.supplierQuotationItems?.[idx];
            prices[key] = itemQuote?.quotedPrice ? String(itemQuote.quotedPrice) : "0";
          });
        }
        setItemPrices(prices);

        // Pre-fill per-item line details for line-item (non-lot) bidding
        if (!det.addLotOption) {
          const lineItems: { [supplierRFQItemId: string]: QuoteLineItem } = {};
          det.items?.forEach((item) => {
            const itemKey = item.supplierRFQItemId;
            if (!itemKey) return;
            const source = det.supplierQuotationItems?.find(
              (qi) => qi.supplierRFQItemId === itemKey
            );
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

        if (det.supplierQuotation && det.supplierQuotation.length > 0) {
          const sq = det.supplierQuotation[0];
          if (sq.totalPrice) setTotalPriceQuote(String(sq.totalPrice));
          if (sq.deliveryCharge !== null && sq.deliveryCharge !== undefined) setDeliveryCharge(String(sq.deliveryCharge));
          if (sq.deliveryType) setDeliveryType(sq.deliveryType);
          if (sq.discount !== null && sq.discount !== undefined) setDiscount(String(sq.discount));
          if (sq.discountType) setDiscountType(sq.discountType);
          if (sq.tax !== null && sq.tax !== undefined) setTax(String(sq.tax));
          if (sq.taxType) setTaxType(sq.taxType);
        }
      } else {
        setSelectedRfqDetails(null);
      }

      if (quoteRes && !('statusCode' in quoteRes) && 'suppliers' in quoteRes && Array.isArray(quoteRes.suppliers)) {
        const mine = quoteRes.suppliers.find((s) => s.supplierId === supplierId) || quoteRes.suppliers[0] || null;
        if (mine) {
          setOwnQuotation(mine);
          if (mine.totalPrice) setTotalPriceQuote(String(mine.totalPrice));
          if (mine.deliveryCharge !== null && mine.deliveryCharge !== undefined) setDeliveryCharge(String(mine.deliveryCharge));
          if (mine.deliveryType) setDeliveryType(mine.deliveryType);
          if (mine.discount !== null && mine.discount !== undefined) setDiscount(String(mine.discount));
          if (mine.tax !== null && mine.tax !== undefined) setTax(String(mine.tax));
          if (mine.supplierQuotationItems && mine.supplierQuotationItems.length > 0) {
            const prices: { [key: string]: string } = {};
            mine.supplierQuotationItems.forEach((qi, idx) => {
              const key = qi.supplierRFQItemId || qi.buyerRFQItemId || `item-${idx}`;
              prices[key] = String(qi.quotedPrice || 0);
            });
            setItemPrices((prev) => ({ ...prev, ...prices }));

            if (!isAddLotOption) {
              setQuoteLineItems((prev) => {
                const next = { ...prev };
                mine.supplierQuotationItems?.forEach((qi) => {
                  if (!qi.supplierRFQItemId) return;
                  next[qi.supplierRFQItemId] = {
                    deliveryCharge: qi.deliveryCharge ?? 0,
                    deliveryType: qi.deliveryType || "PERCENTAGE",
                    discount: qi.discount ?? 0,
                    discountType: qi.discountType || "PERCENTAGE",
                    tax: qi.tax ?? 0,
                    taxType: qi.taxType || "PERCENTAGE",
                    quotedPrice: qi.quotedPrice ?? 0,
                    subTotal: qi.subTotal ?? 0,
                    quotedAmount: qi.quotedAmount ?? 0,
                    isLineitemAvailable: qi.isLineitemAvailable ?? false,
                  };
                });
                return next;
              });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading RFQ details for bidding:", err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // Load RFQ details and supplier quotation when selectedLot changes
  useEffect(() => {
    if (!selectedLot?.id) {
      setSelectedRfqDetails(null);
      setOwnQuotation(null);
      return;
    }
    loadRfqDetailsAndQuotation(selectedLot.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLot?.id]);

  const {
    otpStage,
    setOtpStage,
    otpCode,
    setOtpCode,
    otpError,
    setOtpError,
    sendingOtp,
    verifyingOtp,
    setOtpExpiresAt,
    otpRemaining,
    setOtpRemaining,
    handleSendOtp,
    handleVerifyOtp,
  } = useOtpVerification({ onVerified: (token) => executeSubmitLiveBid(token) });

  const formatOtpTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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

  // Bulk Apply — line-item (non-lot) bidding only
  const {
    bulkValue,
    setBulkValue,
    bulkValueType,
    setBulkValueType,
    bulkFields,
    handleBulkFieldToggle,
    handleBulkApply,
  } = useBulkApply({
    items: selectedRfqDetails?.items,
    onFieldChange: handleLineItemFieldChange,
  });

  // Excel Apply — line-item (non-lot) bidding only
  const {
    excelFileInputRef,
    handleDownloadQuotationExcel,
    handleQuotationExcelFileChange,
  } = useQuotationExcelSync({
    items: selectedRfqDetails?.items,
    lineItems: quoteLineItems,
    setLineItems: setQuoteLineItems,
    fileNameId: selectedLot?.id,
    fullMatchSuccessMessage: "Spreadsheet values applied. Review the table below, then submit your bid.",
  });

  const executeSubmitLiveBid = async (verificationToken: string) => {
    if (!selectedLot) return;
    setSubmittingBid(true);
    setSubmitBidError(null);
    setBidSubmittedMessage(null);

    try {
      const supplierRFQId =
        selectedRfqDetails?.items?.[0]?.supplierRFQId ||
        selectedLot?.supplierRFQId ||
        ownQuotation?.supplierRFQId ||
        (selectedRfqDetails as any)?.supplierRFQId ||
        null;

      const quotationId =
        ownQuotation?.quotationId ||
        selectedRfqDetails?.supplierQuotation?.[0]?.qutationId ||
        (selectedRfqDetails?.supplierQuotation?.[0] as any)?.quotationId ||
        null;

      const payload: SubmitQuotationPayload = {
        supplierQuotationId: quotationId,
        supplierRFQId: supplierRFQId,
        totalPrice: Number(totalPriceQuote) || 0,
        deliveryCharge: Number(deliveryCharge) || 0,
        deliveryType: deliveryType || "PERCENTAGE",
        discount: Number(discount) || 0,
        discountType: discountType || "PERCENTAGE",
        tax: Number(tax) || 0,
        taxType: taxType || "PERCENTAGE",
        temporaryVerificationToken: verificationToken,
        items: !selectedRfqDetails?.items || selectedRfqDetails.items.length === 0
          ? []
          : selectedRfqDetails.addLotOption
            ? selectedRfqDetails.items.map((item, idx) => {
              const key = item.id || item.buyerRFQItemId || `item-${idx}`;
              const itemQuote = selectedRfqDetails.supplierQuotationItems?.[idx];
              return {
                supplierRFQItemId: item.supplierRFQItemId || itemQuote?.supplierRFQItemId || item.id || null,
                buyerRFQItemId: item.buyerRFQItemId || item.id || "",
                quotedPrice: Number(itemPrices[key] ?? 0),
              };
            })
            : selectedRfqDetails.items.map((item) => {
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
              } as any;
            })
      };

      const res = await submitSupplierQuotation(payload);
      if (res && typeof res === 'object' && 'statusCode' in res && res.statusCode >= 400) {
        throw new Error(res.message || "Failed to submit live bid.");
      }

      const formattedBid = fmtCurrency(Number(totalPriceQuote));
      setBidSubmittedMessage(`Live Bid of ${formattedBid} successfully submitted for ${selectedLot.name}! Your bid has been recorded.`);
      await Promise.all([
        loadRfqDetailsAndQuotation(selectedLot.id),
        fetchLiveBidsData(),
      ]);
      setTimeout(() => setBidSubmittedMessage(null), 6000);
    } catch (err: any) {
      setSubmitBidError(err.message || "Failed to submit live bid.");
    } finally {
      setSubmittingBid(false);
    }
  };

  const handleSubmitLiveBid = async () => {
    if (!selectedLot) return;
    setSubmitBidError(null);

    const verificationToken = getCookie(VERIFICATION_TOKEN_COOKIE) || sessionStorage.getItem(VERIFICATION_TOKEN_STORAGE_KEY);
    if (verificationToken) {
      await executeSubmitLiveBid(verificationToken);
      return;
    }

    const storedExpiry = Number(sessionStorage.getItem(OTP_EXPIRY_STORAGE_KEY) || 0);
    if (storedExpiry && Date.now() < storedExpiry) {
      setOtpCode("");
      setOtpExpiresAt(storedExpiry);
      setOtpRemaining(Math.max(0, Math.round((storedExpiry - Date.now()) / 1000)));
      setOtpStage("verify");
      return;
    }

    sessionStorage.removeItem(OTP_EXPIRY_STORAGE_KEY);
    deleteCookie(VERIFICATION_TOKEN_COOKIE);
    sessionStorage.removeItem(VERIFICATION_TOKEN_STORAGE_KEY);
    setOtpCode("");
    setOtpError(null);
    setOtpStage("send");
  };

  return (
    <>
      {/* Bottom Right Floating Trigger Widget for Supplier Side */}
      <AuctionTriggerBar
        selectedLot={selectedLot}
        totalAuctions={totalAuctions}
        isHovered={isHovered}
        isModalOpen={isModalOpen}
        onHoverChange={setIsHovered}
        onOpen={() => setIsModalOpen(true)}
      />

      {/* Full Live Portal Modal View */}
      {isModalOpen && (
        <div className="eauction-modal-overlay" onClick={handleCloseEauctionModal}>
          <div
            className="eauction-portal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eauction-portal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Header Bar */}
            <div className="eauction-portal-header">
              <div className="eauction-brand">
                <div className="eauction-logo-icon">
                  <IconBoltFilled />
                </div>
                <div className="eauction-brand-text">
                  <h2 className="eauction-portal-title" id="eauction-portal-title">Live e-Auction Bidding Console</h2>
                  <span className="eauction-portal-subtitle">SILA Procurement · Real-time reverse auction</span>
                </div>
              </div>

              <button
                type="button"
                className="eauction-portal-close"
                onClick={handleCloseEauctionModal}
                title="Close e-Auction Console"
                aria-label="Close e-Auction Console"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            {/* Main Portal Body */}
            <div className={`eauction-portal-body eauction-mobile-${mobileView}`}>
              {/* Left Sidebar: Live RFQ List */}
              <LiveBidList
                auctions={auctions}
                selectedLot={selectedLot}
                onSelectLot={handleSelectLot}
                loadingApi={loadingApi}
                currentPage={currentPage}
                totalAuctions={totalAuctions}
                hasNextPage={hasNextPage}
                onPrevPage={() => setCurrentPage((p) => Math.max(1, p - 1))}
                onNextPage={() => setCurrentPage((p) => p + 1)}
              />

              {/* Main Content Workspace */}
              <div className="eauction-main-content">
                <button
                  type="button"
                  className="eauction-back-to-list"
                  onClick={() => setMobileView("list")}
                  aria-label="Back to live bids list"
                >
                  <IconChevronLeft /> Back
                </button>

                {/* Split Bottom Workspace */}
                <div className={`eauction-grid-split${selectedRfqDetails?.addLotOption === false ? ' is-single-column' : ''}`}>
                  {/* Left Column: Live Bidding View */}
                  <div className="eauction-panel-light eauction-panel-column">
                    <div className="eauction-panel-head">
                      <div className="eauction-panel-title-text">
                        Live bidding view: <span className="eauction-live-lot-name">{selectedLot?.name || "No Active Tender Selected"}</span>
                      </div>
                    </div>

                    {/* RFQ Details Card from rfq-by-id API */}
                    {selectedRfqDetails && (
                      <div className="eauction-details-card">
                        <div className="eauction-details-title">RFQ Details</div>
                        <div className="eauction-details-grid">
                          <div>
                            <div className="eauction-detail-label">RFQ Title</div>
                            <div className="eauction-detail-value">{selectedRfqDetails.title || "—"}</div>
                          </div>

                          <div>
                            <div className="eauction-detail-label">Start Date &amp; Time</div>
                            <div className="eauction-detail-value">
                              {formatUtcToLocal(selectedRfqDetails.startDate)}
                            </div>
                          </div>

                          <div>
                            <div className="eauction-detail-label">End Date &amp; Time</div>
                            <div className="eauction-detail-value">
                              {formatUtcToLocal(selectedRfqDetails.endDate)}
                            </div>
                          </div>

                          <div>
                            <div className="eauction-detail-label">Delivery Location</div>
                            <div className="eauction-detail-value">{selectedRfqDetails.deliveryLocation || "—"}</div>
                          </div>

                          <div className="eauction-details-span-2">
                            <div className="eauction-detail-label">Description</div>
                            <div className="eauction-detail-value">{selectedRfqDetails.description || "—"}</div>
                          </div>

                          <div>
                            <div className="eauction-detail-label">Lot Option</div>
                            {selectedRfqDetails.addLotOption ? (
                              <span className="eauction-lot-badge sila-badge sila-badge--success">Allowed</span>
                            ) : (
                              <span className="eauction-lot-badge-disabled sila-badge sila-badge--neutral">Not Allowed</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Material Details Table from rfq-by-id API */}
                    <div className="eauction-material-details">
                      <div className="eauction-material-details-head">
                        <span className="eauction-material-details-label">
                          Material Details {selectedRfqDetails?.addLotOption ? "(Single Lot Bidding)" : "(Line Item Bidding)"}
                        </span>
                        {selectedRfqDetails?.addLotOption && headerRank !== "" && (
                          <span className="eauction-rank-badge-pill sila-badge sila-badge--info">Rank: {headerRank}</span>
                        )}
                      </div>

                      {loadingDetails ? (
                        <div className="eauction-inline-status">
                          Loading material specification details...
                        </div>
                      ) : selectedRfqDetails?.items && selectedRfqDetails.items.length > 0 ? (
                        selectedRfqDetails.addLotOption ? (
                          <div className="eauction-table-wrap">
                            <table className="eauction-table">
                              <thead>
                                <tr>
                                  <th className="eauction-col-index">#</th>
                                  <th>Description</th>
                                  <th>Code</th>
                                  <th>Qty / UOM</th>
                                  <th>Cost Center</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRfqDetails.items.map((item, idx) => {
                                  const itemKey = item.id || item.buyerRFQItemId || `item-${idx}`;
                                  return (
                                    <tr key={itemKey}>
                                      <td className="eauction-col-index eauction-cell-muted">{idx + 1}</td>
                                      <td>
                                        <div className="eauction-cell-title">{item.description}</div>
                                        {item.materialGroup && (
                                          <div className="eauction-cell-subtitle">Group: {item.materialGroup}</div>
                                        )}
                                      </td>
                                      <td>
                                        <span className="eauction-code-chip">
                                          {item.materialCode || "N/A"}
                                        </span>
                                      </td>
                                      <td className="eauction-cell-strong">
                                        {item.quantity} <span className="eauction-cell-subtitle">{item.uom}</span>
                                      </td>
                                      <td className="eauction-cell-muted">
                                        {item.costCenterName || item.costCenter || "—"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        ) : (
                          <>
                            <div className="eauction-bulk-apply-panel eauction-excel-apply-panel">
                              <div className="eauction-bulk-apply-header">
                                <div className="eauction-bulk-apply-title">Excel Apply</div>
                                <p className="eauction-bulk-apply-subtitle">
                                  Download this table as a spreadsheet, edit the values offline, then upload it to apply your changes.
                                </p>
                              </div>

                              <div className="eauction-bulk-apply-controls">
                                <button
                                  type="button"
                                  className="eauction-bulk-apply-btn eauction-excel-apply-btn"
                                  onClick={handleDownloadQuotationExcel}
                                  title="Download this table as an Excel-compatible spreadsheet"
                                >
                                  <FaDownload aria-hidden="true" /> Download Excel
                                </button>
                                <button
                                  type="button"
                                  className="eauction-bulk-apply-btn eauction-excel-apply-btn"
                                  onClick={() => excelFileInputRef.current?.click()}
                                  title="Upload a filled-in spreadsheet to bulk-update these fields"
                                >
                                  <FaFileUpload aria-hidden="true" /> Upload Excel
                                </button>
                                <input
                                  ref={excelFileInputRef}
                                  type="file"
                                  accept=".csv"
                                  className="eauction-excel-file-input"
                                  onChange={handleQuotationExcelFileChange}
                                  tabIndex={-1}
                                  aria-hidden="true"
                                />
                              </div>
                            </div>

                            <div className="eauction-bulk-apply-panel">
                              <div className="eauction-bulk-apply-header">
                                <div className="eauction-bulk-apply-title">Bulk Apply</div>
                                <p className="eauction-bulk-apply-subtitle">
                                  Enter a value, then toggle the columns you want it applied to.
                                </p>
                              </div>

                              <div className="eauction-bulk-apply-controls">
                                <div className="eauction-bulk-value">
                                  <input
                                    type="number"
                                    className="eauction-bulk-value-input"
                                    aria-label="Bulk value"
                                    value={bulkValue}
                                    onChange={(e) => setBulkValue(e.target.value)}
                                    placeholder="Enter value"
                                  />
                                </div>

                                <div className="eauction-bulk-type-toggle" role="group" aria-label="Bulk value type">
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

                                <div className="eauction-bulk-fields">
                                  <label className="eauction-bulk-toggle">
                                    <span>Delivery Charge</span>
                                    <span className="eauction-switch">
                                      <input
                                        type="checkbox"
                                        checked={bulkFields.deliveryCharge}
                                        onChange={(e) => handleBulkFieldToggle("deliveryCharge", e.target.checked)}
                                      />
                                      <span className="eauction-slider"></span>
                                    </span>
                                  </label>

                                  <label className="eauction-bulk-toggle">
                                    <span>Discount</span>
                                    <span className="eauction-switch">
                                      <input
                                        type="checkbox"
                                        checked={bulkFields.discount}
                                        onChange={(e) => handleBulkFieldToggle("discount", e.target.checked)}
                                      />
                                      <span className="eauction-slider"></span>
                                    </span>
                                  </label>

                                  <label className="eauction-bulk-toggle">
                                    <span>Tax</span>
                                    <span className="eauction-switch">
                                      <input
                                        type="checkbox"
                                        checked={bulkFields.tax}
                                        onChange={(e) => handleBulkFieldToggle("tax", e.target.checked)}
                                      />
                                      <span className="eauction-slider"></span>
                                    </span>
                                  </label>

                                  <label className="eauction-bulk-toggle">
                                    <span>Quoted Price</span>
                                    <span className="eauction-switch">
                                      <input
                                        type="checkbox"
                                        checked={bulkFields.quotedPrice}
                                        onChange={(e) => handleBulkFieldToggle("quotedPrice", e.target.checked)}
                                      />
                                      <span className="eauction-slider"></span>
                                    </span>
                                  </label>
                                </div>

                                <button
                                  type="button"
                                  className="eauction-bulk-apply-btn"
                                  onClick={handleBulkApply}
                                >
                                  Apply
                                </button>
                              </div>
                            </div>

                          <div className="eauction-table-wrap">
                            <table className="eauction-table eauction-table--line-items">
                              <thead>
                                <tr>
                                  <th>Material Info</th>
                                  <th>Code</th>
                                  <th>Qty</th>
                                  <th>Delivery Charge</th>
                                  <th>Delivery Type</th>
                                  <th>Discount</th>
                                  <th>Discount Type</th>
                                  <th>Tax</th>
                                  <th>Tax Type</th>
                                  <th className="eauction-col-right">Quoted Price</th>
                                  <th className="eauction-availability-cell">Available</th>
                                  <th>Rank</th>
                                  <th className="eauction-col-right">Sub Total{currency ? ` (${currency})` : ""}</th>
                                  <th className="eauction-col-right">Quoted Amount{currency ? ` (${currency})` : ""}</th>
                                </tr>
                              </thead>
                              <tbody>
                                {selectedRfqDetails.items.map((item, idx) => {
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
                                  const itemRank = ownQuotation?.status === "SUBMITTED" ? (formatRank(matchedItem?.rank) || "--") : "-";
                                  return (
                                    <tr key={itemKey}>
                                      <td>
                                        <div className="eauction-cell-title">{item.description}</div>
                                        {item.materialGroup && (
                                          <div className="eauction-cell-subtitle">Group: {item.materialGroup}</div>
                                        )}
                                      </td>
                                      <td>
                                        <span className="eauction-code-chip">
                                          {item.materialCode || "N/A"}
                                        </span>
                                      </td>
                                      <td className="eauction-cell-strong">
                                        {item.quantity} <span className="eauction-cell-subtitle">{item.uom}</span>
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={line.deliveryCharge || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "deliveryCharge", e.target.value)}
                                          placeholder="0.00"
                                          className="eauction-line-input"
                                        />
                                      </td>
                                      <td>
                                        <select
                                          value={line.deliveryType}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "deliveryType", e.target.value)}
                                          className="eauction-line-select"
                                        >
                                          <option value="PERCENTAGE">Percentage</option>
                                          <option value="AMOUNT">Amount</option>
                                        </select>
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={line.discount || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "discount", e.target.value)}
                                          placeholder="0.00"
                                          className="eauction-line-input"
                                        />
                                      </td>
                                      <td>
                                        <select
                                          value={line.discountType}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "discountType", e.target.value)}
                                          className="eauction-line-select"
                                        >
                                          <option value="PERCENTAGE">Percentage</option>
                                          <option value="AMOUNT">Amount</option>
                                        </select>
                                      </td>
                                      <td>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={line.tax || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "tax", e.target.value)}
                                          placeholder="0.00"
                                          className="eauction-line-input"
                                        />
                                      </td>
                                      <td>
                                        <select
                                          value={line.taxType}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "taxType", e.target.value)}
                                          className="eauction-line-select"
                                        >
                                          <option value="PERCENTAGE">Percentage</option>
                                          <option value="AMOUNT">Amount</option>
                                        </select>
                                      </td>
                                      <td className="eauction-col-right">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={line.quotedPrice || ""}
                                          onChange={(e) => handleLineItemFieldChange(itemKey, "quotedPrice", e.target.value)}
                                          placeholder="0.00"
                                          className="eauction-line-input eauction-line-input--price"
                                        />
                                      </td>
                                      <td className="eauction-availability-cell">
                                        <input
                                          type="checkbox"
                                          className="eauction-availability-checkbox"
                                          checked={!line.isLineitemAvailable}
                                          onChange={(e) => handleLineItemAvailabilityChange(itemKey, !e.target.checked)}
                                          aria-label={`Mark ${item.description || "item"} as available`}
                                        />
                                      </td>
                                      <td className="eauction-cell-strong">
                                        {itemRank}
                                      </td>
                                      <td className="eauction-col-right eauction-cell-strong">
                                        {fmtCurrency(line.subTotal)}
                                      </td>
                                      <td className="eauction-col-right eauction-cell-strong">
                                        {fmtCurrency(line.quotedAmount)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          </>
                        )
                      ) : (
                        <div className="eauction-material-empty">
                          No material items listed for this tender.
                        </div>
                      )}
                    </div>

                    {selectedRfqDetails?.addLotOption === false && (
                      <div className="eauction-bid-feedback-stack">
                        {submitBidError && (
                          <div className="eauction-alert eauction-alert--error">
                            {submitBidError}
                          </div>
                        )}

                        {bidSubmittedMessage && (
                          <div className="eauction-alert eauction-alert--success">
                            {bidSubmittedMessage}
                          </div>
                        )}

                        <div className="eauction-line-item-total-bar">
                          <div className="eauction-total-quote-label">Total Price Quote</div>
                          <div className="eauction-total-quote-value-box">
                            <input
                              type="number"
                              value={totalPriceQuote}
                              onChange={(e) => setTotalPriceQuote(e.target.value)}
                              className="eauction-total-quote-input"
                              aria-label="Total price quote"
                            />
                          </div>
                          <button
                            type="button"
                            className={`eauction-btn-submit-bid eauction-btn-submit-bid--inline${submittingBid ? ' is-loading' : ''}`}
                            onClick={handleSubmitLiveBid}
                            disabled={submittingBid}
                          >
                            {submittingBid ? "Submitting Live Bid..." : <><FaBolt aria-hidden="true" /> Submit Live Bid</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Supplier Live Bidding Submission Panel (Single Lot Bidding only) */}
                  {selectedRfqDetails?.addLotOption !== false && (
                    <div className="eauction-panel-light eauction-panel-column">
                      <div className="eauction-panel-title-text">Submit competitive bid</div>

                      {submitBidError && (
                        <div className="eauction-alert eauction-alert--error">
                          {submitBidError}
                        </div>
                      )}

                      {bidSubmittedMessage && (
                        <div className="eauction-alert eauction-alert--success">
                          {bidSubmittedMessage}
                        </div>
                      )}

                      {/* Quotation Details Form */}
                      <div className="eauction-supplier-bid-box">
                        <div className="eauction-bid-field-grid">
                          <div className="eauction-bid-field">
                            <label className="eauction-bid-field-label" htmlFor="eauction-bid-delivery-charge">Delivery Charge</label>
                            <input
                              id="eauction-bid-delivery-charge"
                              type="number"
                              className="eauction-bid-field-input"
                              value={deliveryCharge}
                              onChange={(e) => setDeliveryCharge(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="eauction-bid-field">
                            <label className="eauction-bid-field-label" htmlFor="eauction-bid-delivery-type">Delivery Type</label>
                            <select
                              id="eauction-bid-delivery-type"
                              className="eauction-bid-field-input"
                              value={deliveryType}
                              onChange={(e) => setDeliveryType(e.target.value)}
                            >
                              <option value="PERCENTAGE">Percentage</option>
                              <option value="AMOUNT">Amount</option>
                            </select>
                          </div>
                          <div className="eauction-bid-field">
                            <label className="eauction-bid-field-label" htmlFor="eauction-bid-discount">Discount</label>
                            <input
                              id="eauction-bid-discount"
                              type="number"
                              className="eauction-bid-field-input"
                              value={discount}
                              onChange={(e) => setDiscount(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="eauction-bid-field">
                            <label className="eauction-bid-field-label" htmlFor="eauction-bid-discount-type">Discount Type</label>
                            <select
                              id="eauction-bid-discount-type"
                              className="eauction-bid-field-input"
                              value={discountType}
                              onChange={(e) => setDiscountType(e.target.value)}
                            >
                              <option value="PERCENTAGE">Percentage</option>
                              <option value="AMOUNT">Amount</option>
                            </select>
                          </div>
                          <div className="eauction-bid-field">
                            <label className="eauction-bid-field-label" htmlFor="eauction-bid-tax">Tax</label>
                            <input
                              id="eauction-bid-tax"
                              type="number"
                              className="eauction-bid-field-input"
                              value={tax}
                              onChange={(e) => setTax(e.target.value)}
                              placeholder="0.00"
                            />
                          </div>
                          <div className="eauction-bid-field">
                            <label className="eauction-bid-field-label" htmlFor="eauction-bid-tax-type">Tax Type</label>
                            <select
                              id="eauction-bid-tax-type"
                              className="eauction-bid-field-input"
                              value={taxType}
                              onChange={(e) => setTaxType(e.target.value)}
                            >
                              <option value="PERCENTAGE">Percentage</option>
                              <option value="AMOUNT">Amount</option>
                            </select>
                          </div>
                        </div>

                        <div className="eauction-total-quote-row">
                          <div className="eauction-total-quote-label">Total Price Quote</div>
                          <div className="eauction-total-quote-value-box">
                            <span className="eauction-total-quote-currency">{currency}</span>
                            <input
                              type="number"
                              value={totalPriceQuote}
                              onChange={(e) => setTotalPriceQuote(e.target.value)}
                              className="eauction-total-quote-input"
                              aria-label="Total price quote"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          className={`eauction-btn-submit-bid${submittingBid ? ' is-loading' : ''}`}
                          onClick={handleSubmitLiveBid}
                          disabled={submittingBid}
                        >
                          {submittingBid ? "Submitting Live Bid..." : <><FaBolt aria-hidden="true" /> Submit Live Bid</>}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* OTP Verification Modals */}
      {otpStage === "send" && (
        <div className="sila-overlay eauction-otp-overlay" onClick={() => setOtpStage("none")}>
          <div
            className="sila-modal eauction-otp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eauction-otp-send-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <h2 className="sila-modal-title eauction-otp-title" id="eauction-otp-send-title">
                <FaEnvelope aria-hidden="true" /> Verify It's You
              </h2>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                onClick={() => setOtpStage("none")}
                aria-label="Close"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="sila-modal-body">
              <h3 className="eauction-otp-heading">Confirm Live Bid Submission</h3>
              <p className="sila-modal-text">
                For security, we'll send a one-time verification code to your registered email before submitting your live competitive bid.
              </p>
              {otpError && (
                <p className="sila-error-text eauction-otp-error" role="alert">{otpError}</p>
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
        <div className="sila-overlay eauction-otp-overlay" onClick={() => setOtpStage("none")}>
          <div
            className="sila-modal eauction-otp-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eauction-otp-verify-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <h2 className="sila-modal-title eauction-otp-title" id="eauction-otp-verify-title">
                <FaKey aria-hidden="true" /> Enter Verification Code
              </h2>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                onClick={() => setOtpStage("none")}
                aria-label="Close"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            <div className="sila-modal-body">
              <p className="sila-modal-text eauction-otp-intro">
                We've sent a 6-digit verification code to your email. It expires in{" "}
                <strong className={`eauction-otp-timer${otpRemaining <= 30 ? " is-urgent" : ""}`}>
                  {formatOtpTimer(otpRemaining)}
                </strong>.
              </p>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                className="sila-input eauction-otp-input"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                placeholder="Enter OTP Code"
                aria-label="One-time verification code"
                aria-invalid={otpRemaining <= 0 || Boolean(otpError) || undefined}
              />
              {otpRemaining <= 0 ? (
                <p className="sila-error-text eauction-otp-error" role="alert">
                  Code expired. Please resend the OTP.
                </p>
              ) : otpError ? (
                <p className="sila-error-text eauction-otp-error" role="alert">{otpError}</p>
              ) : null}

              <div className="eauction-otp-resend">
                <button
                  type="button"
                  className="sila-btn sila-btn--ghost sila-btn--sm"
                  onClick={handleSendOtp}
                  disabled={sendingOtp || otpRemaining > 0}
                >
                  Resend OTP Code
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
                disabled={verifyingOtp || !otpCode.trim()}
              >
                {verifyingOtp && <span className="sila-spinner" aria-hidden="true" />}
                {verifyingOtp ? "Verifying..." : "Verify & Submit Bid"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EAuctionWidget;
