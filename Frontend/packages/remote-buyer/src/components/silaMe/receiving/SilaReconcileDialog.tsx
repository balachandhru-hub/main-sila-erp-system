import React, { useState } from "react";
import { Modal, toastService } from "@vosox/shared-ui";
import { reconcileErpPosting, type SilaErpPosting } from "../../../api/silaMe/silaReceivingApi";

interface SilaReconcileDialogProps {
  posting: SilaErpPosting;
  onClose: () => void;
  onReconciled: () => void;
}

/**
 * An UNKNOWN posting: the ERP call ended without a clear answer, so it is not resent automatically. The user checks the
 * ERP and says whether the document is there (with its number) or not (it is sent again).
 */
const SilaReconcileDialog: React.FC<SilaReconcileDialogProps> = ({ posting, onClose, onReconciled }) => {
  const [posted, setPosted] = useState<"yes" | "no" | "">("");
  const [erpReference, setErpReference] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!posted) {
      toastService.error("Choose whether the document exists in the ERP.");
      return;
    }
    setSaving(true);
    try {
      await reconcileErpPosting(posting.id, posted === "yes", posted === "yes" ? erpReference : "");
      toastService.success(posted === "yes" ? `${posting.referenceNumber} marked as posted.` : `${posting.referenceNumber} will be sent again within a minute.`);
      onReconciled();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reconcile the posting.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={saving ? () => undefined : onClose}
      size="md"
      headerProps={{ heading: `Reconcile ${posting.referenceNumber}` }}
      footerProps={{
        primaryButton: { text: "Save", onClick: handleSave, loading: saving, disabled: saving || !posted },
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
      }}
    >
      <div className="sila-root sila-me srcv-stack">
        <p>The ERP gave no clear answer. Look for {posting.referenceNumber} in the ERP{posting.companyCode ? ` (company code ${posting.companyCode})` : ""}, then record what you found.</p>
        {posting.errorMessage && <p className="srcv-error">{posting.errorMessage}</p>}
        <fieldset className="srcv-stack" disabled={saving}>
          <legend className="sila-label">Is the document in the ERP?</legend>
          <label htmlFor="srcv-rec-yes">
            <input id="srcv-rec-yes" type="radio" name="srcv-rec" checked={posted === "yes"} onChange={() => setPosted("yes")} /> Yes, it was posted
          </label>
          <label htmlFor="srcv-rec-no">
            <input id="srcv-rec-no" type="radio" name="srcv-rec" checked={posted === "no"} onChange={() => setPosted("no")} /> No, send it again
          </label>
          {posted === "yes" && (
            <div className="sila-field">
              <label className="sila-label" htmlFor="srcv-rec-ref">ERP document number</label>
              <input id="srcv-rec-ref" className="sila-input" maxLength={100} value={erpReference} onChange={(event) => setErpReference(event.target.value)} />
            </div>
          )}
        </fieldset>
      </div>
    </Modal>
  );
};

export default SilaReconcileDialog;
