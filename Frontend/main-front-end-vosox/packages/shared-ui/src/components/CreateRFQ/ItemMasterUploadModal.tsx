import React, { useRef, useState } from "react";
import { toastService } from "../../services/toastservice";
import Dropdown from "../DropDown/DropDown";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "../DropDown/DropDown.types";
import { FaCloudUploadAlt, FaFileAlt, FaTimes } from "react-icons/fa";
import "./ItemMasterModal.css";
import type { ItemMasterUploadModalApi, MasterApprovalFlowDto, ItemMasterUploadResultDto } from "./types";

// Page size used by the async (paginated) Approval Flow Dropdown
const APPROVAL_FLOW_PAGE_SIZE = 40;

interface ItemMasterUploadModalProps {
  isOpen: boolean;
  onClose: () => void;  
  buyerId: string;
  organizationId: string;
  api: ItemMasterUploadModalApi;
  onSuccess?: () => void;
}

const clearFieldError = (
  setErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>,
  field: string
) => {
  setErrors((prev) => {
    if (!(field in prev)) return prev;
    const next = { ...prev };
    delete next[field];
    return next;
  });
};

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      resolve(result.split(",")[1] || result);
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });

const ItemMasterUploadModal: React.FC<ItemMasterUploadModalProps> = ({
  isOpen,
  onClose,
  buyerId,
  organizationId,
  api,
  onSuccess,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [comment, setComment] = useState("");
  const [selectedApprovalFlow, setSelectedApprovalFlow] = useState<DropdownValue | null>(null);
  const approvalFlowId = selectedApprovalFlow?.value || "";

  const [approvalFlowError, setApprovalFlowError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadResult, setUploadResult] = useState<ItemMasterUploadResultDto | null>(null);

  if (!isOpen) {
    return null;
  }

  // ---- Async paginated loader for the Approval Flow Dropdown (server has no search param, so search client-side) ----
  const loadApprovalFlowOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
    if (!buyerId) {
      return { options: [], hasMore: false };
    }
    const toOption = (flow: MasterApprovalFlowDto) => ({
      name: `${flow.approvalCode} - ${flow.approvalName}`,
      value: flow.id,
    });
    const searchTerm = search.trim().toLowerCase();

    try {
      if (searchTerm) {
        const matches: MasterApprovalFlowDto[] = [];
        let index = 0;
        let flows: MasterApprovalFlowDto[];
        do {
          flows = await api.getMasterApprovalFlows(buyerId, index, APPROVAL_FLOW_PAGE_SIZE);
          matches.push(...flows.filter((flow) => toOption(flow).name.toLowerCase().includes(searchTerm)));
          index += flows.length;
        } while (flows.length === APPROVAL_FLOW_PAGE_SIZE);
        setApprovalFlowError("");
        return { options: matches.map(toOption), hasMore: false };
      }

      const flows = await api.getMasterApprovalFlows(
        buyerId,
        page * APPROVAL_FLOW_PAGE_SIZE,
        APPROVAL_FLOW_PAGE_SIZE
      );
      setApprovalFlowError("");
      return {
        options: flows.map(toOption),
        hasMore: flows.length === APPROVAL_FLOW_PAGE_SIZE,
      };
    } catch (error: any) {
      setApprovalFlowError(error?.message || "Failed to load approval flows.");
      return { options: [], hasMore: false };
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setTitle("");
    setComment("");
    setSelectedApprovalFlow(null);
    setErrors({});
    setUploadResult(null);
  };

  const handleClose = () => {
    if (isSubmitting) return;
    resetForm();
    onClose();
  };

  const handleFileChosen = (files: FileList | null) => {
    const file = files?.[0] || null;
    setSelectedFile(file);
    clearFieldError(setErrors, "file");
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedFile) newErrors.file = "Please choose a file to upload";
    if (!title.trim()) newErrors.title = "Please enter a title";
    if (!approvalFlowId) newErrors.approvalFlowId = "Please select an approval flow";

    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!buyerId || !organizationId) {
      toastService.error("Buyer profile could not be loaded.");
      return;
    }

    setIsSubmitting(true);
    setUploadResult(null);

    try {
      const fileBytes = await readFileAsBase64(selectedFile as File);

      const result = await api.uploadItemMasterFile({
        document: {
          entityType: "BUYER",
          entityId: buyerId,
          assetType: "EXCEL_MATERIAL_MASTER",
          fileBytes,
          fileName: (selectedFile as File).name,
          contentType: (selectedFile as File).type,
          isSingletonAsset: false,
        },
        organizationId,
        buyerId,
        title: title.trim(),
        approvalFlowId,
        comment: comment.trim(),
      });

      const hasErrors = (result.failedUploads || 0) > 0 || (result.errors?.length || 0) > 0;

      if (hasErrors) {
        // Keep the modal open so the buyer can see which rows failed before dismissing.
        setUploadResult(result);
        toastService.warning(
          `${result.successfulUploads} of ${result.totalRows} rows uploaded. ${result.failedUploads} failed - see details below.`
        );
      } else {
        toastService.success(`${result.successfulUploads} of ${result.totalRows} rows uploaded successfully.`);
        resetForm();
        onClose();
      }

      onSuccess?.();
    } catch (error: any) {
      toastService.error(error?.message || "Failed to upload item master file.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="item-master-modal-overlay" onClick={handleClose}>
      <div
        className="item-master-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-master-upload-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="item-master-modal-header">
          <div>
            <h2 className="item-master-modal-title" id="item-master-upload-modal-title">
              Upload Item Master
            </h2>

            <p className="item-master-modal-subtitle">
              Bulk-create item masters for your organization from a spreadsheet.
            </p>
          </div>

          <button
            type="button"
            className="item-master-modal-close"
            onClick={handleClose}
            disabled={isSubmitting}
            aria-label="Close"
          >
            <FaTimes aria-hidden="true" />
          </button>
        </div>

        <form className="item-master-modal-form" onSubmit={handleSubmit}>
          <div className="item-master-modal-body">
            {/* File */}
            <div className="item-master-field">
              <label htmlFor="item-master-upload-title">
                File <span className="sila-required" aria-hidden="true">*</span>
              </label>

              {selectedFile ? (
                <ul className="sila-file-list">
                  <li className="sila-file">
                    <span className="sila-file-icon" aria-hidden="true"><FaFileAlt /></span>
                    <div className="item-master-file-text">
                      <div className="sila-file-name" title={selectedFile.name}>{selectedFile.name}</div>
                      <div className="sila-file-meta">{(selectedFile.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button
                      type="button"
                      className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                      onClick={() => handleFileChosen(null)}
                      disabled={isSubmitting}
                      aria-label="Remove selected file"
                    >
                      <FaTimes aria-hidden="true" />
                    </button>
                  </li>
                </ul>
              ) : (
                <div
                  className={`sila-dropzone${errors.file ? " item-master-input-error" : ""}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      fileInputRef.current?.click();
                    }
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileChosen(e.dataTransfer.files);
                  }}
                >
                  <FaCloudUploadAlt aria-hidden="true" />
                  <span>Click to select a file or drag and drop here</span>
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xls,.xlsx"
                className="item-master-modal-hidden-input"
                tabIndex={-1}
                aria-hidden="true"
                onChange={(e) => {
                  handleFileChosen(e.target.files);
                  e.target.value = "";
                }}
              />

              {errors.file && <div className="item-master-error">{errors.file}</div>}
            </div>

            {/* Title */}
            <div className="item-master-field">
              <label htmlFor="item-master-upload-title">
                Title <span className="sila-required" aria-hidden="true">*</span>
              </label>

              <input
                id="item-master-upload-title"
                type="text"
                placeholder="Enter a title for this upload"
                value={title}
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? "item-master-upload-error-title" : undefined}
                className={errors.title ? "item-master-input-error" : ""}
                onChange={(e) => {
                  setTitle(e.target.value);
                  clearFieldError(setErrors, "title");
                }}
              />

              {errors.title && (
                <div className="item-master-error" id="item-master-upload-error-title">
                  {errors.title}
                </div>
              )}
            </div>

            {/* Approval Flow */}
            <div className="item-master-field">
              <Dropdown
                label="Approval flow"
                isRequired
                placeholder="Select an approval flow"
                isAsync
                loadOptions={loadApprovalFlowOptions}
                cacheUniques={[buyerId]}
                value={selectedApprovalFlow}
                onChange={(val) => {
                  setSelectedApprovalFlow(val);
                  clearFieldError(setErrors, "approvalFlowId");
                }}
                error={errors.approvalFlowId}
              />

              {approvalFlowError && (
                <div className="item-master-field-hint item-master-field-hint-error">
                  {approvalFlowError}
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="item-master-field">
              <label htmlFor="item-master-upload-comment">Comment</label>

              <textarea
                id="item-master-upload-comment"
                rows={3}
                placeholder="Add comments or notes (optional)"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
            </div>

            {uploadResult && (
              <div className="sila-alert sila-alert--warning" role="status">
                <div>
                  <p className="item-master-similarity-title">
                    {uploadResult.successfulUploads} of {uploadResult.totalRows} rows uploaded successfully
                    {uploadResult.failedUploads > 0 ? `, ${uploadResult.failedUploads} failed.` : "."}
                  </p>

                  {uploadResult.errors?.length > 0 && (
                    <ul className="item-master-similarity-list">
                      {uploadResult.errors.map((err, idx) => (
                        <li key={idx}>
                          <span className="item-master-similarity-desc">{err}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="item-master-modal-footer">
            <button
              type="button"
              className="item-master-cancel-btn"
              onClick={handleClose}
              disabled={isSubmitting}
            >
              {uploadResult ? "Close" : "Cancel"}
            </button>

            {!uploadResult && (
              <button type="submit" className="item-master-create-btn" disabled={isSubmitting}>
                {isSubmitting ? "Uploading..." : "Upload"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default ItemMasterUploadModal;
