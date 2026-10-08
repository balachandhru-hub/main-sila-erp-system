import jsPDF from "jspdf";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { fetchBuyerAsset } from "../../api/platformApi";
import { fmtINR, resolveMimeType, isPdfAttachment, base64ToUint8Array } from "./contractFormatters";
import type { RfqAssetAttachment, SignDetails } from "../ContractCreationView";

// pdfjs-dist is sizeable and only needed once someone actually builds a contract PDF, so it's loaded on first
// use instead of at module load - keeps it out of the app's main bundle for everyone who never gets here.
let pdfjsLibPromise: ReturnType<typeof loadPdfjsLib> | null = null;
async function loadPdfjsLib() {
  const [pdfjsLib, { default: pdfjsWorkerUrl }] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  return pdfjsLib;
}
function getPdfjsLib() {
  if (!pdfjsLibPromise) pdfjsLibPromise = loadPdfjsLib();
  return pdfjsLibPromise;
}

// SILA brand palette (packages/shared-ui/src/styles/tokens.css), as RGB for jsPDF/pdf-lib color setters.
export const SILA_PRIMARY_RGB: [number, number, number] = [31, 92, 196];
export const SILA_PRIMARY_SOFT_RGB: [number, number, number] = [238, 244, 253];
export const SILA_SUCCESS_RGB: [number, number, number] = [21, 128, 61];
export const SILA_SUCCESS_SOFT_RGB: [number, number, number] = [236, 253, 243];
export const SILA_SUCCESS_BORDER_RGB: [number, number, number] = [187, 229, 200];
export const SILA_TEXT_RGB: [number, number, number] = [15, 23, 42];
export const SILA_TEXT_SECONDARY_RGB: [number, number, number] = [51, 65, 85];
export const SILA_TEXT_MUTED_RGB: [number, number, number] = [100, 116, 139];
export const SILA_BORDER_RGB: [number, number, number] = [226, 232, 240];
export const SILA_ROW_ALT_RGB: [number, number, number] = [248, 250, 252];

export interface ContractPdfLineItemRow {
  idx: number;
  material: string;
  costCenterCode: string;
  qty: number;
  uom: string;
  unitPrice: number;
  breakdownStr: string;
  subtotal: number;
}

/** Everything the executed-contract PDF needs, decoupled from ContractCreationView's internal ContractState shape. */
export interface ContractPdfInput {
  contractNumber: string;
  contractName: string;
  supplierName: string;
  rfqTitle: string;
  contractValue: number;
  /** ISO currency code (e.g. "AED", "INR"), appended after formatted amounts. Omitted when the RFQ has none. */
  currency?: string;
  startDate: string;
  endDate: string;
  lineItemRows: ContractPdfLineItemRow[];
  buyerTcContent: string;
  buyerTermsDocs: RfqAssetAttachment[];
  supplierTermsDocs: RfqAssetAttachment[];
  /** The RFQ's contract template document(s), merged in alongside the buyer/supplier Terms & Conditions. */
  contractTemplateDocs?: RfqAssetAttachment[];
  buyerSignDetails: SignDetails | null;
  supplierSignDetails: SignDetails | null;
  /** Preloaded SILA logo as a PNG data URL (jsPDF's addImage needs a data URI, not a plain asset URL). */
  logoDataUrl: string | null;
  /** Plain text extracted from buyerTermsDocs' PDF attachment(s), printed in place of buyerTcContent when present. */
  buyerTermsExtractedText?: string;
  /** Plain text extracted from supplierTermsDocs' PDF attachment(s). */
  supplierTermsExtractedText?: string;
  /** Plain text extracted from contractTemplateDocs' PDF attachment(s). */
  contractTemplateExtractedText?: string;
}

// Pulls the plain text out of an uploaded Terms & Conditions PDF so the executed-contract cover page can print
// the actual clauses instead of just naming the attached file.
async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdfjsLib = await getPdfjsLib();
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pageTexts.push(pageText.trim());
  }
  return pageTexts.filter(Boolean).join("\n\n");
}

