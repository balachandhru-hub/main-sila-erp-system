import React, { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Catalog.css";
import { useNetworkAdminAuthStore } from "../store/useAuthStore";
import { 
  createSupplierCatalog, 
  fetchUnits, 
  fetchSupplierCatalogDetail,
  fetchSupplierCatalog,
  type UnitItem,
  type CatalogDetailResponseItem,
  type SupplierCatalogListItem,
} from "../../../remote-supplier/src/api/supplierApi";
import type { CatalogAssetDto, CatalogDetailDto } from "../../../remote-supplier/src/dto/supplierDto";
import { fetchMetadataReferenceList } from "../../../remote-supplier/src/api/supplierApi"
import { EmptyState, Loader, isErrorResponse } from "@vosox/shared-ui";
import { FaArrowLeft, FaPlus } from "react-icons/fa";

/* ============================== Types ============================== */

export interface CatalogItem {
    source: "created" | "uploaded";
    catalogName: string;
    description: string;
    price: number;
    unitOfMeasure: string;
    catalogType: string;
    segment: number;
    segmentTitle: string;
    family: number;
    familyTitle: string;
    commodity: number;
    commodityTitle: string;
    class: number;
    classTitle: string;
    isPunchOut: boolean;
    punchOutUrl: string;
    fileName?: string;
    filePreview?: string | null;
    fileType?: string;
    addedAt: string;
    id?: string;
}

const emptyCatalogForm = {
    catalogName: "",
    description: "",
    price: "",
    unitOfMeasure: "",
    catalogType: "",
    segment: "",
    segmentTitle: "",
    family: "",
    familyTitle: "",
    commodity: "",
    commodityTitle: "",
    class: "",
    classTitle: "",
    isPunchOut: false,
    punchOutUrl: "",
};

type CatalogFormState = typeof emptyCatalogForm;


/* ============================== Helpers ============================== */

const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatCatalogDate = (iso: string) => {
    try {
        return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
        return "";
    }
};

// Converts a File to a raw base64 string (strips the "data:...;base64," prefix)
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = (reader.result as string).split(',')[1];
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
    });
};

/* ============================== Icons ============================== */

const NavIconCatalog = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
        <circle cx="7.5" cy="7.5" r="1.5" fill="currentColor" stroke="none" />
    </svg>
);

const IconChevronRight = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const IconPlusCircle = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="16" />
        <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
);

const IconUploadCloud = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M16 16.5v.01" />
        <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 1 0 6 18h11.5z" />
        <path d="M12 12v7" />
        <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
    </svg>
);

const IconUploadCloudLarge = () => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.78A6 6 0 1 0 6 18h11.5z" />
        <path d="M12 12v7" />
        <path d="m9.5 14.5 2.5-2.5 2.5 2.5" />
    </svg>
);

const IconGrid = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const IconGridLarge = () => (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const IconClose = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const IconCheckCircle = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M20 6 9 17l-5-5" />
    </svg>
);

const IconTrash = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const IconFileGeneric = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6" />
    </svg>
);

/* ============================== Component ============================== */

interface CatalogProps {
    /** Called when "Show Catalogs" is clicked, so the parent dashboard can
     *  switch its main content area to the full catalog list view — the
     *  same pattern BuyerDashboard uses for its other sidebar nav items. */
    onShowCatalogList?: () => void;
    /** Called when the user leaves the full catalog list view. */
    onCloseCatalogList?: () => void;
    /** DOM node (rendered by the parent, inside the main content area) that
     *  the full catalog list view is portaled into. Null/undefined while
     *  the view isn't active. */
    fullViewContainer?: HTMLDivElement | null;
}

