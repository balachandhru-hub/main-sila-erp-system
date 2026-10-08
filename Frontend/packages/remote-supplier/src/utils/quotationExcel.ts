// Shared CSV read/write helpers for the "Excel Apply" download/upload feature on the
// supplier quotation line-item tables (SupplierRfqQuotationSummary, EAuctionWidget,
// ExternalSupplierBid). CSV (not a real .xlsx) since Excel opens/edits/saves CSV natively
// and no xlsx-generation library is used anywhere else in this codebase.

export const QUOTATION_EXCEL_HEADERS = [
  "Item Key",
  "Material Info",
  "Code",
  "Qty",
  "UOM",
  "Delivery Charge",
  "Delivery Type",
  "Discount",
  "Discount Type",
  "Tax",
  "Tax Type",
  "Quoted Price",
  "Available",
] as const;

export const escapeCsvValue = (value: string | number): string => {
  const str = String(value ?? "");
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
};

export const buildCsv = (rows: (string | number)[][]): string =>
  rows.map((row) => row.map(escapeCsvValue).join(",")).join("\r\n");

// Minimal RFC 4180 parser - handles quoted fields containing commas, quotes and newlines,
// which a naive `line.split(',')` would break on.
export const parseCsv = (text: string): string[][] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
};

export const downloadCsv = (csv: string, fileName: string) => {
  // Leading BOM so Excel opens the UTF-8 file (item descriptions, etc.) without mangling it.
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
