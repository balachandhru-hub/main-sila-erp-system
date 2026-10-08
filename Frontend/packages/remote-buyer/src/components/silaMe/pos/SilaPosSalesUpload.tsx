import React, { useRef, useState } from "react";
import { toastService } from "@vosox/shared-ui";
import {
  discardPosBatch,
  previewPosSales,
  processPosBatch,
  type SilaPosImportResult,
  type SilaPosPreview,
} from "../../../api/silaMe/silaPosApi";
import { downloadPosTemplate, type SilaPosSource } from "../../../api/silaMe/silaPosMasterApi";
import SilaPosImportSummary from "./SilaPosImportSummary";
import SilaPosPreviewTable from "./SilaPosPreviewTable";
import { SilaPosConfirm, SilaPosSourceSelect } from "./SilaPosShared";
import { errorText } from "./posFormat";

interface SilaPosSalesUploadProps {
  sources: SilaPosSource[];
  canManage: boolean;
  /** Called after a batch is processed or discarded (refreshes the batch list). */
  onProcessed: () => void;
}

/** Two-step sales upload: validate the file (preview), then process the batch. */
const SilaPosSalesUpload: React.FC<SilaPosSalesUploadProps> = ({ sources, canManage, onProcessed }) => {
  const [sourceId, setSourceId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState<"upload" | "process" | "discard" | null>(null);
  const [preview, setPreview] = useState<SilaPosPreview | null>(null);
  const [result, setResult] = useState<SilaPosImportResult | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const resetFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = "";
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy("upload");
    setResult(null);
    try {
      const checked = await previewPosSales(file, sourceId || undefined);
      setPreview(checked);
      resetFile();
      toastService.success(`Batch ${checked.batchNumber}: ${checked.readyToProcess} of ${checked.totalRows} line${checked.totalRows === 1 ? "" : "s"} ready.`);
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not upload the sales file."));
    } finally {
      setBusy(null);
    }
  };

  const handleProcess = async () => {
    if (!preview) return;
    setBusy("process");
    try {
      const processed = await processPosBatch(preview.batchId);
      setResult(processed);
      setPreview(null);
      onProcessed();
      toastService.success(`Batch ${processed.batchNumber}: ${processed.processed} line${processed.processed === 1 ? "" : "s"} processed.`);
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not process the sales batch."));
    } finally {
      setBusy(null);
    }
  };

  const handleDiscard = async () => {
    if (!preview) return;
    setBusy("discard");
    try {
      await discardPosBatch(preview.batchId);
      toastService.success(`Upload ${preview.batchNumber} discarded.`);
      setPreview(null);
      setConfirmDiscard(false);
      onProcessed();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not discard the upload."));
    } finally {
      setBusy(null);
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadPosTemplate("SALES");
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not download the template."));
    }
  };

  if (!canManage) {
    return <div className="sila-alert sila-alert--warning" role="status">You do not have permission to upload POS sales.</div>;
  }

  return (
    <div className="srec-stack">
      <div className="srec-filters spos-toolbar">
        {sources.length > 0 && (
          <SilaPosSourceSelect id="spos-upload-source" sources={sources} value={sourceId} onChange={setSourceId} allowDefault />
        )}
        <div className="sila-field srec-grow">
          <label className="sila-label" htmlFor="spos-upload-file">Sales file (.xlsx or .csv)</label>
          <input
            id="spos-upload-file"
            ref={fileInput}
            className="sila-input"
            type="file"
            accept=".xlsx,.csv"
            disabled={preview !== null}
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          <span className="sila-help">Columns: BusinessDate, TransactionId, LineId, PosCode, Qty, UOM, OutletCode, Currency, Amount.</span>
        </div>
        <div className="srec-actions">
          <button type="button" className="sila-btn sila-btn--ghost" onClick={handleTemplate}>Template</button>
          <button type="button" className="sila-btn sila-btn--primary" onClick={handleUpload} disabled={!file || busy !== null || preview !== null}>
            {busy === "upload" ? "Checking..." : "Upload and check"}
          </button>
        </div>
      </div>

      {preview && (
        <SilaPosPreviewTable
          preview={preview}
          busy={busy}
          onProcess={handleProcess}
          onDiscard={() => setConfirmDiscard(true)}
        />
      )}

      {result && <SilaPosImportSummary result={result} onClose={() => setResult(null)} />}

      {confirmDiscard && preview && (
        <SilaPosConfirm
          heading="Discard upload"
          content={`Discard upload ${preview.batchNumber}?`}
          description="Its lines are removed and nothing is deducted. You can upload a corrected file afterwards."
          confirmText="Discard"
          busy={busy === "discard"}
          onConfirm={handleDiscard}
          onClose={() => setConfirmDiscard(false)}
        />
      )}
    </div>
  );
};

export default SilaPosSalesUpload;
