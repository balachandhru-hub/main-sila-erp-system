import type { SilaInvoiceDetail, SilaInvoiceWrite } from "../../../api/silaMe/silaReceivingApi";
import { newInvoiceLine, type InvoiceLineInput } from "./SilaInvoiceLinesEditor";
import { parseNumber } from "./receivingFormat";
import type { ReceivePrefill } from "./SilaReceiveGoodsDialog";

/** The review form of an invoice, as typed. */
export interface InvoiceForm {
  invoiceNumber: string;
  supplierName: string;
  invoiceDate: string;
  currency: string;
  grossAmount: string;
  netAmount: string;
  taxAmount: string;
  supplierTaxNumber: string;
  /** MATERIAL | SERVICE | MIXED; empty = unknown. */
  invoiceType: string;
  purchaseOrderId: string;
  lines: InvoiceLineInput[];
}

export const INVOICE_TYPES = ["MATERIAL", "SERVICE", "MIXED"];

const text = (value?: string | number | null): string => (value === null || value === undefined ? "" : String(value));

export const toInvoiceForm = (invoice: SilaInvoiceDetail): InvoiceForm => ({
  invoiceNumber: text(invoice.invoiceNumber),
  supplierName: text(invoice.supplierName),
  invoiceDate: invoice.invoiceDate ? invoice.invoiceDate.slice(0, 10) : "",
  currency: text(invoice.currency),
  grossAmount: text(invoice.grossAmount),
  netAmount: text(invoice.netAmount),
  taxAmount: text(invoice.taxAmount),
  supplierTaxNumber: text(invoice.supplierTaxNumber),
  invoiceType: text(invoice.invoiceType),
  purchaseOrderId: text(invoice.purchaseOrderId),
  lines: invoice.items.map((item) =>
    newInvoiceLine({
      description: item.description,
      quantity: text(item.quantity),
      unitPrice: text(item.unitPrice),
      amount: text(item.amount),
      purchaseOrderItemId: text(item.purchaseOrderItemId),
      uom: text(item.uom),
      supplierMaterialCode: text(item.supplierMaterialCode),
      taxRate: text(item.taxRate),
      matchStatus: text(item.matchStatus),
    }),
  ),
});

/** The first problem of the form as user-facing text, or null when it can be saved. */
export const validateInvoiceForm = (form: InvoiceForm): string | null => {
  if (form.grossAmount.trim() !== "" && (parseNumber(form.grossAmount) ?? -1) < 0) return "Enter a valid gross amount.";
  if (form.netAmount.trim() !== "" && (parseNumber(form.netAmount) ?? -1) < 0) return "Enter a valid net amount.";
  if (form.taxAmount.trim() !== "" && (parseNumber(form.taxAmount) ?? -1) < 0) return "Enter a valid tax amount.";
  for (const [index, line] of form.lines.entries()) {
    if (!line.description.trim()) return `Enter a description on line ${index + 1}, or remove the line.`;
    for (const value of [line.quantity, line.unitPrice, line.amount]) {
      if (value.trim() !== "" && (parseNumber(value) ?? -1) < 0) return `Enter valid numbers on line ${index + 1}.`;
    }
    const rate = (line.taxRate ?? "").trim();
    if (rate !== "" && !((parseNumber(rate) ?? -1) >= 0 && (parseNumber(rate) ?? 101) <= 100)) return `Enter a tax rate between 0 and 100 on line ${index + 1}.`;
  }
  return null;
};

export const toInvoiceWrite = (form: InvoiceForm, supplierId?: string | null): SilaInvoiceWrite => ({
  invoiceNumber: form.invoiceNumber.trim() || null,
  supplierId: supplierId ?? null,
  supplierName: form.supplierName.trim() || null,
  invoiceDate: form.invoiceDate || null,
  currency: form.currency.trim().toUpperCase() || null,
  grossAmount: parseNumber(form.grossAmount),
  netAmount: parseNumber(form.netAmount),
  taxAmount: parseNumber(form.taxAmount),
  supplierTaxNumber: form.supplierTaxNumber.trim(),
  invoiceType: form.invoiceType || null,
  purchaseOrderId: form.purchaseOrderId || null,
  items: form.lines.map((line, index) => ({
    lineNumber: index + 1,
    description: line.description.trim(),
    quantity: parseNumber(line.quantity),
    unitPrice: parseNumber(line.unitPrice),
    amount: parseNumber(line.amount),
    purchaseOrderItemId: line.purchaseOrderItemId || null,
    uom: line.uom?.trim() || null,
    supplierMaterialCode: line.supplierMaterialCode?.trim() || null,
    taxRate: parseNumber(line.taxRate ?? ""),
  })),
});

/** The receive flow prefilled from the saved invoice: its PO and the quantities of the linked lines. */
export const toReceivePrefill = (invoice: SilaInvoiceDetail): ReceivePrefill | null => {
  if (!invoice.purchaseOrderId || invoice.invoiceType === "SERVICE") return null;
  const quantities: Record<string, number> = {};
  invoice.items.forEach((item) => {
    if (item.purchaseOrderItemId && item.quantity) {
      quantities[item.purchaseOrderItemId] = (quantities[item.purchaseOrderItemId] ?? 0) + item.quantity;
    }
  });
  return { purchaseOrderId: invoice.purchaseOrderId, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, quantities };
};
