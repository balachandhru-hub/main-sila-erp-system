import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import {
  POS_INTEGRATION_KINDS,
  POS_SYSTEMS,
  savePosSource,
  type SilaPosSource,
  type SilaPosSourceWrite,
} from "../../../api/silaMe/silaPosMasterApi";
import { errorText, posLabel } from "./posFormat";

interface SilaPosSourceFormProps {
  /** null creates a new source. */
  source: SilaPosSource | null;
  /** The first source always becomes the default. */
  isFirst: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/** Create / edit dialog of a POS source. */
const SilaPosSourceForm: React.FC<SilaPosSourceFormProps> = ({ source, isFirst, onClose, onSaved }) => {
  const [form, setForm] = useState<SilaPosSourceWrite>({
    name: source?.name ?? "",
    posSystem: source?.posSystem ?? "OPERA",
    integrationKind: source?.integrationKind ?? "FILE",
    isDefault: source?.isDefault ?? isFirst,
  });
  const [saving, setSaving] = useState(false);

  const setField = <K extends keyof SilaPosSourceWrite>(field: K, value: SilaPosSourceWrite[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  const handleSave = async () => {
    if (!form.name.trim()) {
      toastService.error("Enter a name for the POS source.");
      return;
    }
    setSaving(true);
    try {
      await savePosSource(source?.id ?? null, { ...form, name: form.name.trim() });
      toastService.success(source ? "POS source updated." : "POS source created.");
      onSaved();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not save the POS source."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="md"
      headerProps={{ heading: source ? "Edit POS source" : "New POS source" }}
      footerProps={{
        secondaryButton: { text: "Cancel", variant: "secondary", onClick: onClose, disabled: saving },
        primaryButton: { text: source ? "Save" : "Create", onClick: handleSave, loading: saving },
      }}
    >
      <form
        className="sila-root sila-me"
        onSubmit={(event) => {
          event.preventDefault();
          handleSave();
        }}
      >
        <div className="sila-form-grid">
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-source-name">Name<span className="sila-required">*</span></label>
            <input
              id="spos-source-name"
              className="sila-input"
              maxLength={200}
              value={form.name}
              onChange={(event) => setField("name", event.target.value)}
            />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-source-system">POS system<span className="sila-required">*</span></label>
            <select id="spos-source-system" className="sila-select" value={form.posSystem} onChange={(event) => setField("posSystem", event.target.value)}>
              {POS_SYSTEMS.map((system) => (
                <option key={system} value={system}>{posLabel(system)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="spos-source-kind">Integration<span className="sila-required">*</span></label>
            <select
              id="spos-source-kind"
              className="sila-select"
              value={form.integrationKind}
              onChange={(event) => setField("integrationKind", event.target.value)}
            >
              {POS_INTEGRATION_KINDS.map((kind) => (
                <option key={kind} value={kind}>{kind === "FILE" ? "File upload" : "POS API (Integration)"}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-choice" htmlFor="spos-source-default">
              <input
                id="spos-source-default"
                type="checkbox"
                checked={form.isDefault}
                disabled={isFirst || Boolean(source?.isDefault)}
                onChange={(event) => setField("isDefault", event.target.checked)}
              />
              Default source
            </label>
            <span className="sila-help">Used for uploads without a source and for the POS API pull.</span>
          </div>
        </div>
      </form>
    </Modal>
  );
};

export default SilaPosSourceForm;