// Fetches and extracts the text of every PDF attachment in a Terms & Conditions doc list, concatenated (with a
// filename heading when there's more than one). Returns "" if there are no PDF attachments, or extraction fails.
export async function extractTermsDocsText(docs: RfqAssetAttachment[]): Promise<string> {
  const pdfDocs = docs.filter((d) => isPdfAttachment(d) && d.id);
  const sections: string[] = [];
  for (const attachment of pdfDocs) {
    try {
      const asset = await fetchBuyerAsset(attachment.id);
      if (!("fileBytes" in asset) || !asset.fileBytes) continue;
      const text = await extractPdfText(base64ToUint8Array(asset.fileBytes));
      if (!text) continue;
      sections.push(pdfDocs.length > 1 ? `${attachment.fileName || attachment.assetName || "Document"}:\n${text}` : text);
    } catch {
      // Non-fatal: this document's text just won't be inlined - the cover page falls back to naming it instead.
    }
  }
  return sections.join("\n\n");
}

// The signer's own browser only ever records SignDetails (name/designation/drawn image) for their own
// signature - the counterparty's side only ever gets a "signed" flag plus an uploaded e-sign asset (from
// fetchESigns/rfq-by-id), never structured details. This fetches that asset so the executed-contract PDF/print
// can still show the counterparty's actual signature instead of "Not signed".
export async function resolveEffectiveSignDetails(
  own: SignDetails | null | undefined,
  signed: boolean,
  attachment: RfqAssetAttachment | undefined,
  fallbackName: string
): Promise<SignDetails | null> {
  if (own) return own;
  if (!signed) return null;
  let drawnSignatureUrl: string | undefined;
  if (attachment?.id) {
    try {
      const asset = await fetchBuyerAsset(attachment.id);
      if ("fileBytes" in asset && asset.fileBytes) {
        const fileName = asset.fileName || attachment.fileName || attachment.assetName || "signature.png";
        const mime = resolveMimeType(asset.contentType || asset.fileType, fileName);
        drawnSignatureUrl = asset.fileBytes.startsWith("data:") ? asset.fileBytes : `data:${mime};base64,${asset.fileBytes}`;
      }
    } catch {
      // Non-fatal: falls back to a text-based "/s/ Name" mark below.
    }
  }
  return {
    signerName: fallbackName,
    signerDesignation: "Authorized Representative",
    signedAt: "",
    method: "upload",
    drawnSignatureUrl,
  };
}

