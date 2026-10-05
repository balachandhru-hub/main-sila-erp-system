import { useEffect, useMemo, useRef, useState } from "react";
import { isErrorResponse, startRfqChatHub, stopRfqChatHub } from "@vosox/shared-ui";
import type { QuotationSubmittedEvent } from "@vosox/shared-ui";
import { fetchExternalRfqDetails } from "../api/externalSupplierApi";
import type { ExternalRFQDetailResponse } from "../dto/externalSupplierDto";
import type { QuoteLineItem } from "./useQuotationExcelSync";

const parseAsUtcMs = (dateStr?: string | null): number | null => {
  if (!dateStr) return null;
  const hasTz = /Z$|[+-]\d{2}:\d{2}$/.test(dateStr);
  const ms = Date.parse(hasTz ? dateStr : `${dateStr}Z`);
  return Number.isNaN(ms) ? null : ms;
};

const getSubmissionWindowStatus = (rfq: ExternalRFQDetailResponse | null) => {
  if (!rfq) return { notYetOpen: false, closed: false, frozen: false, canSubmit: false };
  const startMs = parseAsUtcMs(rfq.startDate);
  const endMs = parseAsUtcMs(rfq.endDate);
  const nowMs = Date.now();

  const notYetOpen = startMs !== null && nowMs < startMs;
  const closed = endMs !== null && nowMs > endMs;
  const frozen = rfq.status === 'Freezing';

  return { notYetOpen, closed, frozen, canSubmit: !notYetOpen && !closed && !frozen };
};

export type LoadErrorKind = 'invalid-link' | 'forbidden' | 'not-found' | 'generic';

const classifyLoadError = (statusCode: number): LoadErrorKind => {
  if (statusCode === 401) return 'invalid-link';
  if (statusCode === 403) return 'forbidden';
  if (statusCode === 404) return 'not-found';
  return 'generic';
};

export const LOAD_ERROR_TITLES: Record<LoadErrorKind, string> = {
  'invalid-link': 'This link is invalid or has expired',
  forbidden: "You don't have access to this RFQ",
  'not-found': 'RFQ not found',
  generic: 'Something went wrong',
};

