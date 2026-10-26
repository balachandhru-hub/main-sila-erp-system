import React, { useRef, useState } from 'react';
import { fileToPage, rotatePage, type ScannedPage } from '../screens/receive/invoicePdf';
import { errorText } from '../useLoad';

export const MAX_PAGES = 20;

interface PageScannerProps {
  pages: ScannedPage[];
  onChange: (pages: ScannedPage[]) => void;
  /** Optional PDF chosen from gallery/files. Cleared when image pages are used. */
  pdfFile?: File | null;
  onPdfChange?: (file: File | null) => void;
  disabled?: boolean;
}

const isPdf = (file: File): boolean =>
  file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

/** Adds invoice pages from the camera or gallery; gallery also accepts a PDF. */
const PageScanner: React.FC<PageScannerProps> = ({ pages, onChange, pdfFile = null, onPdfChange, disabled }) => {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const pdfRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const full = pages.length >= MAX_PAGES;

  const addImages = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const files = Array.from(list);
      const pdf = files.find(isPdf);
      if (pdf) {
        onPdfChange?.(pdf);
        onChange([]);
        return;
      }
      const room = MAX_PAGES - pages.length;
      const images = files.filter((file) => file.type.startsWith('image/')).slice(0, room);
      if (images.length === 0) {
        setError('Choose an image or a PDF.');
        return;
      }
      onPdfChange?.(null);
      const added: ScannedPage[] = [];
      for (const file of images) added.push(await fileToPage(file));
      onChange([...pages, ...added]);
      if (files.length > room) setError(`Only ${MAX_PAGES} pages fit in one invoice.`);
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
      if (cameraRef.current) cameraRef.current.value = '';
      if (galleryRef.current) galleryRef.current.value = '';
      if (pdfRef.current) pdfRef.current.value = '';
    }
  };

  const move = (index: number, step: number) => {
    const target = index + step;
    if (target < 0 || target >= pages.length) return;
    const next = [...pages];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const rotate = async (index: number) => {
    setBusy(true);
    try {
      const rotated = await rotatePage(pages[index]);
      onChange(pages.map((page, position) => (position === index ? rotated : page)));
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sm-section" aria-labelledby="sm-pages">
      <h2 id="sm-pages">
        {pdfFile ? 'PDF selected' : `Pages (${pages.length}/${MAX_PAGES})`}
      </h2>
      <input
        ref={cameraRef}
        className="sm-visually-hidden"
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => addImages(event.target.files)}
      />
      <input
        ref={galleryRef}
        className="sm-visually-hidden"
        type="file"
        accept="image/*,application/pdf,.pdf"
        multiple
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => addImages(event.target.files)}
      />
      <input
        ref={pdfRef}
        className="sm-visually-hidden"
        type="file"
        accept="application/pdf,.pdf"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => addImages(event.target.files)}
      />
      <div className="sm-grid-2">
        <button type="button" className="sm-btn sm-btn--primary" disabled={disabled || busy || full || Boolean(pdfFile)} onClick={() => cameraRef.current?.click()}>
          Take photo
        </button>
        <button type="button" className="sm-btn" disabled={disabled || busy || full || Boolean(pdfFile)} onClick={() => galleryRef.current?.click()}>
          From gallery
        </button>
      </div>
      <button type="button" className="sm-btn sm-btn--block" disabled={disabled || busy} onClick={() => pdfRef.current?.click()}>
        {pdfFile ? 'Replace PDF' : 'Pick PDF'}
      </button>
      {busy && <p className="sm-muted" role="status">Preparing pages…</p>}
      {error && <p className="sm-notice sm-notice--error" role="alert">{error}</p>}
      {pdfFile && (
        <div className="sm-card">
          <strong className="sm-title">{pdfFile.name}</strong>
          <span className="sm-meta">PDF · {(pdfFile.size / 1024).toFixed(0)} KB</span>
          <button
            type="button"
            className="sm-btn sm-btn--small sm-btn--danger"
            disabled={disabled}
            onClick={() => onPdfChange?.(null)}
          >
            Remove PDF
          </button>
        </div>
      )}
      {!pdfFile && pages.length === 0 && <p className="sm-empty">Photograph each page of the invoice, pick images from the gallery, or pick a PDF.</p>}
      {!pdfFile && (
        <ol className="sm-pages">
          {pages.map((page, index) => (
            <li key={page.id} className="sm-page">
              <img src={page.dataUrl} alt={`Invoice page ${index + 1}`} />
              <span className="sm-muted">Page {index + 1}</span>
              <div className="sm-page__tools">
                <button type="button" className="sm-btn sm-btn--small" aria-label={`Rotate page ${index + 1}`} disabled={disabled || busy} onClick={() => rotate(index)}>
                  ↻
                </button>
                <button type="button" className="sm-btn sm-btn--small" aria-label={`Move page ${index + 1} up`} disabled={disabled || index === 0} onClick={() => move(index, -1)}>
                  ↑
                </button>
                <button
                  type="button"
                  className="sm-btn sm-btn--small"
                  aria-label={`Move page ${index + 1} down`}
                  disabled={disabled || index === pages.length - 1}
                  onClick={() => move(index, 1)}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="sm-btn sm-btn--small sm-btn--danger"
                  aria-label={`Delete page ${index + 1}`}
                  disabled={disabled}
                  onClick={() => onChange(pages.filter((item) => item.id !== page.id))}
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
};

export default PageScanner;