// Draws the cover page(s): logo, contract meta, item table, Terms & Conditions summary and signatures. Any
// actual T&C PDF files get merged in as real pages after this by buildMergedContractPdfBytes - this only notes
// their filenames here rather than listing them as plain text.
export function buildContractCoverPdfBytes(input: ContractPdfInput): Uint8Array {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 40;
  const marginBottom = 56;
  const contentWidth = pageWidth - marginX * 2;
  const money = (val: number) => `${fmtINR(val)}${input.currency ? ` ${input.currency}` : ""}`;
  let y = 0;

  // A fresh page below the header band, ready for content - used for the first page (after drawHeader) and every
  // page break thereafter (drawHeader is only ever called once, on page 1).
  const startContentArea = () => {
    y = 96;
  };

  const ensureSpace = (needed: number, onNewPage?: () => void) => {
    if (y + needed > pageHeight - marginBottom) {
      doc.addPage();
      startContentArea();
      onNewPage?.();
    }
  };

  // Header band: SILA logo + document eyebrow/title on the left, an "Executed" status pill on the right (this
  // PDF is only ever built once both parties have signed), with a brand rule beneath.
  const drawHeader = () => {
    const logoWidth = 78;
    const logoHeight = logoWidth * (101 / 420);
    let textX = marginX;
    if (input.logoDataUrl) {
      try {
        doc.addImage(input.logoDataUrl, "PNG", marginX, 34, logoWidth, logoHeight);
        textX = marginX + logoWidth + 14;
      } catch {
        // Non-fatal: the header still renders without the logo.
      }
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...SILA_TEXT_MUTED_RGB);
    doc.text("SUPPLIER CONTRACT", textX, 40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...SILA_TEXT_RGB);
    doc.text(input.contractName, textX, 58);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...SILA_TEXT_MUTED_RGB);
    doc.text(`Contract No. ${input.contractNumber}`, textX, 72);

    // Status pill, top-right: "EXECUTED" once both parties have signed, "DRAFT" for the pre-signature copy
    // attached when the contract is first sent for approvals.
    const isExecuted = Boolean(input.buyerSignDetails && input.supplierSignDetails);
    const pillLabel = isExecuted ? "EXECUTED" : "DRAFT";
    const pillFillRgb = isExecuted ? SILA_SUCCESS_SOFT_RGB : SILA_PRIMARY_SOFT_RGB;
    const pillBorderRgb = isExecuted ? SILA_SUCCESS_BORDER_RGB : SILA_BORDER_RGB;
    const pillTextRgb = isExecuted ? SILA_SUCCESS_RGB : SILA_PRIMARY_RGB;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const pillTextWidth = doc.getTextWidth(pillLabel);
    const pillWidth = pillTextWidth + 26;
    const pillHeight = 18;
    const pillX = pageWidth - marginX - pillWidth;
    const pillY = 32;
    doc.setFillColor(...pillFillRgb);
    doc.setDrawColor(...pillBorderRgb);
    doc.setLineWidth(0.75);
    doc.roundedRect(pillX, pillY, pillWidth, pillHeight, 9, 9, "FD");
    doc.setTextColor(...pillTextRgb);
    doc.text(pillLabel, pillX + pillWidth / 2, pillY + pillHeight / 2 + 3, { align: "center" });

    doc.setDrawColor(...SILA_PRIMARY_RGB);
    doc.setLineWidth(1.4);
    doc.line(marginX, 84, pageWidth - marginX, 84);
    doc.setLineWidth(0.75);
    startContentArea();
  };
  drawHeader();

  // Summary card: a soft-tinted panel with a two-column label/value grid, in the style of an Ariba-type
  // contract summary rather than a run of plain "Label: value" text lines.
  const summaryFields: [string, string][] = [
    ["RFQ TITLE", input.rfqTitle],
    ["SUPPLIER", input.supplierName],
    ["CONTRACT VALUE", money(input.contractValue)],
    ["CONTRACT PERIOD", `${input.startDate}  to  ${input.endDate}`],
  ];
  const summaryColWidth = contentWidth / 2;
  const summaryRowHeight = 34;
  const summaryHeight = Math.ceil(summaryFields.length / 2) * summaryRowHeight + 16;
  doc.setFillColor(...SILA_PRIMARY_SOFT_RGB);
  doc.roundedRect(marginX, y, contentWidth, summaryHeight, 6, 6, "F");
  summaryFields.forEach(([label, value], i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const cellX = marginX + 18 + col * summaryColWidth;
    const cellY = y + 20 + row * summaryRowHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SILA_TEXT_MUTED_RGB);
    doc.text(label, cellX, cellY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...SILA_TEXT_RGB);
    const valueLines = doc.splitTextToSize(value, summaryColWidth - 36);
    doc.text(valueLines[0] || "", cellX, cellY + 15);
  });
  y += summaryHeight + 24;

  // Section heading with a small brand-colored accent bar, reused for "Selected Line Items" and both
  // Terms & Conditions sections below.
  const sectionHeading = (label: string) => {
    doc.setFillColor(...SILA_PRIMARY_RGB);
    doc.rect(marginX, y - 10, 3, 13, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11.5);
    doc.setTextColor(...SILA_TEXT_RGB);
    doc.text(label, marginX + 10, y);
    y += 18;
  };

  sectionHeading("Selected Line Items");

  const columns: { label: string; width: number; align: "left" | "right" }[] = [
    { label: "#", width: 20, align: "left" },
    { label: "Material", width: 140, align: "left" },
    { label: "Cost Center / Code", width: 85, align: "left" },
    { label: "Qty", width: 30, align: "right" },
    { label: "UOM", width: 30, align: "right" },
    { label: "Unit Price", width: 65, align: "right" },
    { label: "Tax / Disc / Del", width: 75, align: "right" },
    { label: "Subtotal", width: 70, align: "right" },
  ];
  const tableWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const cellFontSize = 8.25;
  const cellLineHeight = 10;
  const headerRowHeight = 22;
  const cellVPad = 8;

  // Wraps a cell's text to fit inside its own column (rather than shrinking the font until it *might* fit) -
  // this is what stops long material names/breakdowns from bleeding into the next column, since every row's
  // height grows to match its tallest wrapped cell instead of forcing everything onto one line.
  const wrapCell = (text: string, colWidth: number): string[] => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(cellFontSize);
    return doc.splitTextToSize(String(text ?? ""), colWidth - 10);
  };

  const drawTableHeader = () => {
    doc.setFillColor(...SILA_PRIMARY_RGB);
    doc.rect(marginX, y, tableWidth, headerRowHeight, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(cellFontSize);
    doc.setTextColor(255, 255, 255);
    let x = marginX;
    columns.forEach((col) => {
      const textX = col.align === "right" ? x + col.width - 5 : x + 5;
      doc.text(col.label, textX, y + headerRowHeight / 2 + 3, { align: col.align });
      x += col.width;
    });
    y += headerRowHeight;
  };

  const drawTableRow = (cells: string[], zebra: boolean) => {
    const wrapped = cells.map((cell, i) => wrapCell(cell, columns[i].width));
    const maxLines = Math.max(...wrapped.map((w) => w.length), 1);
    const rowHeight = Math.max(maxLines * cellLineHeight + cellVPad, 22);
    ensureSpace(rowHeight, drawTableHeader);
    if (zebra) {
      doc.setFillColor(...SILA_ROW_ALT_RGB);
      doc.rect(marginX, y, tableWidth, rowHeight, "F");
    }
    doc.setFont("helvetica", "normal");
    doc.setFontSize(cellFontSize);
    doc.setTextColor(...SILA_TEXT_RGB);
    let x = marginX;
    columns.forEach((col, i) => {
      const textX = col.align === "right" ? x + col.width - 5 : x + 5;
      let ly = y + cellVPad / 2 + cellLineHeight - 1;
      wrapped[i].forEach((line) => {
        doc.text(line, textX, ly, { align: col.align });
        ly += cellLineHeight;
      });
      x += col.width;
      if (i < columns.length - 1) {
        doc.setDrawColor(...SILA_BORDER_RGB);
        doc.setLineWidth(0.4);
        doc.line(x, y, x, y + rowHeight);
      }
    });
    doc.setDrawColor(...SILA_BORDER_RGB);
    doc.setLineWidth(0.5);
    doc.line(marginX, y + rowHeight, marginX + tableWidth, y + rowHeight);
    y += rowHeight;
  };

  ensureSpace(headerRowHeight);
  drawTableHeader();
  input.lineItemRows.forEach((row, i) => {
    drawTableRow(
      [
        String(row.idx),
        row.material,
        row.costCenterCode,
        String(row.qty),
        row.uom,
        money(row.unitPrice),
        row.breakdownStr || "—",
        money(row.subtotal),
      ],
      i % 2 === 1
    );
  });
  y += 10;

  // Total row: right-aligned, in its own highlighted strip so it reads as a totals bar rather than another line
  // of body text.
  const totalBarHeight = 26;
  ensureSpace(totalBarHeight + 8);
  doc.setFillColor(...SILA_PRIMARY_SOFT_RGB);
  doc.rect(marginX, y, tableWidth, totalBarHeight, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...SILA_PRIMARY_RGB);
  doc.text("Total Contract Value", marginX + 10, y + totalBarHeight / 2 + 3.5);
  doc.text(money(input.contractValue), marginX + tableWidth - 10, y + totalBarHeight / 2 + 3.5, { align: "right" });
  y += totalBarHeight + 26;

  // Prints each party's actual Terms & Conditions text inline: the extracted text of their attached PDF(s) when
  // available, falling back to the buyer's own free-text draft (when there's no attachment) or, failing that, a
  // pointer to the attached file(s) so the reader always sees something rather than a blank section. Rendered
  // inside a bordered card so it reads as a document exhibit rather than loose body text.
  const writeTcSection = (label: string, docs: RfqAssetAttachment[], extractedText?: string, text?: string) => {
    ensureSpace(46);
    sectionHeading(label);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.75);
    const pdfDocs = docs.filter(isPdfAttachment);
    const otherDocs = docs.filter((d) => !isPdfAttachment(d));
    let lines: string[];
    if (extractedText && extractedText.trim()) {
      lines = doc.splitTextToSize(extractedText.trim(), contentWidth - 28);
    } else if (docs.length > 0) {
      lines = [
        ...(pdfDocs.length > 0
          ? [`The full text is included on the following page${pdfDocs.length > 1 ? "s" : ""} of this document (${pdfDocs.map((d) => d.fileName || d.assetName || "Terms & Conditions document").join(", ")}).`]
          : []),
        ...otherDocs.map((d) => `- ${d.fileName || d.assetName || "Terms & Conditions document"}`),
      ];
    } else {
      lines = doc.splitTextToSize(text || "", contentWidth - 28);
    }

    const lineHeight = 12.5;
    const cardHeight = lines.length * lineHeight + 24;
    // A single bordered card only works when it fits on one page - a fully extracted multi-page T&C PDF can run
    // far longer than that, and boxing it would just clip past the bottom margin instead of paginating. Past
    // that size, fall back to plain flowing paragraphs (still page-broken via ensureSpace) with no box.
    const maxSinglePageCardHeight = pageHeight - marginBottom - 96;
    if (cardHeight > maxSinglePageCardHeight) {
      doc.setTextColor(...SILA_TEXT_SECONDARY_RGB);
      lines.forEach((line) => {
        ensureSpace(lineHeight);
        doc.text(line, marginX + 4, y);
        y += lineHeight;
      });
      doc.setTextColor(...SILA_TEXT_RGB);
      y += 14;
      return;
    }
    ensureSpace(cardHeight);
    doc.setDrawColor(...SILA_BORDER_RGB);
    doc.setLineWidth(0.75);
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(marginX, y, contentWidth, cardHeight, 4, 4, "S");
    let ly = y + 18;
    doc.setTextColor(...SILA_TEXT_SECONDARY_RGB);
    lines.forEach((line) => {
      doc.text(line, marginX + 14, ly);
      ly += lineHeight;
    });
    doc.setTextColor(...SILA_TEXT_RGB);
    y += cardHeight + 22;
  };

  if (input.contractTemplateDocs && input.contractTemplateDocs.length > 0) {
    writeTcSection("Contract Template", input.contractTemplateDocs, input.contractTemplateExtractedText);
  }
  writeTcSection("Buyer Terms & Conditions", input.buyerTermsDocs, input.buyerTermsExtractedText, input.buyerTcContent);
  if (input.supplierTermsDocs.length > 0) {
    writeTcSection("Supplier Terms & Conditions", input.supplierTermsDocs, input.supplierTermsExtractedText);
  }

  // Signatures: two bordered cards side by side, each with a labeled header strip, the drawn/uploaded signature
  // (or a text "/s/ Name" mark when none is available), signer name/designation and a "Digitally Signed" tag.
  const signBoxHeight = 104;
  ensureSpace(20 + signBoxHeight);
  sectionHeading("Signatures");

  const signGap = 20;
  const signBoxWidth = (contentWidth - signGap) / 2;
  const writeSignature = (label: string, details: SignDetails | null | undefined, x: number) => {
    const boxTop = y;
    doc.setDrawColor(...SILA_BORDER_RGB);
    doc.setLineWidth(0.75);
    doc.roundedRect(x, boxTop, signBoxWidth, signBoxHeight, 4, 4, "S");

    doc.setFillColor(...SILA_PRIMARY_SOFT_RGB);
    doc.rect(x, boxTop, signBoxWidth, 22, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...SILA_PRIMARY_RGB);
    const labelLines = doc.splitTextToSize(label.toUpperCase(), signBoxWidth - 16);
    doc.text(labelLines[0] || "", x + 10, boxTop + 14);

    if (!details) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9.5);
      doc.setTextColor(...SILA_TEXT_MUTED_RGB);
      doc.text("Not signed", x + 12, boxTop + 52);
      return;
    }

    let signatureDrawn = false;
    if (details.drawnSignatureUrl) {
      try {
        doc.addImage(details.drawnSignatureUrl, "PNG", x + 12, boxTop + 28, 110, 34);
        signatureDrawn = true;
      } catch {
        signatureDrawn = false;
      }
    }
    if (!signatureDrawn) {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(14);
      doc.setTextColor(...SILA_TEXT_RGB);
      doc.text(`/s/ ${details.signerName}`, x + 12, boxTop + 48);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...SILA_TEXT_RGB);
    doc.text(`${details.signerName} (${details.signerDesignation})`, x + 12, boxTop + 74);
    if (details.signedAt) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...SILA_TEXT_MUTED_RGB);
      doc.text(`Signed ${details.signedAt}`, x + 12, boxTop + 87);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...SILA_SUCCESS_RGB);
    doc.text("DIGITALLY SIGNED", x + signBoxWidth - 10, boxTop + signBoxHeight - 10, { align: "right" });
    doc.setTextColor(...SILA_TEXT_RGB);
  };

  writeSignature("Buyer", input.buyerSignDetails, marginX);
  writeSignature(`Supplier (${input.supplierName})`, input.supplierSignDetails, marginX + signBoxWidth + signGap);
  y += signBoxHeight;

  // Footer, added to every page once total content (and so total page count) is known: a rule, contract number
  // on the left, page numbers on the right.
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setDrawColor(...SILA_BORDER_RGB);
    doc.setLineWidth(0.5);
    doc.line(marginX, pageHeight - 36, pageWidth - marginX, pageHeight - 36);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SILA_TEXT_MUTED_RGB);
    doc.text(`Contract No. ${input.contractNumber} · Generated via SILA ProcurementSuite`, marginX, pageHeight - 22);
    doc.text(`Page ${page} of ${totalPages}`, pageWidth - marginX, pageHeight - 22, { align: "right" });
  }

  return new Uint8Array(doc.output("arraybuffer"));
}

