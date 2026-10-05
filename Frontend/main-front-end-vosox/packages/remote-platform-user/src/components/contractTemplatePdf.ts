import jsPDF from 'jspdf';
import type { ContractTemplateRecord } from './ContractTemplate.types';

const MARGIN = 40;
const LINE_HEIGHT = 16;

/** Builds the contract-template PDF (name, classification, key terms and clause library) from a saved record. */
export function generateContractTemplatePdf(template: ContractTemplateRecord): jsPDF {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let y = MARGIN;

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - MARGIN) {
      doc.addPage();
      y = MARGIN;
    }
  };

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.text(template.templateName || 'Contract Template', MARGIN, y);
  y += LINE_HEIGHT * 1.5;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Segment: ${template.segmentName || '-'}    Family: ${template.familyName || '-'}`, MARGIN, y);
  y += LINE_HEIGHT * 2;
  doc.setTextColor(0);

  if (template.description?.trim()) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(11);
    const descLines = doc.splitTextToSize(template.description.trim(), pageWidth - MARGIN * 2) as string[];
    descLines.forEach((line) => {
      ensureSpace(LINE_HEIGHT);
      doc.text(line, MARGIN, y);
      y += LINE_HEIGHT;
    });
    y += LINE_HEIGHT;
  }

  ensureSpace(LINE_HEIGHT * 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Key Terms', MARGIN, y);
  y += LINE_HEIGHT * 1.25;

  doc.setFontSize(11);
  if (template.keyTerms.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('No key terms configured.', MARGIN, y);
    y += LINE_HEIGHT;
  } else {
    template.keyTerms.forEach((term) => {
      ensureSpace(LINE_HEIGHT);
      doc.setFont('helvetica', 'bold');
      doc.text(`${term.label || 'Untitled'}:`, MARGIN, y);
      doc.setFont('helvetica', 'normal');
      doc.text(term.value || '-', MARGIN + 140, y);
      y += LINE_HEIGHT;
    });
  }
  y += LINE_HEIGHT;

  ensureSpace(LINE_HEIGHT * 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Clause Library', MARGIN, y);
  y += LINE_HEIGHT * 1.25;

  doc.setFontSize(11);
  if (template.clauses.length === 0) {
    doc.setFont('helvetica', 'normal');
    doc.text('No clauses configured.', MARGIN, y);
    y += LINE_HEIGHT;
  } else {
    template.clauses.forEach((clause, idx) => {
      ensureSpace(LINE_HEIGHT * 3);
      doc.setFont('helvetica', 'bold');
      doc.text(`${idx + 1}. ${clause.section || 'Untitled Section'} (${clause.type})`, MARGIN, y);
      y += LINE_HEIGHT;
      doc.setFont('helvetica', 'normal');
      const lines = doc.splitTextToSize(clause.clauseText || '-', pageWidth - MARGIN * 2 - 10) as string[];
      lines.forEach((line) => {
        ensureSpace(LINE_HEIGHT);
        doc.text(line, MARGIN + 10, y);
        y += LINE_HEIGHT;
      });
      y += LINE_HEIGHT * 0.5;
    });
  }

  template.customSections.forEach((section) => {
    y += LINE_HEIGHT;
    ensureSpace(LINE_HEIGHT * 2);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.text(section.title || 'Untitled Section', MARGIN, y);
    y += LINE_HEIGHT * 1.25;

    doc.setFontSize(11);
    if (section.fields.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.text('No fields configured.', MARGIN, y);
      y += LINE_HEIGHT;
    } else {
      section.fields.forEach((field) => {
        ensureSpace(LINE_HEIGHT);
        doc.setFont('helvetica', 'normal');
        const requiredMark = field.mandatory ? ' *' : '';
        const optionsSuffix = field.options && field.options.length > 0 ? ` (${field.options.join(', ')})` : '';
        doc.text(`- ${field.label || 'Untitled field'}${requiredMark} [${field.type || 'TEXT'}]${optionsSuffix}`, MARGIN + 10, y);
        y += LINE_HEIGHT;
      });
    }
  });

  return doc;
}

/** Triggers a browser download of an already-loaded file (e.g. an uploaded template's data URL). */
export function downloadDataUrl(dataUrl: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/** Strips the "data:<mime>;base64," prefix off a data URL, leaving the raw base64 payload the
 * contract-template create API expects in attachment.fileBytes. */
export function dataUrlToBase64(dataUrl: string): string {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex === -1 ? dataUrl : dataUrl.slice(commaIndex + 1);
}

/** fetchBuyerAsset's fileBytes is inconsistent across asset types - sometimes raw base64, sometimes
 * already a full "data:...;base64,..." URI (see contractPdf.ts's drawnSignatureUrl handling for the same
 * quirk). Wrapping an already-prefixed value in another "data:...;base64," prefix produces a corrupt,
 * unreadable PDF, so this checks first instead of blindly concatenating. */
export function toPdfDataUrl(fileBytes: string, contentType: string): string {
  return fileBytes.startsWith('data:') ? fileBytes : `data:${contentType};base64,${fileBytes}`;
}

/** Turns a template name into a safe PDF filename. */
export function slugifyTemplateName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || 'contract-template';
}
