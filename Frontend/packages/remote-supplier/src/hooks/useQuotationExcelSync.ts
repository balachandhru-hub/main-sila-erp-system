import { useRef } from "react";
import { toastService } from "@vosox/shared-ui";
import { QUOTATION_EXCEL_HEADERS, buildCsv, parseCsv, downloadCsv } from "../utils/quotationExcel";
import type { RFQDetailItem } from "../dto/supplierDto";

export interface QuoteLineItem {
  deliveryCharge: number;
  deliveryType: string;
  discount: number;
  discountType: string;
  tax: number;
  taxType: string;
  quotedPrice: number;
  subTotal: number;
  quotedAmount: number;
  isLineitemAvailable: boolean;
}

export const EMPTY_LINE_ITEM: QuoteLineItem = {
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

export interface UseQuotationExcelSyncOptions {
  items: RFQDetailItem[] | null | undefined;
  lineItems: Record<string, QuoteLineItem>;
  setLineItems: React.Dispatch<React.SetStateAction<Record<string, QuoteLineItem>>>;
  /** Used to build the downloaded file's name: `quotation-summary-${fileNameId || "rfq"}.csv`. */
  fileNameId?: string | null;
  /** Exact toast text shown when every row in the file matched an item (wording differs per screen). */
  fullMatchSuccessMessage: string;
}

export function useQuotationExcelSync({
  items,
  lineItems,
  setLineItems,
  fileNameId,
  fullMatchSuccessMessage,
}: UseQuotationExcelSyncOptions) {
  const excelFileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDownloadQuotationExcel = () => {
    if (!items?.length) return;

    const rows = items.map((item, idx) => {
      const itemKey = item.supplierRFQItemId || `item-${idx}`;
      const line = lineItems[itemKey];
      return [
        itemKey,
        item.description || "",
        item.materialCode || "",
        item.quantity ?? "",
        item.uom || "",
        line?.deliveryCharge ?? 0,
        line?.deliveryType || "PERCENTAGE",
        line?.discount ?? 0,
        line?.discountType || "PERCENTAGE",
        line?.tax ?? 0,
        line?.taxType || "PERCENTAGE",
        line?.quotedPrice ?? 0,
        // "Available" in the UI is the checkbox state, which is the inverse of isLineitemAvailable.
        line?.isLineitemAvailable ? "No" : "Yes",
      ];
    });

    const csv = buildCsv([[...QUOTATION_EXCEL_HEADERS], ...rows]);
    downloadCsv(csv, `quotation-summary-${fileNameId || "rfq"}.csv`);
  };

  const handleQuotationExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !items) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const rows = parseCsv(String(reader.result || ""));
        if (rows.length < 2) {
          toastService.error("The uploaded file has no data rows.");
          return;
        }

        const [headerRow, ...dataRows] = rows;
        const colIndex = (name: string) =>
          headerRow.findIndex((h) => h.trim().toLowerCase() === name.toLowerCase());

        const idxItemKey = colIndex("Item Key");
        const idxCode = colIndex("Code");
        const idxDeliveryCharge = colIndex("Delivery Charge");
        const idxDeliveryType = colIndex("Delivery Type");
        const idxDiscount = colIndex("Discount");
        const idxDiscountType = colIndex("Discount Type");
        const idxTax = colIndex("Tax");
        const idxTaxType = colIndex("Tax Type");
        const idxQuotedPrice = colIndex("Quoted Price");
        const idxAvailable = colIndex("Available");

        if (idxQuotedPrice === -1) {
          toastService.error("The uploaded file is missing the required \"Quoted Price\" column. Please use the downloaded template.");
          return;
        }
        if (idxItemKey === -1 && idxCode === -1) {
          toastService.error("The uploaded file is missing the \"Item Key\" and \"Code\" columns needed to match rows to items. Please use the downloaded template.");
          return;
        }

        const normalizeType = (value: string | undefined, fallback: string) => {
          const v = (value || "").trim().toUpperCase();
          return v === "PERCENTAGE" || v === "AMOUNT" ? v : fallback;
        };
        const parseNumber = (value: string | undefined, fallback: number) => {
          const n = Number((value || "").trim());
          return Number.isFinite(n) ? n : fallback;
        };
        // "Available" column is the checkbox's own Yes/No state, inverse of isLineitemAvailable.
        const parseAvailable = (value: string | undefined, fallback: boolean) => {
          const v = (value || "").trim().toLowerCase();
          if (["yes", "true", "1"].includes(v)) return false;
          if (["no", "false", "0"].includes(v)) return true;
          return fallback;
        };

        const rfqItems = items || [];
        // Match strictly by identity (Item Key, then material Code) - never by row position, since
        // a file re-ordered in Excel or downloaded for a different RFQ would otherwise silently
        // apply the wrong row's values to an item.
        const matches = rfqItems.map((item, idx) => {
          const itemKey = item.supplierRFQItemId || `item-${idx}`;
          const matchRow =
            (idxItemKey !== -1 && dataRows.find((r) => r[idxItemKey] === itemKey)) ||
            (idxCode !== -1 && item.materialCode && dataRows.find((r) => r[idxCode] === item.materialCode)) ||
            null;
          return { itemKey, matchRow };
        });

        const matchedCount = matches.filter((m) => m.matchRow).length;
        if (matchedCount === 0) {
          toastService.error("None of the rows in this file match this RFQ's items. Make sure you're uploading the spreadsheet downloaded for this RFQ.");
          return;
        }

        setLineItems((prev) => {
          const next = { ...prev };
          matches.forEach(({ itemKey, matchRow }) => {
            if (!matchRow) return;

            const existing: QuoteLineItem = next[itemKey] || EMPTY_LINE_ITEM;

            next[itemKey] = {
              ...existing,
              deliveryCharge: idxDeliveryCharge !== -1 ? parseNumber(matchRow[idxDeliveryCharge], existing.deliveryCharge) : existing.deliveryCharge,
              deliveryType: idxDeliveryType !== -1 ? normalizeType(matchRow[idxDeliveryType], existing.deliveryType) : existing.deliveryType,
              discount: idxDiscount !== -1 ? parseNumber(matchRow[idxDiscount], existing.discount) : existing.discount,
              discountType: idxDiscountType !== -1 ? normalizeType(matchRow[idxDiscountType], existing.discountType) : existing.discountType,
              tax: idxTax !== -1 ? parseNumber(matchRow[idxTax], existing.tax) : existing.tax,
              taxType: idxTaxType !== -1 ? normalizeType(matchRow[idxTaxType], existing.taxType) : existing.taxType,
              quotedPrice: parseNumber(matchRow[idxQuotedPrice], existing.quotedPrice),
              isLineitemAvailable: idxAvailable !== -1 ? parseAvailable(matchRow[idxAvailable], existing.isLineitemAvailable) : existing.isLineitemAvailable,
            };
          });
          return next;
        });

        toastService.success(
          matchedCount < rfqItems.length
            ? `Applied values for ${matchedCount} of ${rfqItems.length} items. ${rfqItems.length - matchedCount} item(s) in this RFQ weren't found in the file and were left unchanged.`
            : fullMatchSuccessMessage
        );
      } catch {
        toastService.error("Couldn't read that file. Please upload the downloaded template without changing its columns.");
      }
    };
    reader.onerror = () => toastService.error("Couldn't read that file. Please try again.");
    reader.readAsText(file);
  };

  return { excelFileInputRef, handleDownloadQuotationExcel, handleQuotationExcelFileChange };
}