// Merges the cover page(s) above with the real pages of any uploaded buyer/supplier Terms & Conditions PDF -
// so the executed contract is one actual combined document, not just a page listing filenames. A non-PDF
// upload (docx/image/etc.) can't be page-merged, so it stays as a filename note on the cover page only.
async function mergeTcPdfPages(target: PDFDocument, docs: RfqAssetAttachment[], sectionTitle: string) {
  for (const attachment of docs) {
    if (!attachment.id || !isPdfAttachment(attachment)) continue;
    try {
      const asset = await fetchBuyerAsset(attachment.id);
      if (!("fileBytes" in asset) || !asset.fileBytes) continue;
      const sourceDoc = await PDFDocument.load(base64ToUint8Array(asset.fileBytes), { ignoreEncryption: true });

      const dividerPage = target.addPage();
      const font = await target.embedFont(StandardFonts.HelveticaBold);
      const [r, g, b] = SILA_PRIMARY_RGB;
      dividerPage.drawText(`${sectionTitle} — ${attachment.fileName || attachment.assetName || "Attached Document"}`, {
        x: 40,
        y: dividerPage.getHeight() - 56,
        size: 13,
        font,
        color: rgb(r / 255, g / 255, b / 255),
      });

      const copiedPages = await target.copyPages(sourceDoc, sourceDoc.getPageIndices());
      copiedPages.forEach((page) => target.addPage(page));
    } catch {
      // Non-fatal: this document's real pages just won't be merged in - its filename still shows on the cover page.
    }
  }
}

