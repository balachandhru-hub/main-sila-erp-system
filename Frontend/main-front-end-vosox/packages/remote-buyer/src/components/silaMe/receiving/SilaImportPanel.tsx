import React, { useRef, useState } from "react";
import { toastService } from "@vosox/shared-ui";
import { downloadMasterFile, importMasterFile, type SilaImportResult, type SilaMasterFileKind } from "../../../api/silaMe/silaMasterDataApi";

interface SilaImportPanelProps {
  kind: SilaMasterFileKind;
  /** e.g. "suppliers" */
  noun: string;
  /** MANAGE_SILA_MASTER_DATA: template, check and import. Export only needs read access. */
  canManage: boolean;
  /** Rows were imported. */
  onImported: () => void;
}

const ACTION_LABELS: Record<string, string> = { NEW: "New", UPDATE: "Update", UNCHANGED: "Unchanged", INVALID: "Invalid" };

const actionBadge = (action: string): string =>
  action === "INVALID" ? "sila-badge sila-badge--danger" : action === "NEW" ? "sila-badge sila-badge--success" : action === "UPDATE" ? "sila-badge sila-badge--info" : "sila-badge sila-badge--neutral";

/**
 * Excel data update: download the template (or the current rows), upload a file to check it, then confirm. The import is
 * all-or-nothing, so Confirm is available only when every row is valid.
 */
const SilaImportPanel: React.FC<SilaImportPanelProps> = ({ kind, noun, canManage, onImported }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SilaImportResult | null>(null);
  const [busy, setBusy] = useState<"template" | "export" | "check" | "import" | null>(null);

  const run = async (step: NonNullable<typeof busy>, action: () => Promise<void>) => {
    setBusy(step);
    try {
      await action();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy(null);
    }
  };

  const handleFile = (selected: File | null) => {
    setPreview(null);
    setFile(selected);
    if (!selected) return;
    run("check", async () => setPreview(await importMasterFile(kind, selected, false)));
  };

  const handleImport = () => {
    if (!file) return;
    run("import", async () => {
      const result = await importMasterFile(kind, file, true);
      toastService.success(`${result.newRows} new and ${result.updateRows} changed ${noun} imported.`);
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    });
  };

  const canConfirm = canManage && preview !== null && preview.invalidRows === 0 && preview.newRows + preview.updateRows > 0;

  return (
    <section className="sila-card srcv-stack srcv-panel" aria-label={`Excel import of ${noun}`}>
      <div className="srcv-actions">
        {canManage && (
          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("template", () => downloadMasterFile(kind, true))}>
            {busy === "template" ? "Downloading..." : "Download template"}
          </button>
        )}
        {kind !== "purchase-orders" && (
          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" disabled={busy !== null} onClick={() => run("export", () => downloadMasterFile(kind, false))}>
            {busy === "export" ? "Exporting..." : "Download Excel"}
          </button>
        )}
        {canManage && (
          <div className="sila-field">
            <label className="sila-label" htmlFor={`srcv-import-${kind}`}>Upload Excel (.xlsx)</label>
            <input
              id={`srcv-import-${kind}`}
              ref={inputRef}
              className="sila-input"
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={busy !== null}
              onChange={(event) => handleFile(event.target.files?.[0] ?? null)}
            />
          </div>
        )}
      </div>
      {busy === "check" && <p className="srcv-sub" role="status">Checking the file...</p>}
      {preview && (
        <div className="srcv-stack">
          <p role="status">
            {preview.fileName}: {preview.totalRows} rows — {preview.newRows} new, {preview.updateRows} changed, {preview.unchangedRows} unchanged,{" "}
            <span className={preview.invalidRows > 0 ? "srcv-error" : undefined}>{preview.invalidRows} invalid</span>.
          </p>
          {preview.invalidRows > 0 && (
            <div className="sila-alert sila-alert--warning" role="alert">Correct the invalid rows and upload the file again; nothing is imported while a row is invalid.</div>
          )}
          {preview.rows.length > 0 && (
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">Row</th>
                    <th scope="col">Key</th>
                    <th scope="col">Action</th>
                    <th scope="col">Message</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr key={row.rowNumber}>
                      <td>{row.rowNumber}</td>
                      <td>{row.key || "—"}</td>
                      <td><span className={actionBadge(row.action)}>{ACTION_LABELS[row.action] ?? row.action}</span></td>
                      <td>{row.errors.length > 0 ? <span className="srcv-error">{row.errors.join(" ")}</span> : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="srcv-actions">
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={!canConfirm || busy !== null} onClick={handleImport}>
              {busy === "import" ? "Importing..." : "Confirm import"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default SilaImportPanel;
