import React from "react";
import { createPortal } from "react-dom";
import { Dropdown } from "@vosox/shared-ui";
import type { DropdownValue } from "@vosox/shared-ui";
import type { useCreateCatalogForm } from "../../hooks/useCreateCatalogForm";
import { IconClose, NavIconCatalog, IconCheckCircle, IconUploadCloudLarge, IconPlusCircle } from "./icons";

const toDropdownValue = (value: string): DropdownValue | null =>
    value ? { name: value, value } : null;

const toIdTitleDropdownValue = (id: string, title: string): DropdownValue | null =>
    id ? { name: title || id, value: id } : null;

// The Dropdown's search box is a plain text input; inside a <form>, Enter on it
// would otherwise submit the form instead of just filtering the option list.
const preventEnterSubmit = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault();
};

interface CreateCatalogModalProps {
    isOpen: boolean;
    form: ReturnType<typeof useCreateCatalogForm>;
}

const CreateCatalogModal: React.FC<CreateCatalogModalProps> = ({ isOpen, form }) => {
    const {
        catalogForm,
        catalogFiles,
        catalogFilePreviews,
        isDraggingCatalogFile,
        setIsDraggingCatalogFile,
        creatingCatalog,
        createCatalogError,
        createCatalogSuccess,
        catalogFileInputRef,
        loadCatalogTypeOptions,
        loadCurrencyOptions,
        loadUnitOptions,
        loadSegmentOptions,
        loadFamilyOptions,
        loadClassOptions,
        loadCommodityOptions,
        updateCatalogField,
        handleSegmentChange,
        handleFamilyChange,
        handleClassChange,
        handleCommodityChange,
        isNonCatalogType,
        closeCreateCatalogModal,
        handleCatalogFilesAdd,
        handleRemoveCatalogFile,
        handleCreateCatalogSubmit,
    } = form;

    if (!isOpen) return null;

    return createPortal(
        <div className="pud-modal-overlay" onClick={closeCreateCatalogModal}>
            <div
                className="pud-modal pud-modal-catalog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="pud-create-catalog-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="pud-modal-header">
                    <button type="button" className="pud-modal-close" onClick={closeCreateCatalogModal} title="Close" aria-label="Close">
                        <IconClose />
                    </button>
                    <span className="pud-modal-badge">
                        <NavIconCatalog /> New Catalog Item
                    </span>
                    <h2 className="pud-modal-name" id="pud-create-catalog-title">Create Catalog</h2>
                    <div className="pud-modal-meta">
                        <span>Add a product or service to your catalog</span>
                    </div>
                </div>

                <form onSubmit={handleCreateCatalogSubmit} className="pud-modal-form">
                    <div className="pud-modal-body">
                        {createCatalogSuccess && (
                            <div className="pud-alert pud-alert-success" role="status">
                                <IconCheckCircle /> Catalog created successfully!
                            </div>
                        )}
                        {createCatalogError && (
                            <div className="pud-alert pud-alert-error" role="alert">{createCatalogError}</div>
                        )}

                        <div className="pud-catalog-form-grid">
                            <div className="pud-catalog-form-section">
                                <span className="pud-catalog-form-section-title">Basic Details</span>
                            </div>

                            <div className="pud-catalog-form-field pud-catalog-form-full">
                                <label className="pud-catalog-form-label" htmlFor="catalog-catalog-name">Catalog Name<span className="sila-required" aria-hidden="true">*</span></label>
                                <input
                                    id="catalog-catalog-name"
                                    type="text"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.catalogName}
                                    onChange={(e) => updateCatalogField("catalogName", e.target.value)}
                                    placeholder="e.g. Ergonomic Office Chair"
                                    required
                                />
                            </div>

                            <div className="pud-catalog-form-field pud-catalog-form-full">
                                <label className="pud-catalog-form-label" htmlFor="catalog-description">Description</label>
                                <textarea
                                    id="catalog-description"
                                    className="pud-catalog-form-textarea"
                                    value={catalogForm.description}
                                    onChange={(e) => updateCatalogField("description", e.target.value)}
                                    placeholder="Briefly describe this catalog item..."
                                    rows={3}
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-price">Price</label>
                                <input
                                    id="catalog-price"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.price}
                                    onChange={(e) => updateCatalogField("price", e.target.value)}
                                    placeholder="0.00"
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-sku">SKU</label>
                                <input
                                    id="catalog-sku"
                                    type="text"
                                    maxLength={100}
                                    className="pud-catalog-form-input"
                                    value={catalogForm.sku}
                                    onChange={(e) => updateCatalogField("sku", e.target.value)}
                                    placeholder="Supplier SKU"
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-available-stock">Available Stock</label>
                                <input
                                    id="catalog-available-stock"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.availableStock}
                                    onChange={(e) => updateCatalogField("availableStock", e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-discount">Discount %</label>
                                <input
                                    id="catalog-discount"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    max="100"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.discountPercent}
                                    onChange={(e) => updateCatalogField("discountPercent", e.target.value)}
                                    placeholder="0"
                                />
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Currency"
                                    placeholder="Select currency"
                                    isClearable
                                    isAsync
                                    loadOptions={loadCurrencyOptions}
                                    value={toDropdownValue(catalogForm.currency)}
                                    onChange={(val) => updateCatalogField("currency", val?.value ?? "")}
                                />
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Unit of Measure"
                                    placeholder="Select unit of measure"
                                    isClearable
                                    isAsync
                                    loadOptions={loadUnitOptions}
                                    value={toDropdownValue(catalogForm.unitOfMeasure)}
                                    onChange={(val) => updateCatalogField("unitOfMeasure", val?.value ?? "")}
                                />
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Catalog Type"
                                    placeholder="Select catalog type"
                                    isClearable
                                    isAsync
                                    loadOptions={loadCatalogTypeOptions}
                                    value={toDropdownValue(catalogForm.catalogType)}
                                    onChange={(val) => updateCatalogField("catalogType", val?.value ?? "")}
                                />
                            </div>

                            <div className="pud-catalog-form-section">
                                <span className="pud-catalog-form-section-title">Classification</span>
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Segment"
                                    placeholder="Select segment"
                                    isRequired
                                    isClearable
                                    isAsync
                                    loadOptions={loadSegmentOptions}
                                    value={toIdTitleDropdownValue(catalogForm.segment, catalogForm.segmentTitle)}
                                    onChange={handleSegmentChange}
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-segment-title">Segment Title</label>
                                <input
                                    id="catalog-segment-title"
                                    type="text"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.segmentTitle}
                                    readOnly
                                    placeholder="Auto-filled when segment is selected"
                                />
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Family"
                                    placeholder={!catalogForm.segment ? "Select a segment first" : "Select family"}
                                    isRequired
                                    isClearable
                                    isDisable={!catalogForm.segment}
                                    isAsync
                                    loadOptions={loadFamilyOptions}
                                    cacheUniques={[catalogForm.segment]}
                                    value={toIdTitleDropdownValue(catalogForm.family, catalogForm.familyTitle)}
                                    onChange={handleFamilyChange}
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-family-title">Family Title</label>
                                <input
                                    id="catalog-family-title"
                                    type="text"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.familyTitle}
                                    readOnly
                                    placeholder="Auto-filled when family is selected"
                                />
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Class"
                                    placeholder={!catalogForm.family ? "Select a family first" : "Select class"}
                                    isRequired
                                    isClearable
                                    isDisable={!catalogForm.family}
                                    isAsync
                                    loadOptions={loadClassOptions}
                                    cacheUniques={[catalogForm.family]}
                                    value={toIdTitleDropdownValue(catalogForm.class, catalogForm.classTitle)}
                                    onChange={handleClassChange}
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-class-title">Class Title</label>
                                <input
                                    id="catalog-class-title"
                                    type="text"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.classTitle}
                                    readOnly
                                    placeholder="Auto-filled when class is selected"
                                />
                            </div>

                            <div className="pud-catalog-form-field" onKeyDown={preventEnterSubmit}>
                                <Dropdown
                                    label="Commodity"
                                    placeholder={!catalogForm.class ? "Select a class first" : "Select commodity"}
                                    isRequired
                                    isClearable
                                    isDisable={!catalogForm.class}
                                    isAsync
                                    loadOptions={loadCommodityOptions}
                                    cacheUniques={[catalogForm.class]}
                                    value={toIdTitleDropdownValue(catalogForm.commodity, catalogForm.commodityTitle)}
                                    onChange={handleCommodityChange}
                                />
                            </div>

                            <div className="pud-catalog-form-field">
                                <label className="pud-catalog-form-label" htmlFor="catalog-commodity-title">Commodity Title</label>
                                <input
                                    id="catalog-commodity-title"
                                    type="text"
                                    className="pud-catalog-form-input"
                                    value={catalogForm.commodityTitle}
                                    readOnly
                                    placeholder="Auto-filled when commodity is selected"
                                />
                            </div>

                            {isNonCatalogType && (
                                <>
                                    <div className="pud-catalog-form-section">
                                        <span className="pud-catalog-form-section-title">PunchOut</span>
                                    </div>

                                    <div className="pud-catalog-form-field pud-catalog-checkbox-field pud-catalog-form-full">
                                        <input
                                            type="checkbox"
                                            id="isPunchOut"
                                            checked={catalogForm.isPunchOut}
                                            onChange={(e) => updateCatalogField("isPunchOut", e.target.checked)}
                                        />
                                        <label htmlFor="isPunchOut">This is a PunchOut catalog item</label>
                                    </div>

                                    {catalogForm.isPunchOut && (
                                        <div className="pud-catalog-form-field pud-catalog-form-full">
                                            <label className="pud-catalog-form-label" htmlFor="catalog-punchout-url">PunchOut URL<span className="sila-required" aria-hidden="true">*</span></label>
                                            <input
                                                id="catalog-punchout-url"
                                                type="url"
                                                className="pud-catalog-form-input"
                                                value={catalogForm.punchOutUrl}
                                                onChange={(e) => updateCatalogField("punchOutUrl", e.target.value)}
                                                placeholder="https://supplier.example.com/punchout"
                                                required={catalogForm.isPunchOut}
                                            />
                                        </div>
                                    )}
                                </>
                            )}

                            <div className="pud-catalog-form-section">
                                <span className="pud-catalog-form-section-title">Attachment</span>
                            </div>

                            <div className="pud-catalog-form-field pud-catalog-form-full">
                                <span className="pud-catalog-form-label" id="catalog-upload-images-label">Upload Images<span className="sila-required" aria-hidden="true">*</span></span>
                                <div
                                    className={`pud-catalog-dropzone${isDraggingCatalogFile ? " pud-catalog-dropzone-active" : ""}`}
                                    role="button"
                                    tabIndex={0}
                                    aria-labelledby="catalog-upload-images-label"
                                    onClick={() => catalogFileInputRef.current?.click()}
                                    onKeyDown={(e) => {
                                        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                                            e.preventDefault();
                                            catalogFileInputRef.current?.click();
                                        }
                                    }}
                                    onDragOver={(e) => { e.preventDefault(); setIsDraggingCatalogFile(true); }}
                                    onDragLeave={() => setIsDraggingCatalogFile(false)}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        setIsDraggingCatalogFile(false);
                                        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                                            handleCatalogFilesAdd(e.dataTransfer.files);
                                        }
                                    }}
                                >
                                    <input
                                        ref={catalogFileInputRef}
                                        type="file"
                                        accept="image/*"
                                        multiple
                                        onChange={(e) => {
                                            handleCatalogFilesAdd(e.target.files);
                                            e.target.value = "";
                                        }}
                                    />
                                    {catalogFilePreviews.length > 0 ? (
                                        <div className="pud-file">
                                            {catalogFilePreviews.map((preview, index) => (
                                                <div key={index} className="map" onClick={(e) => e.stopPropagation()}>
                                                    <img
                                                        src={preview}
                                                        alt={`Catalog preview ${index + 1}`}
                                                        className="pud-catalog-dropzone-preview"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveCatalogFile(index)}
                                                        title="Remove image"
                                                        aria-label={`Remove image ${index + 1}`}
                                                        className="pud-file-button"
                                                    >
                                                        <IconClose className="closeIcon" />
                                                    </button>
                                                </div>
                                            ))}
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); catalogFileInputRef.current?.click(); }}
                                                className="pud-add-img"
                                                title="Add more images"
                                                aria-label="Add more images"
                                            >
                                                <IconPlusCircle className="iconPlus" />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="pud-catalog-dropzone-icon"><IconUploadCloudLarge /></div>
                                    )}
                                    <div className="pud-catalog-dropzone-text">
                                        {catalogFiles.length > 0
                                            ? `${catalogFiles.length} image${catalogFiles.length > 1 ? "s" : ""} selected`
                                            : "Click to upload or drag & drop images here"}
                                    </div>
                                    <div className="pud-catalog-dropzone-subtext">
                                        PNG, JPG, GIF or WEBP — you can select multiple images
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pud-modal-footer">
                        <button type="button" className="pud-btn pud-btn-outline sila-btn sila-btn--secondary" onClick={closeCreateCatalogModal}>
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="pud-btn pud-btn-message sila-btn sila-btn--primary"
                            disabled={creatingCatalog || catalogFiles.length === 0}
                        >
                            {creatingCatalog ? "Saving..." : "Save Catalog"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
};

export default CreateCatalogModal;