export async function buildMergedContractPdfBytes(input: ContractPdfInput): Promise<Uint8Array> {
  const [buyerTermsExtractedText, supplierTermsExtractedText, contractTemplateExtractedText] = await Promise.all([
    extractTermsDocsText(input.buyerTermsDocs),
    extractTermsDocsText(input.supplierTermsDocs),
    extractTermsDocsText(input.contractTemplateDocs || []),
  ]);
  const coverBytes = buildContractCoverPdfBytes({
    ...input,
    buyerTermsExtractedText,
    supplierTermsExtractedText,
    contractTemplateExtractedText,
  });
  const merged = await PDFDocument.load(coverBytes);
  // Only merge the attachment's own raw pages in when its text couldn't be inlined on the cover page above -
  // otherwise the same document would appear twice in the merged contract.
  if (!buyerTermsExtractedText) {
    await mergeTcPdfPages(merged, input.buyerTermsDocs, "Buyer Terms & Conditions");
  }
  if (!supplierTermsExtractedText) {
    await mergeTcPdfPages(merged, input.supplierTermsDocs, "Supplier Terms & Conditions");
  }
  if (!contractTemplateExtractedText) {
    await mergeTcPdfPages(merged, input.contractTemplateDocs || [], "Contract Template");
  }
  return merged.save();
}
