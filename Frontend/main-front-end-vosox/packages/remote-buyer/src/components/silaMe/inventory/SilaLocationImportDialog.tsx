import React, { useState } from "react";
import { EmptyState, Modal, toastService } from "@vosox/shared-ui";
import { silaLabel } from "../../../api/silaMe/silaInventoryApi";
import {
  importLocations,
  previewLocationImport,
  type SilaLocationImportPreview,
} from "../../../api/silaMe/silaInventoryControlApi";

interface SilaLocationImportDialogProps {
  onClose: () => void;
  onImported: () => void;
}

const MAX_BYTES = 5 * 1024 * 1024;

const actionBadge = (action: string): string =>
  action === "INVALID" ? "sila-badge--danger" : action === "NEW" ? "sila-badge--success" : action === "UPDATE" ? "sila-badge--info" : "sila-badge--neutral";

/** Location import: choose an .xlsx file, check it (preview), then confirm. The import is all or nothing. */
const SilaLocationImportDialog: React.FC<SilaLocationImportDialogProps> = ({ onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SilaLocationImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const chooseFile = (chosen: File | null) => {
    setPreview(null);
    setFormError(null);
    if (chosen && !chosen.name.toLowerCase().endsWith(".xlsx")) {
      setFormError("Choose an .xlsx file.");
      setFile(null);
      return;
    }
    if (chosen && chosen.size > MAX_BYTES) {
      setFormError("The file is larger than 5 MB.");
      setFile(null);
      return;
    }
    setFile(chosen);
  };

  const check = async () => {
    if (!file) {
      setFormError("Choose the location file first.");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      setPreview(await previewLocationImport(file));
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Could not check the file.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importLocations(file);
      toastService.success(`Locations imported: ${result.newRows} new, ${result.updateRows} updated.`);
      onImported();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not import the locations.");
    } finally {
      setBusy(false);
    }
  };

  const canConfirm =
    preview !== null && preview.fileErrors.length === 0 && preview.invalidRows === 0 && preview.newRows + preview.updateRows > 0;

  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: "Import locations" }}
      footerProps={{
        primaryButton: canConfirm
          ? { text: "Confirm import", onClick: confirm, loading: busy, disabled: busy }
          : { text: "Check file", onClick: check, loading: busy, disabled: busy || !file },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: busy },
      }}
    >
      <div className="sila-root sila-me sinv-dialog">
        <div className="sila-field">
          <label className="sila-label" htmlFor="sinv-import-file">Location file (.xlsx)</label>
          <input
            id="sinv-import-file"
            className="sila-input"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={busy}
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
          />
          <span className="sila-help">Start from the template. Rows with an existing location code update that location.</span>
        </div>
        {formError && <p className="sila-error-text" role="alert">{formError}</p>}

        {preview && (
          <>
            <div className="sinv-import-summary">
              <span className="sila-badge sila-badge--neutral">{preview.totalRows} rows</span>
              <span className="sila-badge sila-badge--success">{preview.newRows} new</span>
              <span className="sila-badge sila-badge--info">{preview.updateRows} updated</span>
              <span className="sila-badge sila-badge--neutral">{preview.unchangedRows} unchanged</span>
              <span className={`sila-badge ${preview.invalidRows > 0 ? "sila-badge--danger" : "sila-badge--neutral"}`}>
                {preview.invalidRows} invalid
              </span>
            </div>
            {preview.fileErrors.map((message) => (
              <div key={message} className="sila-alert sila-alert--danger" role="alert">{message}</div>
            ))}
            {!canConfirm && preview.fileErrors.length === 0 && (
              <p className="sila-help">
                {preview.invalidRows > 0 ? "Fix the invalid rows and check the file again; nothing is imported while a row is invalid." : "The file changes nothing."}
              </p>
            )}
            {preview.rows.length === 0 ? (
              <EmptyState title="No rows in the file" />
            ) : (
              <div className="sila-table-wrap">
                <table className="sila-table">
                  <thead>
                    <tr>
                      <th scope="col" className="sinv-num">Row</th>
                      <th scope="col">Location</th>
                      <th scope="col">Type</th>
                      <th scope="col">Action</th>
                      <th scope="col">Problems</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((row) => (
                      <tr key={row.rowNumber}>
                        <td className="sinv-num">{row.rowNumber}</td>
                        <td>
                          <span className="sila-cell-strong">{row.locationCode || "—"}</span>
                          <span className="sinv-sub">{row.locationName}</span>
                        </td>
                        <td>{silaLabel(row.locationType)}</td>
                        <td><span className={`sila-badge ${actionBadge(row.action)}`}>{silaLabel(row.action)}</span></td>
                        <td>{row.errors.length > 0 ? row.errors.join(" ") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaLocationImportDialog;