const Catalog: React.FC<CatalogProps> = ({ onShowCatalogList, onCloseCatalogList, fullViewContainer }) => {
    // ---- Sidebar expansion + modal visibility ----
    const [isCatalogExpanded, setIsCatalogExpanded] = useState(false);
    const [showCreateCatalogModal, setShowCreateCatalogModal] = useState(false);
    const [showUploadCatalogModal, setShowUploadCatalogModal] = useState(false);
    const [showCatalogListModal, setShowCatalogListModal] = useState(false);
    const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);
    const [loadingCatalogs, setLoadingCatalogs] = useState(true);
    const [catalogsError, setCatalogsError] = useState<string | null>(null);

    // ---- Catalog Detail Modal State ----
    const [selectedCatalogForDetail, setSelectedCatalogForDetail] = useState<CatalogDetailResponseItem | null>(null);
    const [loadingCatalogDetail, setLoadingCatalogDetail] = useState(false);
    const [catalogDetailError, setCatalogDetailError] = useState<string | null>(null);

    // ---- Create Catalog form state ----
    const [catalogForm, setCatalogForm] = useState<CatalogFormState>(emptyCatalogForm);
    const [catalogFile, setCatalogFile] = useState<File | null>(null);
    const [catalogFilePreview, setCatalogFilePreview] = useState<string | null>(null);
    const [isDraggingCatalogFile, setIsDraggingCatalogFile] = useState(false);
    const [creatingCatalog, setCreatingCatalog] = useState(false);
    const [createCatalogError, setCreateCatalogError] = useState<string | null>(null);
    const [createCatalogSuccess, setCreateCatalogSuccess] = useState(false);
    const catalogFileInputRef = useRef<HTMLInputElement>(null);
    const [catalogTypeOptions, setCatalogTypeOptions] = useState<Array<{ id: string; key: string }>>([]);
    
    const loadCatalogTypes = async () => {
        const types = await fetchMetadataReferenceList(['CATALOG_TYPE']);
        if (Array.isArray(types)) {
            setCatalogTypeOptions(types);
        }
    };

    const updateCatalogField = <K extends keyof CatalogFormState>(field: K, value: CatalogFormState[K]) => {
        setCatalogForm((prev) => ({ ...prev, [field]: value }));
    };

    // ---- Upload Catalog (bulk file/image upload) state ----
    const [uploadCatalogFiles, setUploadCatalogFiles] = useState<File[]>([]);
    const [isDraggingUploadFiles, setIsDraggingUploadFiles] = useState(false);
    const [uploadingCatalog, setUploadingCatalog] = useState(false);
    const [uploadCatalogError, setUploadCatalogError] = useState<string | null>(null);
    const [uploadCatalogSuccess, setUploadCatalogSuccess] = useState(false);
    const uploadCatalogInputRef = useRef<HTMLInputElement>(null);

    // ---- Load catalogs from API on mount ----
    useEffect(() => {
        const loadCatalogsFromAPI = async () => {
            setLoadingCatalogs(true);
            setCatalogsError(null);
            try {
                const response = await fetchSupplierCatalog();

                // Check if error response
                if (isErrorResponse(response)) {
                    setCatalogsError(response.description || response.message || 'Failed to load catalogs.');
                    setCatalogItems([]);
                    setLoadingCatalogs(false);
                    return;
                }

                // Convert API response to CatalogItem format
                const items: CatalogItem[] = response.map((catalog: SupplierCatalogListItem) => ({
                    source: "created",
                    id: catalog.id,
                    catalogName: catalog.catalogName,
                    description: catalog.description,
                    price: catalog.price,
                    unitOfMeasure: catalog.unitOfMeasure,
                    catalogType: catalog.catalogType,
                    segment: catalog.segment,
                    segmentTitle: catalog.segmentTitle,
                    family: catalog.family,
                    familyTitle: catalog.familyTitle,
                    commodity: catalog.commodity,
                    commodityTitle: catalog.commodityTitle,
                    class: catalog.class,
                    classTitle: catalog.classTitle,
                    isPunchOut: catalog.isPunchOut,
                    punchOutUrl: catalog.punchOutUrl,
                    addedAt: new Date().toISOString(),
                }));

                setCatalogItems(items);
            } catch (error: any) {
                setCatalogsError(error.message || 'Failed to load catalogs.');
            } finally {
                setLoadingCatalogs(false);
            }
        };

        loadCatalogsFromAPI();
    }, []);

    const closeCreateCatalogModal = () => {
        setShowCreateCatalogModal(false);
        setCatalogForm(emptyCatalogForm);
        setCatalogFile(null);
        setCatalogFilePreview(null);
        setCreateCatalogError(null);
        setCreateCatalogSuccess(false);
    };

    const handleCatalogFileSelect = (file: File | null) => {
        setCatalogFile(file);
        if (file && file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => setCatalogFilePreview(reader.result as string);
            reader.readAsDataURL(file);
        } else {
            setCatalogFilePreview(null);
        }
    };

    const handleCreateCatalogSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!catalogForm.catalogName.trim()) {
            setCreateCatalogError("Catalog name is required.");
            return;
        }
        if (catalogForm.isPunchOut && !catalogForm.punchOutUrl.trim()) {
            setCreateCatalogError("PunchOut URL is required when PunchOut is enabled.");
            return;
        }
        setCreatingCatalog(true);
        setCreateCatalogError(null);
        try {
            const organizationId =
                useNetworkAdminAuthStore.getState().currentUser?.organizationId ||  "";

            if (!organizationId) {
                throw new Error("Organization ID not found. Please log in again.");
            }

            const entityTypesRaw = await fetchMetadataReferenceList(['ENTITY_TYPE']);
            const entityTypes = Array.isArray(entityTypesRaw) ? entityTypesRaw : [];
            const supplierEntityId = entityTypes.find((e) => e.key === 'SUPPLIER')?.id || '59476530-3c10-438b-b3b3-9db9e96e8d93';
            const entityType = entityTypes.find((e) => e.key === 'SUPPLIER')?.key || 'SUPPLIER';
            let assets: CatalogAssetDto[] = [];
            if (catalogFile) {
                const fileBytes = await fileToBase64(catalogFile);
                assets = [
                    {
                        entityType: entityType,
                        entityId: supplierEntityId,
                        assetType: "CATALOG_ATTACHMENT",
                        fileBytes: fileBytes,
                        fileName: catalogFile.name,
                        contentType: catalogFile.type,
                        // Never a singleton: that would deactivate files this catalog still links to.
                        isSingletonAsset: false,
                    },
                ];
            }

            const catalogPayload: CatalogDetailDto = {
                catalogName: catalogForm.catalogName.trim(),
                description: catalogForm.description.trim(),
                price: Number(catalogForm.price) || 0,
                unitOfMeasure: catalogForm.unitOfMeasure,
                catalogType: catalogForm.catalogType.trim(),
                segment: Number(catalogForm.segment) || 0,
                segmentTitle: catalogForm.segmentTitle.trim(),
                family: Number(catalogForm.family) || 0,
                familyTitle: catalogForm.familyTitle.trim(),
                commodity: Number(catalogForm.commodity) || 0,
                commodityTitle: catalogForm.commodityTitle.trim(),
                class: Number(catalogForm.class) || 0,
                classTitle: catalogForm.classTitle.trim(),
                isPunchOut: catalogForm.isPunchOut,
                punchOutUrl: catalogForm.punchOutUrl.trim(),
                assets,
            };

            await createSupplierCatalog({
                organizationId,
                catalog: catalogPayload,
            });

            // Reload catalogs from API after creating
            const updatedResponse = await fetchSupplierCatalog();
            if (!isErrorResponse(updatedResponse)) {
                const items: CatalogItem[] = updatedResponse.map((catalog: SupplierCatalogListItem) => ({
                    source: "created",
                    id: catalog.id,
                    catalogName: catalog.catalogName,
                    description: catalog.description,
                    price: catalog.price,
                    unitOfMeasure: catalog.unitOfMeasure,
                    catalogType: catalog.catalogType,
                    segment: catalog.segment,
                    segmentTitle: catalog.segmentTitle,
                    family: catalog.family,
                    familyTitle: catalog.familyTitle,
                    commodity: catalog.commodity,
                    commodityTitle: catalog.commodityTitle,
                    class: catalog.class,
                    classTitle: catalog.classTitle,
                    isPunchOut: catalog.isPunchOut,
                    punchOutUrl: catalog.punchOutUrl,
                    addedAt: new Date().toISOString(),
                }));
                setCatalogItems(items);
            }

            setCreateCatalogSuccess(true);
            setTimeout(closeCreateCatalogModal, 900);
        } catch (error: any) {
            setCreateCatalogError(error?.message || "Failed to create catalog. Please try again.");
        } finally {
            setCreatingCatalog(false);
        }
    };

    const closeUploadCatalogModal = () => {
        setShowUploadCatalogModal(false);
        setUploadCatalogFiles([]);
        setUploadCatalogError(null);
        setUploadCatalogSuccess(false);
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
            await new Promise((resolve) => setTimeout(resolve, 600));

            const newItems: CatalogItem[] = await Promise.all(
                uploadCatalogFiles.map(
                    (file) =>
                        new Promise<CatalogItem>((resolve) => {
                            const base: CatalogItem = {
                                source: "uploaded",
                                catalogName: file.name,
                                description: "",
                                price: 0,
                                unitOfMeasure: "",
                                catalogType: "",
                                segment: 0,
                                segmentTitle: "",
                                family: 0,
                                familyTitle: "",
                                commodity: 0,
                                commodityTitle: "",
                                class: 0,
                                classTitle: "",
                                isPunchOut: true,
                                punchOutUrl: "",
                                fileName: file.name,
                                fileType: file.type,
                                filePreview: null,
                                addedAt: new Date().toISOString(),
                            };
                            if (file.type.startsWith("image/")) {
                                const reader = new FileReader();
                                reader.onload = () => resolve({ ...base, filePreview: reader.result as string });
                                reader.readAsDataURL(file);
                            } else {
                                resolve(base);
                            }
                        })
                )
            );
            setCatalogItems((prev) => [...newItems, ...prev]);
            setUploadCatalogSuccess(true);
            setTimeout(() => {
                closeUploadCatalogModal();
            }, 900);
        } catch (error: any) {
            setUploadCatalogError(error?.message || "Failed to upload files. Please try again.");
        } finally {
            setUploadingCatalog(false);
        }
    };

    const [unitOptions, setUnitOptions] = useState<UnitItem[]>([]);
    const [loadingUnits, setLoadingUnits] = useState(false);

    const loadUnits = async () => {
        if (unitOptions.length > 0 || loadingUnits) return;
        setLoadingUnits(true);
        try {
            const result = await fetchUnits({ index: 0, limit: 100 });
            if (result && 'items' in result && Array.isArray(result.items)) {
                setUnitOptions(result.items);
            }
        } catch (error) {
        } finally {
            setLoadingUnits(false);
        }
    };

    // ---- Handler to fetch catalog details from API ----
    const handleCatalogCardClick = async (catalogId: string) => {
        setLoadingCatalogDetail(true);
        setCatalogDetailError(null);
        setSelectedCatalogForDetail(null);

        try {
            const response = await fetchSupplierCatalogDetail(catalogId);

            // Check if error response
            if (isErrorResponse(response)) {
                setCatalogDetailError(
                    response.description || response.message || 'Failed to load catalog details.'
                );
                return;
            }

            // Response is an array, get first item
            if (Array.isArray(response) && response.length > 0) {
                setSelectedCatalogForDetail(response[0]);
            } else {
                setCatalogDetailError('No catalog details found.');
            }
        } catch (error: any) {
            setCatalogDetailError(error.message || 'Failed to load catalog details.');
        } finally {
            setLoadingCatalogDetail(false);
        }
    };

    const closeCatalogDetailModal = () => {
        setSelectedCatalogForDetail(null);
        setCatalogDetailError(null);
    };

    /* Keyboard support for the div-based sidebar nav items and drop zones */
    const onActivateKey = (action: () => void) => (e: React.KeyboardEvent<HTMLElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            action();
        }
    };

    return (
        <>
            <div
                className="pud-nav-item"
                role="button"
                tabIndex={0}
                aria-expanded={isCatalogExpanded}
                onClick={() => setIsCatalogExpanded((prev) => !prev)}
                onKeyDown={onActivateKey(() => setIsCatalogExpanded((prev) => !prev))}
            >
                <span className="pud-nav-icon" aria-hidden="true"><NavIconCatalog /></span>
                <span className="pud-nav-label">Catalog</span>
                <span
                    className={`pud-nav-chevron${isCatalogExpanded ? " pud-nav-chevron-expanded" : ""}`}
                    aria-hidden="true"
                >
                    <IconChevronRight />
                </span>
            </div>
            {isCatalogExpanded && (
                <div className="pud-nav-subgroup">
                    <div
                        className="pud-nav-subitem"
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowCreateCatalogModal(true)}
                        onKeyDown={onActivateKey(() => setShowCreateCatalogModal(true))}
                    >
                        <span className="pud-nav-icon" aria-hidden="true"><IconPlusCircle /></span>
                        <span className="pud-nav-label">Create Catalog</span>
                    </div>
                    <div
                        className="pud-nav-subitem"
                        role="button"
                        tabIndex={0}
                        onClick={() => setShowUploadCatalogModal(true)}
                        onKeyDown={onActivateKey(() => setShowUploadCatalogModal(true))}
                    >
                        <span className="pud-nav-icon" aria-hidden="true"><IconUploadCloud /></span>
                        <span className="pud-nav-label">Upload Catalog</span>
                    </div>
                    <div
                        className="pud-nav-subitem"
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                            setShowCatalogListModal(true);
                            onShowCatalogList?.();
                        }}
                        onKeyDown={onActivateKey(() => {
                            setShowCatalogListModal(true);
                            onShowCatalogList?.();
                        })}
                    >
                        <span className="pud-nav-icon" aria-hidden="true"><IconGrid /></span>
                        <span className="pud-nav-label">Show Catalogs</span>
                        {catalogItems.length > 0 && (
                            <span className="pud-nav-subitem-count">{catalogItems.length}</span>
                        )}
                    </div>
                </div>
            )}

            {showCreateCatalogModal && (
                <div className="sila-overlay pud-modal-overlay" onClick={closeCreateCatalogModal}>
                    <div
                        className="sila-modal sila-modal--lg pud-modal pud-modal-rfq pud-catalog-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pud-catalog-create-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sila-modal-header pud-modal-header">
                            <div className="pud-catalog-modal-heading">
                                <span className="pud-modal-badge">New Catalog Item</span>
                                <h2 id="pud-catalog-create-title" className="sila-modal-title pud-modal-name">Create Catalog</h2>
                                <div className="pud-modal-meta">
                                    <span>Add a product or service to your catalog</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm pud-modal-close"
                                onClick={closeCreateCatalogModal}
                                title="Close"
                                aria-label="Close"
                            >
                                <IconClose />
                            </button>
                        </div>

                        <form className="pud-catalog-modal-form" onSubmit={handleCreateCatalogSubmit}>
                            <div className="sila-modal-body pud-modal-body">
                                {createCatalogSuccess && (
                                    <div className="sila-alert sila-alert--success pud-alert pud-alert-success" role="status">
                                        <IconCheckCircle /> Catalog created successfully!
                                    </div>
                                )}
                                {createCatalogError && (
                                    <div className="sila-alert sila-alert--danger pud-alert pud-alert-error" role="alert">{createCatalogError}</div>
                                )}

                                <div className="pud-catalog-form-grid">
                                    {/* ---- Basic Details ---- */}
                                    <div className="pud-catalog-form-section">
                                        <span className="pud-catalog-form-section-title">Basic Details</span>
                                    </div>

                                    <div className="sila-field pud-catalog-form-field pud-catalog-form-full">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-name">
                                            Catalog Name<span className="sila-required" aria-hidden="true">*</span>
                                        </label>
                                        <input
                                            id="pud-catalog-name"
                                            type="text"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.catalogName}
                                            onChange={(e) => updateCatalogField("catalogName", e.target.value)}
                                            placeholder="e.g. Ergonomic Office Chair"
                                            required
                                        />
                                    </div>

                                    <div className="sila-field pud-catalog-form-field pud-catalog-form-full">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-description">Description</label>
                                        <textarea
                                            id="pud-catalog-description"
                                            className="sila-textarea pud-catalog-form-textarea"
                                            value={catalogForm.description}
                                            onChange={(e) => updateCatalogField("description", e.target.value)}
                                            placeholder="Briefly describe this catalog item..."
                                            rows={3}
                                        />
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-price">Price ($)</label>
                                        <input
                                            id="pud-catalog-price"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="sila-input pud-catalog-form-input pud-catalog-num"
                                            value={catalogForm.price}
                                            onChange={(e) => updateCatalogField("price", e.target.value)}
                                            placeholder="0.00"
                                        />
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-uom">Unit of Measure</label>
                                        <select
                                            id="pud-catalog-uom"
                                            className="sila-select pud-catalog-form-select"
                                            value={catalogForm.unitOfMeasure}
                                            onChange={(e) => updateCatalogField("unitOfMeasure", e.target.value)}
                                            onClick={loadUnits}
                                        >
                                            <option value="">
                                                {loadingUnits ? "Loading units..." : "Select unit of measure"}
                                            </option>
                                            {unitOptions.map((unit) => (
                                                <option key={unit.id} value={unit.key}>
                                                    {unit.key}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-type">Catalog Type</label>
                                        <select
                                            id="pud-catalog-type"
                                            className="sila-select pud-catalog-form-select"
                                            value={catalogForm.catalogType}
                                            onChange={(e) => updateCatalogField("catalogType", e.target.value)}
                                            onClick={loadCatalogTypes}
                                        >
                                            {catalogTypeOptions.map((opt) => (
                                                <option key={opt.id} value={opt.key}>{opt.key}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="pud-catalog-form-section">
                                        <span className="pud-catalog-form-section-title">Classification</span>
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-segment">Segment</label>
                                        <input
                                            id="pud-catalog-segment"
                                            type="number"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.segment}
                                            onChange={(e) => updateCatalogField("segment", e.target.value)}
                                            placeholder="e.g. 44000000"
                                        />
                                    </div>
                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-segment-title">Segment Title</label>
                                        <input
                                            id="pud-catalog-segment-title"
                                            type="text"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.segmentTitle}
                                            onChange={(e) => updateCatalogField("segmentTitle", e.target.value)}
                                            placeholder="e.g. Office Equipment"
                                        />
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-family">Family</label>
                                        <input
                                            id="pud-catalog-family"
                                            type="number"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.family}
                                            onChange={(e) => updateCatalogField("family", e.target.value)}
                                            placeholder="e.g. 44120000"
                                        />
                                    </div>
                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-family-title">Family Title</label>
                                        <input
                                            id="pud-catalog-family-title"
                                            type="text"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.familyTitle}
                                            onChange={(e) => updateCatalogField("familyTitle", e.target.value)}
                                            placeholder="e.g. Office Furniture"
                                        />
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-commodity">Commodity</label>
                                        <input
                                            id="pud-catalog-commodity"
                                            type="number"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.commodity}
                                            onChange={(e) => updateCatalogField("commodity", e.target.value)}
                                            placeholder="e.g. 44121700"
                                        />
                                    </div>
                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-commodity-title">Commodity Title</label>
                                        <input
                                            id="pud-catalog-commodity-title"
                                            type="text"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.commodityTitle}
                                            onChange={(e) => updateCatalogField("commodityTitle", e.target.value)}
                                            placeholder="e.g. Seating"
                                        />
                                    </div>

                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-class">Class</label>
                                        <input
                                            id="pud-catalog-class"
                                            type="number"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.class}
                                            onChange={(e) => updateCatalogField("class", e.target.value)}
                                            placeholder="e.g. 44121701"
                                        />
                                    </div>
                                    <div className="sila-field pud-catalog-form-field">
                                        <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-class-title">Class Title</label>
                                        <input
                                            id="pud-catalog-class-title"
                                            type="text"
                                            className="sila-input pud-catalog-form-input"
                                            value={catalogForm.classTitle}
                                            onChange={(e) => updateCatalogField("classTitle", e.target.value)}
                                            placeholder="e.g. Office Chairs"
                                        />
                                    </div>

                                    {/* ---- PunchOut ---- */}
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
                                        <div className="sila-field pud-catalog-form-field pud-catalog-form-full">
                                            <label className="sila-label pud-catalog-form-label" htmlFor="pud-catalog-punchout-url">
                                                PunchOut URL<span className="sila-required" aria-hidden="true">*</span>
                                            </label>
                                            <input
                                                id="pud-catalog-punchout-url"
                                                type="url"
                                                className="sila-input pud-catalog-form-input"
                                                value={catalogForm.punchOutUrl}
                                                onChange={(e) => updateCatalogField("punchOutUrl", e.target.value)}
                                                placeholder="https://supplier.example.com/punchout"
                                                required={catalogForm.isPunchOut}
                                            />
                                        </div>
                                    )}

                                    {/* ---- Attachment ---- */}
                                    <div className="pud-catalog-form-section">
                                        <span className="pud-catalog-form-section-title">Attachment</span>
                                    </div>

                                    <div className="sila-field pud-catalog-form-field pud-catalog-form-full">
                                        <span className="sila-label pud-catalog-form-label" id="pud-catalog-file-label">Upload File / Image</span>
                                        <div
                                            className={`sila-dropzone pud-catalog-dropzone${isDraggingCatalogFile ? " sila-dropzone--active pud-catalog-dropzone-active" : ""}`}
                                            role="button"
                                            tabIndex={0}
                                            aria-labelledby="pud-catalog-file-label"
                                            onClick={() => catalogFileInputRef.current?.click()}
                                            onKeyDown={onActivateKey(() => catalogFileInputRef.current?.click())}
                                            onDragOver={(e) => { e.preventDefault(); setIsDraggingCatalogFile(true); }}
                                            onDragLeave={() => setIsDraggingCatalogFile(false)}
                                            onDrop={(e) => {
                                                e.preventDefault();
                                                setIsDraggingCatalogFile(false);
                                                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                                                    handleCatalogFileSelect(e.dataTransfer.files[0]);
                                                }
                                            }}
                                        >
                                            <input
                                                ref={catalogFileInputRef}
                                                type="file"
                                                className="pud-catalog-hidden-input"
                                                tabIndex={-1}
                                                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                                                onChange={(e) => handleCatalogFileSelect(e.target.files ? e.target.files[0] : null)}
                                            />
                                            {catalogFilePreview ? (
                                                <img src={catalogFilePreview} alt="Catalog preview" className="pud-catalog-dropzone-preview" />
                                            ) : (
                                                <div className="pud-catalog-dropzone-icon"><IconUploadCloudLarge /></div>
                                            )}
                                            <div className="pud-catalog-dropzone-text">
                                                {catalogFile ? catalogFile.name : "Click to upload or drag & drop a file/image here"}
                                            </div>
                                            {catalogFile && (
                                                <button
                                                    type="button"
                                                    className="sila-btn sila-btn--secondary sila-btn--sm pud-catalog-dropzone-remove"
                                                    onClick={(e) => { e.stopPropagation(); handleCatalogFileSelect(null); }}
                                                >
                                                    <IconTrash /> Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="sila-modal-footer pud-modal-footer">
                                <button
                                    type="button"
                                    className="sila-btn sila-btn--secondary pud-btn pud-btn-outline"
                                    onClick={closeCreateCatalogModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="sila-btn sila-btn--primary pud-btn pud-btn-message"
                                    disabled={creatingCatalog}
                                    aria-busy={creatingCatalog || undefined}
                                >
                                    {creatingCatalog && <span className="sila-spinner" aria-hidden="true" />}
                                    {creatingCatalog ? "Saving..." : "Save Catalog"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ---------- Upload Catalog Modal ---------- */}
            {showUploadCatalogModal && (
                <div className="sila-overlay pud-modal-overlay" onClick={closeUploadCatalogModal}>
                    <div
                        className="sila-modal pud-modal pud-catalog-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pud-catalog-upload-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sila-modal-header pud-modal-header">
                            <div className="pud-catalog-modal-heading">
                                <span className="pud-modal-badge">Bulk Upload</span>
                                <h2 id="pud-catalog-upload-title" className="sila-modal-title pud-modal-name">Upload Catalog</h2>
                                <div className="pud-modal-meta">
                                    <span>Add files or images to your catalog</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm pud-modal-close"
                                onClick={closeUploadCatalogModal}
                                title="Close"
                                aria-label="Close"
                            >
                                <IconClose />
                            </button>
                        </div>

                        <div className="sila-modal-body pud-modal-body">
                            {uploadCatalogSuccess && (
                                <div className="sila-alert sila-alert--success pud-alert pud-alert-success" role="status">
                                    <IconCheckCircle /> Files uploaded successfully!
                                </div>
                            )}
                            {uploadCatalogError && (
                                <div className="sila-alert sila-alert--danger pud-alert pud-alert-error" role="alert">{uploadCatalogError}</div>
                            )}

                            <div
                                className={`sila-dropzone pud-catalog-dropzone pud-catalog-dropzone-large${isDraggingUploadFiles ? " sila-dropzone--active pud-catalog-dropzone-active" : ""}`}
                                role="button"
                                tabIndex={0}
                                aria-label="Click to upload or drag & drop files/images here"
                                onClick={() => uploadCatalogInputRef.current?.click()}
                                onKeyDown={onActivateKey(() => uploadCatalogInputRef.current?.click())}
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
                                    className="pud-catalog-hidden-input"
                                    tabIndex={-1}
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
                                <ul className="sila-file-list pud-catalog-file-list">
                                    {uploadCatalogFiles.map((file, index) => (
                                        <li className="sila-file pud-catalog-file-item" key={`${file.name}-${index}`}>
                                            {file.type.startsWith("image/") ? (
                                                <img
                                                    src={URL.createObjectURL(file)}
                                                    alt=""
                                                    className="pud-catalog-file-thumb"
                                                />
                                            ) : (
                                                <div className="sila-file-icon pud-catalog-file-icon"><IconFileGeneric /></div>
                                            )}
                                            <div className="pud-catalog-file-info">
                                                <div className="sila-file-name pud-catalog-file-name" title={file.name}>{file.name}</div>
                                                <div className="sila-file-meta pud-catalog-file-size">{formatFileSize(file.size)}</div>
                                            </div>
                                            <button
                                                type="button"
                                                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm pud-catalog-file-remove"
                                                onClick={() => handleRemoveUploadCatalogFile(index)}
                                                title="Remove"
                                                aria-label={`Remove ${file.name}`}
                                            >
                                                <IconClose />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        <div className="sila-modal-footer pud-modal-footer">
                            <button
                                type="button"
                                className="sila-btn sila-btn--secondary pud-btn pud-btn-outline"
                                onClick={closeUploadCatalogModal}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="sila-btn sila-btn--primary pud-btn pud-btn-message"
                                disabled={uploadingCatalog || uploadCatalogFiles.length === 0}
                                aria-busy={uploadingCatalog || undefined}
                                onClick={handleUploadCatalogSubmit}
                            >
                                {uploadingCatalog && <span className="sila-spinner" aria-hidden="true" />}
                                {uploadingCatalog ? "Uploading..." : `Upload ${uploadCatalogFiles.length > 0 ? `(${uploadCatalogFiles.length})` : ""}`}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {(showCatalogListModal || !!fullViewContainer) && fullViewContainer && createPortal(
                <div className="pud-catalog-page">
                    <div className="sila-page-header pud-catalog-fullview-header">
                        <div className="sila-page-header-main">
                            <div>
                                <h1 className="sila-page-title pud-title">Your Catalogs</h1>
                                <p className="sila-page-description pud-subtitle">
                                    {catalogItems.length} {catalogItems.length === 1 ? "Item" : "Items"} in your catalog
                                </p>
                            </div>
                        </div>
                        <div className="sila-page-actions pud-catalog-fullview-actions">
                            <button
                                type="button"
                                className="sila-btn sila-btn--secondary pud-btn pud-btn-outline"
                                onClick={() => {
                                    setShowCatalogListModal(false);
                                    onCloseCatalogList?.();
                                }}
                            >
                                <FaArrowLeft aria-hidden="true" /> Back to Dashboard
                            </button>
                            <button
                                type="button"
                                className="sila-btn sila-btn--primary pud-btn pud-btn-message"
                                onClick={() => setShowCreateCatalogModal(true)}
                            >
                                <FaPlus aria-hidden="true" /> Add Catalog
                            </button>
                        </div>
                    </div>

                    <div className="sila-card pud-catalog-list-card">
                        {loadingCatalogs ? (
                            <Loader message="Loading catalogs..." />
                        ) : catalogsError ? (
                            <EmptyState variant="error" title={catalogsError} />
                        ) : catalogItems.length === 0 ? (
                            <EmptyState
                                className="pud-catalog-empty-state"
                                icon={<IconGridLarge />}
                                title="No catalogs yet"
                                description={'Use "Create Catalog" or "Upload Catalog" to add your first item.'}
                            />
                        ) : (
                            <div className="sila-table-wrap pud-catalog-table-wrap">
                                <table className="sila-table pud-catalog-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Catalog Item</th>
                                            <th scope="col">Type</th>
                                            <th scope="col">Classification</th>
                                            <th scope="col">Unit</th>
                                            <th scope="col" className="sila-num">Price</th>
                                            <th scope="col">Source</th>
                                            <th scope="col">Added</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {catalogItems.map((item) => (
                                            <tr
                                                key={item.id || item.catalogName}
                                                className={item.id ? "sila-row-clickable" : undefined}
                                                tabIndex={item.id ? 0 : undefined}
                                                onClick={() => item.id && handleCatalogCardClick(item.id)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" && item.id) handleCatalogCardClick(item.id);
                                                }}
                                            >
                                                <td>
                                                    <div className="pud-catalog-item-cell">
                                                        <span className="pud-catalog-item-thumb">
                                                            {item.filePreview ? (
                                                                <img src={item.filePreview} alt="" />
                                                            ) : (
                                                                <IconFileGeneric />
                                                            )}
                                                        </span>
                                                        <div className="pud-catalog-item-text">
                                                            <div className="sila-cell-strong pud-catalog-item-name" title={item.catalogName}>{item.catalogName}</div>
                                                            {item.description && (
                                                                <div className="pud-catalog-item-desc">{item.description}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="pud-catalog-item-tags">
                                                        {item.catalogType ? (
                                                            <span className="sila-badge sila-badge--neutral">{item.catalogType}</span>
                                                        ) : !item.isPunchOut && (
                                                            <span className="sila-cell-muted">—</span>
                                                        )}
                                                        {item.isPunchOut && <span className="sila-badge sila-badge--info">PunchOut</span>}
                                                    </div>
                                                </td>
                                                <td className="sila-cell-muted">{item.classTitle || "—"}</td>
                                                <td>{item.unitOfMeasure || <span className="sila-cell-muted">—</span>}</td>
                                                <td className="sila-num">
                                                    {item.price ? `$${Number(item.price).toFixed(2)}` : <span className="sila-cell-muted">—</span>}
                                                </td>
                                                <td>
                                                    <span className="sila-badge sila-badge--neutral">
                                                        {item.source === "created" ? "Created" : "Uploaded"}
                                                    </span>
                                                </td>
                                                <td className="sila-cell-muted pud-catalog-nowrap">{formatCatalogDate(item.addedAt)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>,
                fullViewContainer
            )}

            {/* ---------- Catalog Detail Modal ---------- */}
            {selectedCatalogForDetail && (
                <div className="sila-overlay pud-modal-overlay" onClick={closeCatalogDetailModal}>
                    <div
                        className="sila-modal sila-modal--lg pud-modal pud-modal-rfq pud-catalog-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="pud-catalog-detail-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div className="sila-modal-header pud-modal-header">
                            <div className="pud-catalog-modal-heading">
                                <span className="pud-modal-badge">Catalog Details</span>
                                <h2 id="pud-catalog-detail-title" className="sila-modal-title pud-modal-name">{selectedCatalogForDetail.catalogName}</h2>
                                <div className="pud-modal-meta">
                                    <span>Supplier: {selectedCatalogForDetail.supplierName}</span>
                                    <span>Type: {selectedCatalogForDetail.catalogType}</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm pud-modal-close"
                                onClick={closeCatalogDetailModal}
                                title="Close"
                                aria-label="Close"
                            >
                                <IconClose />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="sila-modal-body pud-modal-body">
                            {loadingCatalogDetail && (
                                <Loader message="Loading catalog details..." />
                            )}

                            {catalogDetailError && (
                                <EmptyState
                                    variant="error"
                                    title={catalogDetailError}
                                    action={
                                        <button
                                            type="button"
                                            className="sila-btn sila-btn--secondary pud-btn pud-btn-outline"
                                            onClick={() => handleCatalogCardClick(selectedCatalogForDetail.catalogId)}
                                        >
                                            Retry Loading
                                        </button>
                                    }
                                />
                            )}

                            {selectedCatalogForDetail && !loadingCatalogDetail && !catalogDetailError && (
                                <div className="pud-catalog-detail">
                                    {/* Basic Info */}
                                    <section className="pud-catalog-detail-section">
                                        <h3 className="pud-modal-section-title">Description</h3>
                                        <p className="pud-modal-desc pud-catalog-detail-desc">
                                            {selectedCatalogForDetail.description || "No description provided."}
                                        </p>

                                        <dl className="sila-meta-grid pud-catalog-detail-meta">
                                            <div className="sila-meta-item">
                                                <dt className="sila-meta-label">Price</dt>
                                                <dd className="sila-meta-value pud-catalog-num">
                                                    {selectedCatalogForDetail.currency} {Number(selectedCatalogForDetail.price).toFixed(2)}
                                                </dd>
                                            </div>
                                            <div className="sila-meta-item">
                                                <dt className="sila-meta-label">Unit of Measure</dt>
                                                <dd className="sila-meta-value">
                                                    {selectedCatalogForDetail.unitOfMeasure || "N/A"}
                                                </dd>
                                            </div>
                                        </dl>
                                    </section>

                                    {/* Classification */}
                                    <section className="pud-catalog-detail-section">
                                        <h3 className="pud-modal-section-title">Classification (UNSPSC)</h3>
                                        <dl className="sila-meta-grid pud-catalog-detail-meta pud-catalog-detail-meta-2">
                                            <div className="sila-meta-item">
                                                <dt className="sila-meta-label">Segment</dt>
                                                <dd className="sila-meta-value pud-catalog-detail-code">
                                                    <span className="sila-ref">{selectedCatalogForDetail.segment}</span> - {selectedCatalogForDetail.segmentTitle}
                                                </dd>
                                            </div>
                                            <div className="sila-meta-item">
                                                <dt className="sila-meta-label">Family</dt>
                                                <dd className="sila-meta-value pud-catalog-detail-code">
                                                    <span className="sila-ref">{selectedCatalogForDetail.family}</span> - {selectedCatalogForDetail.familyTitle}
                                                </dd>
                                            </div>
                                            <div className="sila-meta-item">
                                                <dt className="sila-meta-label">Commodity</dt>
                                                <dd className="sila-meta-value pud-catalog-detail-code">
                                                    <span className="sila-ref">{selectedCatalogForDetail.commodity}</span> - {selectedCatalogForDetail.commodityTitle}
                                                </dd>
                                            </div>
                                            <div className="sila-meta-item">
                                                <dt className="sila-meta-label">Class</dt>
                                                <dd className="sila-meta-value pud-catalog-detail-code">
                                                    <span className="sila-ref">{selectedCatalogForDetail.class}</span> - {selectedCatalogForDetail.classTitle}
                                                </dd>
                                            </div>
                                        </dl>
                                    </section>

                                    {/* Assets */}
                                    {selectedCatalogForDetail.asset && selectedCatalogForDetail.asset.length > 0 && (
                                        <section className="pud-catalog-detail-section">
                                            <h3 className="pud-modal-section-title">Attachments</h3>
                                            <ul className="sila-file-list">
                                                {selectedCatalogForDetail.asset.map((asset, idx) => (
                                                    <li key={idx} className="sila-file">
                                                        <span className="sila-file-icon" aria-hidden="true"><IconFileGeneric /></span>
                                                        <span className="sila-file-name" title={asset.fileName}>
                                                            {asset.fileName}
                                                        </span>
                                                        <span className="sila-file-meta">
                                                            {asset.fileType || asset.assetType || "File"}
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </section>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div className="sila-modal-footer pud-modal-footer">
                            <button
                                type="button"
                                className="sila-btn sila-btn--secondary pud-btn pud-btn-outline"
                                onClick={closeCatalogDetailModal}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Catalog;
