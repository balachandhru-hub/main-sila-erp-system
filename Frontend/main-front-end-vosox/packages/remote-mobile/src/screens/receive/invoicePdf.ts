import type { PDFDocument as PdfDocumentType } from 'pdf-lib';

/** A4 in PDF points. */
const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_PADDING = 18;
/** Longest side of a stored page image, enough for OCR while keeping the upload small. */
const MAX_IMAGE_SIDE = 2200;
const JPEG_QUALITY = 0.85;

export interface ScannedPage {
  id: string;
  /** JPEG data URL. */
  dataUrl: string;
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('This image could not be read.'));
    image.src = src;
  });

/** Draws the image on a canvas (optionally rotated 90° clockwise, downscaled) and returns a JPEG data URL. */
const renderJpeg = async (src: string, rotate: boolean): Promise<string> => {
  const image = await loadImage(src);
  const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.round(image.naturalWidth * scale);
  const height = Math.round(image.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = rotate ? height : width;
  canvas.height = rotate ? width : height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot prepare images.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  if (rotate) {
    context.translate(canvas.width, 0);
    context.rotate(Math.PI / 2);
  }
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
};

const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
    reader.readAsDataURL(file);
  });

let pageSequence = 0;

/** Turns a camera / gallery file into a page (JPEG, downscaled). */
export const fileToPage = async (file: File): Promise<ScannedPage> => {
  const dataUrl = await renderJpeg(await readFile(file), false);
  pageSequence += 1;
  return { id: `page-${Date.now()}-${pageSequence}`, dataUrl };
};

export const rotatePage = async (page: ScannedPage): Promise<ScannedPage> => ({
  ...page,
  dataUrl: await renderJpeg(page.dataUrl, true),
});

/** One A4 page per image, each image scaled to fit and centred. */
export const buildInvoicePdf = async (pages: ScannedPage[]): Promise<File> => {
  // pdf-lib is loaded only when an invoice is built, to keep the app bundle small.
  const { PDFDocument } = await import('pdf-lib');
  const pdf: PdfDocumentType = await PDFDocument.create();
  for (const page of pages) {
    const bytes = await (await fetch(page.dataUrl)).arrayBuffer();
    const image = await pdf.embedJpg(bytes);
    const fit = Math.min((A4_WIDTH - PAGE_PADDING * 2) / image.width, (A4_HEIGHT - PAGE_PADDING * 2) / image.height);
    const width = image.width * fit;
    const height = image.height * fit;
    const pdfPage = pdf.addPage([A4_WIDTH, A4_HEIGHT]);
    pdfPage.drawImage(image, { x: (A4_WIDTH - width) / 2, y: (A4_HEIGHT - height) / 2, width, height });
  }
  const bytes = await pdf.save();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return new File([bytes as BlobPart], `invoice-${stamp}.pdf`, { type: 'application/pdf' });
};
