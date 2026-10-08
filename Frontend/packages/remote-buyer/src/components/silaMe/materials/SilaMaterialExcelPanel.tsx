import React, { useRef, useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  confirmMaterialImport,
  downloadMaterialTemplate,
  exportMaterials,
  previewMaterialImport,
  type SilaMaterialImportResult,
} from "../../../api/silaMe/silaMaterialsApi";
import { codeLabel } from "./materialFormat";
import "../silaMeTheme.css";
import "./SilaMaterials.css";

interface SilaMaterialExcelPanelProps {
  /** Template and import need MANAGE_SILA_MASTER_DATA; export only needs to view. */
  canImport: boolean;
  /** Current list filters, applied to the export. */
  search: string;
  priceStatus: string;
  inventoryOnly: boolean;
  /** Called after an import was applied. */
  onImported: () => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

/** Download template, export and upload (preview, then confirm) of the material Excel file. */
const SilaMaterialExcelPanel: React.FC<SilaMaterialExcelPanelProps> = ({ canImport, search, priceStatus, inventoryOnly, onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"" | "template" | "export" | "preview" | "import">("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SilaMaterialImportResult | null>(null);

  const run = async (kind: "template" | "export", action: () => Promise<void>) => {
    setBusy(kind);
    try {
      await action();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "The download failed.");
    } finally {
      setBusy("");
    }
  };

  const handleFile = async (chosen: File | undefined) => {
    if (inputRef.current) inputRef.current.value = "";
    if (!chosen) return;
    if (!chosen.name.toLowerCase().endsWith(".xlsx")) {
      toastService.error("Choose an .xlsx file (start from the template).");
      return;
    }
    if (chosen.size > MAX_BYTES) {
      toastService.error("The file is larger than 5 MB.");
      return;
    }
    setBusy("preview");
    try {
      const result = await previewMaterialImport(chosen);
      setFile(chosen);
      setPreview(result);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not read the material file.");
    } finally {
      setBusy("");
    }
  };

  const closePreview = () => {
    setPreview(null);
    setFile(null);
  };

  const handleConfirm = async () => {
    if (!file) return;
    setBusy("import");
    try {
      const result = await confirmMaterialImport(file);
      if (!result.applied) {
        setPreview(result);
        toastService.error("Nothing was imported: fix the rows marked invalid and upload the file again.");
        return;
      }
      toastService.success(
        `Import done: ${result.changedRows} material(s) changed, ${result.conversions} conversion(s), ${result.priceChanges} price change(s) sent for approval.`,
      );
      closePreview();
      onImported();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not import the material file.");
    } finally {
      setBusy("");
    }
  };

  const canConfirm = !!preview && preview.fileErrors.length === 0 && preview.invalidRows === 0 && preview.validRows > 0;

  return (
    <>
      <div className="smat-counts">
        {canImport && (
          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== ""}
            onClick={() => run("template", downloadMaterialTemplate)}>
            {busy === "template" ? "Downloading..." : "Download template"}
          </button>
        )}
        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== ""}
          onClick={() => run("export", () => exportMaterials(search, priceStatus, inventoryOnly))}>
          {busy === "export" ? "Exporting..." : "Export Excel"}
        </button>
        {canImport && (
          <>
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy !== ""}
              onClick={() => inputRef.current?.click()}>
              {busy === "preview" ? "Reading..." : "Upload Excel"}
            </button>
            <input ref={inputRef} type="file" accept=".xlsx" hidden aria-label="Material Excel file"
              onChange={(event) => handleFile(event.target.files?.[0])} />
          </>
        )}
      </div>

      {preview && (
        <Modal
          isOpen
          onClose={closePreview}
          size="xl"
          headerProps={{ heading: "Material import preview", subHeading: preview.fileName }}
          footerProps={{
            secondaryButton: { text: "Cancel", variant: "secondary", onClick: closePreview, disabled: busy === "import" },
            primaryButton: { text: "Confirm import", onClick: handleConfirm, loading: busy === "import", disabled: !canConfirm },
          }}
        >
          <div className="sila-root sila-me smat-panel">
            <div className="smat-counts">
              <span className="sila-badge sila-badge--neutral">{preview.totalRows} rows</span>
              <span className="sila-badge sila-badge--success">{preview.validRows} valid</span>
              <span className={`sila-badge sila-badge--${preview.invalidRows > 0 ? "danger" : "neutral"}`}>{preview.invalidRows} invalid</span>
              <span className="sila-badge sila-badge--info">{preview.changedRows} changed</span>
              <span className="sila-badge sila-badge--neutral">{preview.unchangedRows} unchanged</span>
              <span className="sila-badge sila-badge--warning">{preview.priceChanges} price change(s) for approval</span>
              <span className="sila-badge sila-badge--info">{preview.conversions} conversion(s)</span>
            </div>
            {preview.fileErrors.length > 0 && (
              <div className="sila-alert sila-alert--danger" role="alert">
                <ul className="smat-messages">{preview.fileErrors.map((message) => <li key={message}>{message}</li>)}</ul>
              </div>
            )}
            {!canConfirm && preview.fileErrors.length === 0 && (
              <div className="sila-alert sila-alert--warning" role="status">
                The import is all-or-nothing: fix the invalid rows in the file and upload it again.
              </div>
            )}
            {preview.rows.length > 0 && (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Sheet</th>
                      <th scope="col" className="smat-num">Row</th>
                      <th scope="col">Material</th>
                      <th scope="col">Action</th>
                      <th scope="col">Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={`${row.sheet}-${row.rowNumber}`}>
                        <td>{row.sheet}</td>
                        <td className="smat-num">{row.rowNumber}</td>
                        <td>{row.materialCode || "—"}</td>
                        <td>
                          <span className={`sila-badge sila-badge--${row.action === "INVALID" ? "danger" : row.action === "UNCHANGED" ? "neutral" : "info"}`}>
                            {codeLabel(row.action)}
                          </span>
                        </td>
                        <td>{row.messages.length === 0 ? "—" : row.messages.map((message) => <span key={message} className="smat-sub">{message}</span>)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default SilaMaterialExcelPanel;
