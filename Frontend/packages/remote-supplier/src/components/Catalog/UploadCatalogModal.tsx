import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { IconClose, IconUploadCloud, IconUploadCloudLarge, IconCheckCircle, IconFileGeneric } from "./icons";
import { formatFileSize } from "./types";
import { isErrorResponse } from "@vosox/shared-ui";
import { uploadSupplierCatalogFile } from "../../api/supplierApi";

interface UploadCatalogModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUploaded?: () => void;
}

const UploadCatalogModal: React.FC<UploadCatalogModalProps> = ({ isOpen, onClose, onUploaded }) => {
    const [uploadCatalogFiles, setUploadCatalogFiles] = useState<File[]>([]);
    const [isDraggingUploadFiles, setIsDraggingUploadFiles] = useState(false);
    const [uploadingCatalog, setUploadingCatalog] = useState(false);
    const [uploadCatalogError, setUploadCatalogError] = useState<string | null>(null);
    const [uploadCatalogSuccess, setUploadCatalogSuccess] = useState(false);
    const uploadCatalogInputRef = useRef<HTMLInputElement>(null);

    const closeUploadCatalogModal = () => {
        setUploadCatalogFiles([]);
        setUploadCatalogError(null);
        setUploadCatalogSuccess(false);
        onClose();
    };

    const handleUploadCatalogFilesAdd = (files: FileList | File[] | null) => {
        if (!files) return;
        const newFiles = Array.from(files);
        if (newFiles.length === 0) return;
        setUploadCatalogFiles((prev) => [...prev, ...newFiles]);
        setUploadCatalogError(null);
    };

    const handleRemoveUploadCatalogFile = (index: number) => {
        setUploadCatalogFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleUploadCatalogSubmit = async () => {
        if (uploadCatalogFiles.length === 0) {
            setUploadCatalogError("Please add at least one file or image to upload.");
            return;
        }
        setUploadingCatalog(true);
        setUploadCatalogError(null);
        try {
            // Each file is uploaded independently so one failure does not affect the others.
            const results = await Promise.all(uploadCatalogFiles.map((file) => uploadSupplierCatalogFile(file)));
            const failedFiles = uploadCatalogFiles.filter((_, i) => isErrorResponse(results[i]));

            // Refresh the catalog list if at least one file was uploaded.
            if (failedFiles.length < uploadCatalogFiles.length) {
                onUploaded?.();
            }

            if (failedFiles.length === 0) {
                setUploadCatalogSuccess(true);
                setTimeout(() => {
                    closeUploadCatalogModal();
                }, 900);
                return;
            }

            // Keep only the failed files so the user can retry them.
            setUploadCatalogFiles(failedFiles);
            const firstError = results.find(isErrorResponse);
            const failedNames = failedFiles.map((file) => file.name).join(", ");
            setUploadCatalogError(
                `${firstError?.message || "Failed to upload files."} (${failedNames})`
            );
        } catch (error: any) {
            setUploadCatalogError(error?.message || "Failed to upload files. Please try again.");
        } finally {
            setUploadingCatalog(false);
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="pud-modal-overlay" onClick={closeUploadCatalogModal}>
            <div
                className="pud-modal pud-modal-upload"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pud-upload-catalog-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="pud-modal-header">
                    <button type="button" className="pud-modal-close" onClick={closeUploadCatalogModal} title="Close" aria-label="Close">
                        <IconClose />
                    </button>
                    <span className="pud-modal-badge">
                        <IconUploadCloud /> Bulk Upload
                    </span>
                    <h2 className="pud-modal-name" id="pud-upload-catalog-title">Upload Catalog</h2>
                    <div className="pud-modal-meta">
                        <span>Add files or images to your catalog</span>
                    </div>
                </div>

                <div className="pud-modal-body">
                    {uploadCatalogSuccess && (
                        <div className="pud-alert pud-alert-success" role="status">
                            <IconCheckCircle /> Files uploaded successfully!
                        </div>
                    )}
                    {uploadCatalogError && (
                        <div className="pud-alert pud-alert-error" role="alert">{uploadCatalogError}</div>
                    )}

                    <div
                        className={`pud-catalog-dropzone pud-catalog-dropzone-large${isDraggingUploadFiles ? " pud-catalog-dropzone-active" : ""}`}
                        role="button"
                        tabIndex={0}
                        aria-label="Choose files to upload"
                        onClick={() => uploadCatalogInputRef.current?.click()}
                        onKeyDown={(e) => {
                            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                e.preventDefault();
                                uploadCatalogInputRef.current?.click();
                            }
                        }}
                        onDragOver={(e) => { e.preventDefault(); setIsDraggingUploadFiles(true); }}
                        onDragLeave={() => setIsDraggingUploadFiles(false)}
                        onDrop={(e) => {
                            e.preventDefault();
                            setIsDraggingUploadFiles(false);
                            handleUploadCatalogFilesAdd(e.dataTransfer.files);
                        }}
                    >
                        <input
                            ref={uploadCatalogInputRef}
                            type="file"
                            multiple
                            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
                            onChange={(e) => {
                                handleUploadCatalogFilesAdd(e.target.files);
                                e.target.value = "";
                            }}
                        />
                        <div className="pud-catalog-dropzone-icon"><IconUploadCloudLarge /></div>
                        <div className="pud-catalog-dropzone-text">
                            Click to upload or drag & drop files/images here
                        </div>
                        <div className="pud-catalog-dropzone-subtext">
                            Supports images, PDF, Word, Excel and CSV files
                        </div>
                    </div>

                    {uploadCatalogFiles.length > 0 && (
                        <div className="pud-catalog-file-list">
                            {uploadCatalogFiles.map((file, index) => (
                                <div className="pud-catalog-file-item" key={`${file.name}-${index}`}>
                                    {file.type.startsWith("image/") ? (
                                        <img
                                            src={URL.createObjectURL(file)}
                                            alt={file.name}
                                            className="pud-catalog-file-thumb"
                                        />
                                    ) : (
                                        <div className="pud-catalog-file-icon"><IconFileGeneric /></div>
                                    )}
                                    <div className="pud-catalog-file-info">
                                        <div className="pud-catalog-file-name">{file.name}</div>
                                        <div className="pud-catalog-file-size">{formatFileSize(file.size)}</div>
                                    </div>
                                    <button
                                        type="button"
                                        className="pud-catalog-file-remove"
                                        onClick={() => handleRemoveUploadCatalogFile(index)}
                                        title="Remove"
                                        aria-label={`Remove ${file.name}`}
                                    >
                                        <IconClose />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pud-modal-footer">
                    <button type="button" className="pud-btn pud-btn-outline sila-btn sila-btn--secondary" onClick={closeUploadCatalogModal}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="pud-btn pud-btn-message sila-btn sila-btn--primary"
                        disabled={uploadingCatalog || uploadCatalogFiles.length === 0}
                        onClick={handleUploadCatalogSubmit}
                    >
                        {uploadingCatalog ? "Uploading..." : `Upload ${uploadCatalogFiles.length > 0 ? `(${uploadCatalogFiles.length})` : ""}`}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default UploadCatalogModal;