export function useExternalRfqLoader(rfqId: string | undefined, sessionToken: string | undefined) {
  const [loading, setLoading] = useState(true);
  const [loadErrorKind, setLoadErrorKind] = useState<LoadErrorKind | null>(null);
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [rfq, setRfq] = useState<ExternalRFQDetailResponse | null>(null);

  const [totalPrice, setTotalPrice] = useState<number>(0);
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  const [deliveryType, setDeliveryType] = useState<string>('PERCENTAGE');
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<string>('PERCENTAGE');
  const [tax, setTax] = useState<number>(0);
  const [taxType, setTaxType] = useState<string>('PERCENTAGE');
  const [itemPrices, setItemPrices] = useState<{ [key: string]: number }>({});
  const [lineItems, setLineItems] = useState<{ [supplierRFQItemId: string]: QuoteLineItem }>({});
  const [quotationId, setQuotationId] = useState<string | null>(null);
  const [hasExistingQuote, setHasExistingQuote] = useState(false);

  const [windowTick, setWindowTick] = useState(0);

  // The RFQ's own currency (e.g. "INR", "USD") — ExternalRFQDetailResponse
  // doesn't declare this field. Left blank (not defaulted to "INR") when
  // the API doesn't return one, since guessing a currency could mislead
  // the supplier.
  const currency = (rfq as any)?.currency || '';
  const fmtCurrency = (val: number) => `${(val || 0).toFixed(2)}${currency ? ` ${currency}` : ''}`;

  // Populates every piece of state derived from a fetched RFQ — the raw `rfq`
  // object itself plus the form fields mirrored from the supplier's existing
  // quotation (total/discount/tax/delivery, per-item prices). Shared by the
  // initial load and every live refetch (including right after this visitor's
  // own submit) so a fresh GET always shows up in the table, not just in `rfq`.
  const applyRfqData = (data: ExternalRFQDetailResponse) => {
    setRfq(data);

    const existingQuote = data.supplierQuotation?.[0];
    if (existingQuote) {
      setQuotationId(existingQuote.qutationId || existingQuote.id || null);
      setHasExistingQuote(existingQuote.status === 'SUBMITTED');
      setTotalPrice(existingQuote.totalPrice || 0);
      setDeliveryCharge(existingQuote.deliveryCharge || 0);
      setDeliveryType(existingQuote.deliveryType || 'PERCENTAGE');
      setDiscount(existingQuote.discount || 0);
      setDiscountType(existingQuote.discountType || 'PERCENTAGE');
      setTax(existingQuote.tax || 0);
      setTaxType(existingQuote.taxType || 'PERCENTAGE');
    }

    // The backend echoes each supplier quotation item's `supplierRFQItemId` as the
    // all-zero placeholder GUID, so matching on it misses every existing quote.
    // `item.id` on an external RFQ item is that same supplierRFQItemId, not the
    // buyer's item id — the field that actually lines up with
    // `supplierQuotationItems[].buyerRFQItemId` is `item.buyerRFQItemId` itself.
    const findExistingItemQuote = (item: (typeof data.items)[number]) =>
      data.supplierQuotationItems?.find(
        (qi) =>
          (item.buyerRFQItemId && qi.buyerRFQItemId === item.buyerRFQItemId) ||
          (item.supplierRFQItemId && qi.supplierRFQItemId === item.supplierRFQItemId)
      );

    const prices: { [key: string]: number } = {};
    data.items?.forEach((item, idx) => {
      const key = item.id || item.buyerRFQItemId || `item-${idx}`;
      const existingItemQuote = findExistingItemQuote(item);
      prices[key] = existingItemQuote?.quotedPrice ?? 0;
    });
    setItemPrices(prices);

    if (!data.addLotOption) {
      const nextLineItems: { [supplierRFQItemId: string]: QuoteLineItem } = {};
      data.items?.forEach((item) => {
        const itemKey = item.supplierRFQItemId;
        if (!itemKey) return;
        const source = findExistingItemQuote(item);
        nextLineItems[itemKey] = {
          deliveryCharge: source?.deliveryCharge ?? 0,
          deliveryType: source?.deliveryType || 'PERCENTAGE',
          discount: source?.discount ?? 0,
          discountType: source?.discountType || 'PERCENTAGE',
          tax: source?.tax ?? 0,
          taxType: source?.taxType || 'PERCENTAGE',
          quotedPrice: source?.quotedPrice ?? 0,
          subTotal: source?.subTotal ?? 0,
          quotedAmount: source?.quotedAmount ?? 0,
          isLineitemAvailable: source?.isLineitemAvailable ?? false,
        };
      });
      setLineItems(nextLineItems);
    } else {
      setLineItems({});
    }
  };

  useEffect(() => {
    if (!rfq) return;
    const t = setInterval(() => setWindowTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, [rfq]);

  useEffect(() => {
    document.title = rfq ? `Quote: ${rfq.title}` : 'Request for Quotation';
  }, [rfq]);

  // Live-refreshes rank/status/quotation data (e.g. this visitor's own submit
  // just got broadcast back, a teammate using the same bid link in another tab
  // submits, or the buyer's side otherwise updates the quotation). No
  // supplierId to scope the connection with — same as ExternalSupplierChat, it
  // connects on rfqId + the session token header alone, and reuses that same
  // shared connection rather than opening a second one (see rfqChatHub.ts).
  const quotationRefetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!rfqId || !sessionToken) return;

    const handleQuotationSubmitted = (_payload: QuotationSubmittedEvent) => {
      if (quotationRefetchTimerRef.current) clearTimeout(quotationRefetchTimerRef.current);
      quotationRefetchTimerRef.current = setTimeout(async () => {
        const data = await fetchExternalRfqDetails(rfqId, sessionToken);
        if (!isErrorResponse(data)) applyRfqData(data);
      }, 500);
    };

    startRfqChatHub(
      { rfqId, sessionToken },
      () => { },
      undefined,
      handleQuotationSubmitted
    ).catch(() => {
    });

    return () => {
      if (quotationRefetchTimerRef.current) clearTimeout(quotationRefetchTimerRef.current);
      stopRfqChatHub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rfqId, sessionToken]);

  useEffect(() => {
    const load = async () => {
      if (!rfqId || !sessionToken) {
        setLoadErrorKind('invalid-link');
        setLoadErrorMessage('This link is missing required information and cannot be opened.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadErrorKind(null);
      setLoadErrorMessage(null);

      const data = await fetchExternalRfqDetails(rfqId, sessionToken);

      if (isErrorResponse(data)) {
        setLoadErrorKind(classifyLoadError(data.statusCode));
        setLoadErrorMessage(data.message || data.description || null);
        setLoading(false);
        return;
      }

      applyRfqData(data);

      setLoading(false);
    };

    load();
  }, [rfqId, sessionToken]);

  const { notYetOpen, frozen, canSubmit } = useMemo(
    () => getSubmissionWindowStatus(rfq),
    [rfq, windowTick]
  );

  return {
    loading,
    loadErrorKind,
    loadErrorMessage,
    rfq,
    totalPrice,
    setTotalPrice,
    deliveryCharge,
    setDeliveryCharge,
    deliveryType,
    setDeliveryType,
    discount,
    setDiscount,
    discountType,
    setDiscountType,
    tax,
    setTax,
    taxType,
    setTaxType,
    itemPrices,
    setItemPrices,
    lineItems,
    setLineItems,
    quotationId,
    hasExistingQuote,
    notYetOpen,
    frozen,
    canSubmit,
    currency,
    fmtCurrency,
  };
}
