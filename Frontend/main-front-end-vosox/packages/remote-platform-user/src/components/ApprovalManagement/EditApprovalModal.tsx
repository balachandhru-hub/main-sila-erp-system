import React, { useEffect, useState } from "react";
import "./EditApprovalModal.css";
import { FaTimes } from "react-icons/fa";
import { toastService } from "@vosox/shared-ui";
import { updateApprovalFlow } from "./approvalManagementApi";

interface EditApprovalModalProps {
  mappingId: string;
  approvalCode: string;
  approvalName: string;
  order: number;
  onClose: () => void;
  onSaved: (values: { approvalCode: string; approvalName: string }) => void;
}

const EditApprovalModal: React.FC<EditApprovalModalProps> = ({
  mappingId,
  approvalCode: initialCode,
  approvalName: initialName,
  order,
  onClose,
  onSaved,
}) => {
  const [approvalName, setApprovalName] = useState(initialName || "");
  const [errors, setErrors] = useState<{ approvalName?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !saving && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!approvalName.trim()) next.approvalName = "Approval name is required";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      const values = { approvalCode: initialCode, approvalName: approvalName.trim() };
      await updateApprovalFlow(mappingId, { ...values, order });
      toastService.success("Approval updated successfully");
      onSaved(values);
    } catch (err: any) {
      toastService.error(err.message || "Failed to update approval");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="aem-overlay" onClick={() => !saving && onClose()}>
      <form
        className="aem-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="aem-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="aem-header">
          <div>
            <h2 className="aem-title" id="aem-title">Edit Approval</h2>
            <p className="aem-subtitle">Update the approval name.</p>
          </div>
          <button type="button" className="aem-close" onClick={onClose} disabled={saving} aria-label="Close">
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <div className="aem-body">
          <label className="aem-field">
            <span className="aem-label">Approval Name <em aria-hidden="true">*</em></span>
            <input
              className={`aem-input ${errors.approvalName ? "aem-input-error" : ""}`}
              aria-required="true"
              aria-invalid={!!errors.approvalName}
              value={approvalName}
              autoFocus
              onChange={(e) => {
                setApprovalName(e.target.value);
                setErrors((prev) => ({ ...prev, approvalName: undefined }));
              }}
            />
            {errors.approvalName && <span className="aem-error" role="alert">{errors.approvalName}</span>}
          </label>
        </div>

        <div className="aem-footer">
          <button type="button" className="aem-btn aem-btn-secondary sila-btn sila-btn--secondary" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="submit" className="aem-btn aem-btn-primary sila-btn sila-btn--primary" disabled={saving}>
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditApprovalModal;
