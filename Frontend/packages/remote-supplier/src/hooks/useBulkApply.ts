// Shared "Bulk Apply" panel for supplier quotation/bid line-item tables (SupplierRfqQuotationSummary,
// EAuctionWidget, ExternalSupplierBid): lets a supplier type one value and apply it (as a percentage or
// flat amount) across several pricing columns for every item at once, instead of editing row by row.
import { useState } from "react";
import type { RFQDetailItem } from "../dto/supplierDto";
import type { QuoteLineItem } from "./useQuotationExcelSync";

export interface BulkFields {
  deliveryCharge: boolean;
  discount: boolean;
  tax: boolean;
  quotedPrice: boolean;
}

const BULK_TYPE_FIELD_MAP: Partial<Record<keyof BulkFields, keyof QuoteLineItem>> = {
  deliveryCharge: "deliveryType",
  discount: "discountType",
  tax: "taxType",
};

export interface UseBulkApplyOptions {
  items: RFQDetailItem[] | null | undefined;
  onFieldChange: (supplierRFQItemId: string, field: keyof QuoteLineItem, value: string) => void;
}

export function useBulkApply({ items, onFieldChange }: UseBulkApplyOptions) {
  const [bulkValue, setBulkValue] = useState("");
  const [bulkValueType, setBulkValueType] = useState<"PERCENTAGE" | "AMOUNT">("PERCENTAGE");
  const [bulkFields, setBulkFields] = useState<BulkFields>({
    deliveryCharge: false,
    discount: false,
    tax: false,
    quotedPrice: false,
  });

  const handleBulkFieldToggle = (field: keyof BulkFields, checked: boolean) => {
    setBulkFields((prev) => ({ ...prev, [field]: checked }));
  };

  const handleBulkApply = () => {
    if (bulkValue === "" || !items) return;

    const fieldKeys = (Object.keys(bulkFields) as (keyof BulkFields)[]).filter(
      (key) => bulkFields[key]
    );
    if (fieldKeys.length === 0) return;

    items.forEach((item, idx) => {
      const itemKey = item.supplierRFQItemId || `item-${idx}`;
      fieldKeys.forEach((field) => {
        onFieldChange(itemKey, field, bulkValue);
        const typeField = BULK_TYPE_FIELD_MAP[field];
        if (typeField) {
          onFieldChange(itemKey, typeField, bulkValueType);
        }
      });
    });
  };

  return {
    bulkValue,
    setBulkValue,
    bulkValueType,
    setBulkValueType,
    bulkFields,
    handleBulkFieldToggle,
    handleBulkApply,
  };
}
