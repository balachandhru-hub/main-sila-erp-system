import jsPDF from "jspdf";
import type { SilaShortageGroup, SilaShortageLine, SilaShortageReport } from "../../../api/silaMe/silaControlApi";
import { formatMoney, formatQty, scLabel } from "../stockCount/stockCountFormat";
import { categoryLabel } from "./controlFormat";

const MARGIN = 36;
const ROW_HEIGHT = 14;

interface PdfColumn<T> {
  title: string;
  width: number;
  value: (row: T) => string;
  align?: "left" | "right";
}

interface PdfFilterText {
  location: string;
  category: string;
  enquiryStatus: string;
}

const clip = (doc: jsPDF, text: string, width: number): string => {
  if (doc.getTextWidth(text) <= width) return text;
  let value = text;
  while (value.length > 1 && doc.getTextWidth(`${value}…`) > width) value = value.slice(0, -1);
  return `${value}…`;
};

/** Writes a simple table, adding pages as needed (header repeated). Returns the y position after the table. */
const table = <T>(doc: jsPDF, columns: PdfColumn<T>[], rows: T[], startY: number): number => {
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = startY;
  const header = () => {
    doc.setFont("helvetica", "bold");
    let x = MARGIN;
    columns.forEach((column) => {
      const text = clip(doc, column.title, column.width - 4);
      doc.text(text, column.align === "right" ? x + column.width - 4 : x, y, { align: column.align === "right" ? "right" : "left" });
      x += column.width;
    });
    doc.setFont("helvetica", "normal");
    y += ROW_HEIGHT;
  };
  header();
  rows.forEach((row) => {
    if (y > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN + ROW_HEIGHT;
      header();
    }
    let x = MARGIN;
    columns.forEach((column) => {
      const text = clip(doc, column.value(row), column.width - 4);
      doc.text(text, column.align === "right" ? x + column.width - 4 : x, y, { align: column.align === "right" ? "right" : "left" });
      x += column.width;
    });
    y += ROW_HEIGHT;
  });
  return y + ROW_HEIGHT;
};

const groupColumns = (title: string, label: (name: string) => string): PdfColumn<SilaShortageGroup>[] => [
  { title, width: 260, value: (row) => label(row.name) },
  { title: "Lines", width: 60, value: (row) => String(row.lines), align: "right" },
  { title: "Shortage value", width: 110, value: (row) => formatMoney(row.shortageValue), align: "right" },
  { title: "Posted value", width: 110, value: (row) => formatMoney(row.postedValue), align: "right" },
];

const lineColumns: PdfColumn<SilaShortageLine>[] = [
  { title: "Count", width: 62, value: (row) => row.countNumber },
  { title: "Submitted", width: 62, value: (row) => (row.submittedOn ? row.submittedOn.slice(0, 10) : "—") },
  { title: "Location", width: 95, value: (row) => row.locationName ?? "—" },
  { title: "Material", width: 160, value: (row) => `${row.materialCode} ${row.materialName}` },
  { title: "Short", width: 62, value: (row) => `${formatQty(row.shortageQty)} ${row.uom}`, align: "right" },
  { title: "Value", width: 62, value: (row) => formatMoney(row.shortageValue), align: "right" },
  { title: "Justification", width: 110, value: (row) => categoryLabel(row.justificationCategory) },
  { title: "Enquiry", width: 85, value: (row) => scLabel(row.enquiryStatus) },
  { title: "Review", width: 70, value: (row) => scLabel(row.reviewStatus) },
  { title: "Posted", width: 40, value: (row) => (row.posted ? "Yes" : "No") },
];

/** Builds the shortage report PDF (landscape A4) from the same data the screen shows, and downloads it. */
export const downloadShortagePdf = (report: SilaShortageReport, lines: SilaShortageLine[], filters: PdfFilterText): void => {
  const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Shortage report", MARGIN, MARGIN);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${report.from.slice(0, 10)} to ${report.to.slice(0, 10)} · Location: ${filters.location} · Justification: ${filters.category} · Enquiry: ${filters.enquiryStatus}`,
    MARGIN,
    MARGIN + 16,
  );

  const totals = report.totals;
  const summary = [
    `Lines ${totals.lines}`,
    `Shortage ${formatMoney(totals.shortageValue)}`,
    `Justified ${formatMoney(totals.justifiedValue)} (${totals.justifiedLines})`,
    `Accepted ${formatMoney(totals.acceptedValue)} (${totals.acceptedLines})`,
    `Rejected ${formatMoney(totals.rejectedValue)} (${totals.rejectedLines})`,
    `Posted ${formatMoney(totals.postedValue)} (${totals.postedLines})`,
  ].join("   ");
  doc.setFont("helvetica", "bold");
  doc.text(summary, MARGIN, MARGIN + 34);
  doc.setFont("helvetica", "normal");

  let y = table(doc, groupColumns("Location", (name) => name), report.byLocation, MARGIN + 60);
  y = table(doc, groupColumns("Justification", categoryLabel), report.byReason, y);
  if (y > doc.internal.pageSize.getHeight() - MARGIN * 3) {
    doc.addPage();
    y = MARGIN + ROW_HEIGHT;
  }
  table(doc, lineColumns, lines, y);
  doc.save(`shortage-report-${report.from.slice(0, 10)}-${report.to.slice(0, 10)}.pdf`);
};
