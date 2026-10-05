import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { importMappings, type SilaPosMappingImport as ImportResult, type SilaPosMappingKind } from "../../../api/silaMe/silaPosMasterApi";
import { errorText } from "./posFormat";

interface SilaPosMappingImportProps {
  sourceId: string;
  kind: SilaPosMappingKind;
  onClose: () => void;
  onImported: () => void;
}

/** Excel import of outlet or item mappings: preview first, then import all rows (nothing while a row is invalid). */
const SilaPosMappingImport: React.FC<SilaPosMappingImportProps> = ({ sourceId, kind, onClose, onImported }) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const subject = kind === "OUTLETS" ? "outlet" : "item";

  const handlePreview = async () => {
    if (!file) return;
    setBusy(true);
    try {
      setPreview(await importMappings(sourceId, kind, file, false));
    } catch (err: unknown) {
      setPreview(null);
      toastService.error(errorText(err, "Could not read the file."));
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const result = await importMappings(sourceId, kind, file, true);
      toastService.success(`${result.newRows + result.changedRows} ${subject} mapping${result.newRows + result.changedRows === 1 ? "" : "s"} imported.`);
      onImported();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not import the mappings."));
    } finally {
      setBusy(false);
    }
  };

  const canImport = preview !== null && preview.invalidRows === 0 && preview.totalRows > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{ heading: `Import ${subject} mappings` }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: busy },
        primaryButton: preview
          ? { text: "Import", onClick: handleImport, loading: busy, disabled: !canImport }
          : { text: "Check file", onClick: handlePreview, loading: busy, disabled: !file },
      }}
    >
      <div className="sila-root sila-me srec-stack">
        <div className="sila-field">
          <label className="sila-label" htmlFor="spos-import-file">Filled-in template (.xlsx)</label>
          <input
            id="spos-import-file"
            className="sila-input"
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          <span className="sila-help">
            {kind === "OUTLETS" ? "Columns: PosOutletCode, PosOutletName, LocationCode." : "Columns: PosItemCode, PosItemDescription, RecipeCode."}
          </span>
        </div>

        {preview && (
          <>
            <div className="srec-counts">
              {[
                ["Rows", preview.totalRows],
                ["New", preview.newRows],
                ["Changed", preview.changedRows],
                ["Unchanged", preview.unchangedRows],
                ["Invalid", preview.invalidRows],
              ].map(([label, value]) => (
                <div className="sila-meta-item" key={label}>
                  <span className="sila-meta-label">{label}</span>
                  <span className="sila-meta-value">{value}</span>
                </div>
              ))}
            </div>
            {preview.errors.length > 0 ? (
              <div className="sila-alert sila-alert--danger" role="alert">
                <div className="srec-stack">
                  <span className="sila-alert-title">Correct these rows and check the file again; nothing is imported while a row is invalid.</span>
                  <div className="srec-error-list">
                    {preview.errors.map((error) => (
                      <span key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="sila-alert sila-alert--success" role="status">All rows are valid.</div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaPosMappingImport;
