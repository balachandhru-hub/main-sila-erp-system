import React from "react";
import { EmptyState } from "@vosox/shared-ui";
import type { CatalogDetailResponseItem } from "../../api/supplierApi";
import { IconChevronLeft, IconChevronRight, IconExternalLink, IconGridLarge } from "./icons";
import CatalogStockEditor from "./CatalogStockEditor";

interface CatalogDetailProps {
    selectedCatalogItem: CatalogDetailResponseItem;
    loadingCatalogDetail: boolean;
    loadingSelectedImages: boolean;
    catalogDetailError: string | null;
    selectedCatalogImages: string[];
    selectedImageIndex: number;
    setSelectedImageIndex: (index: number) => void;
    goToPrevImage: () => void;
    goToNextImage: () => void;
    showPunchOutFullPage: boolean;
    punchOutPreviewUrl: string;
    punchOutIframeBlocked: boolean;
    onIframeError: () => void;
    onBackFromPunchOut: () => void;
    onClose: () => void;
    onRetry: () => void;
    onOpenPunchOut: (url: string) => void;
}

const CatalogDetail: React.FC<CatalogDetailProps> = ({
    selectedCatalogItem,
    loadingCatalogDetail,
    loadingSelectedImages,
    catalogDetailError,
    selectedCatalogImages,
    selectedImageIndex,
    setSelectedImageIndex,
    goToPrevImage,
    goToNextImage,
    showPunchOutFullPage,
    punchOutPreviewUrl,
    punchOutIframeBlocked,
    onIframeError,
    onBackFromPunchOut,
    onClose,
    onRetry,
    onOpenPunchOut,
}) => {
    if (showPunchOutFullPage) {
        return (
            <>
                <div className="pud-catalog-fullview-header">
                    <div>
                        <button
                            type="button"
                            className="pud-btn pud-btn-outline sila-btn sila-btn--secondary"
                            onClick={onBackFromPunchOut}
                        >
                            <IconChevronLeft /> Back to {selectedCatalogItem.catalogName}
                        </button>
                    </div>
                    <div className="pud-catalog-fullview-actions">
                        <span className="pud-modal-badge">
                            <IconExternalLink /> PunchOut Catalog
                        </span>
                    </div>
                </div>

                <div className="pud-punchout-fullpage-body">
                    <h1 className="pud-title">{selectedCatalogItem.catalogName}</h1>
                    {selectedCatalogItem.description && (
                        <p className="pud-subtitle">{selectedCatalogItem.description}</p>
                    )}
                    <div className="pud-punchout-fullpage-viewer">
                        {punchOutIframeBlocked ? (
                            <div className="pud-punchout-blocked">
                                <div className="pud-punchout-blocked-text">
                                    <p className="pud-punchout-blocked-title">Website Cannot Be Embedded</p>
                                    <p className="pud-punchout-blocked-desc">
                                        This website has restricted embedding for security reasons.
                                    </p>
                                </div>
                                <a
                                    href={punchOutPreviewUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="pud-btn pud-btn-message sila-btn sila-btn--primary"
                                >
                                    <IconExternalLink /> Open in New Tab
                                </a>
                            </div>
                        ) : (
                            <iframe
                                src={punchOutPreviewUrl}
                                className="pud-punchout-iframe"
                                title="PunchOut Catalog"
                                onError={onIframeError}
                                sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-pointer-lock"
                            />
                        )}
                    </div>
                </div>
            </>
        );
    }

    return (
        <>
            <div className="pud-catalog-fullview-header">
                <div>
                    <button
                        type="button"
                        className="pud-btn pud-btn-outline sila-btn sila-btn--secondary"
                        onClick={onClose}
                    >
                        <IconChevronLeft /> Back to Catalog
                    </button>
                </div>
            </div>

            <div className="pud-catalog-detail-layout">
                <div className="pud-catalog-detail-media">
                    <div className="pud-catalog-detail-image-frame">
                        {loadingCatalogDetail || loadingSelectedImages ? (
                            <div className="pud-spinner" />
                        ) : catalogDetailError ? (
                            <EmptyState
                                variant="error"
                                title={catalogDetailError}
                                action={
                                    <button
                                        type="button"
                                        className="pud-btn pud-btn-outline sila-btn sila-btn--secondary"
                                        onClick={onRetry}
                                    >
                                        Retry Loading
                                    </button>
                                }
                            />
                        ) : selectedCatalogImages.length > 0 ? (
                            <img
                                src={selectedCatalogImages[selectedImageIndex]}
                                alt={selectedCatalogItem.catalogName}
                                className="pud-catalog-detail-image"
                            />
                        ) : (
                            <div className="pud-catalog-detail-placeholder"><IconGridLarge /></div>
                        )}

                        {selectedCatalogImages.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={goToPrevImage}
                                    title="Previous image"
                                    aria-label="Previous image"
                                    className="pud-catalog-image-nav pud-catalog-image-nav-prev"
                                >
                                    <IconChevronLeft />
                                </button>
                                <button
                                    type="button"
                                    onClick={goToNextImage}
                                    title="Next image"
                                    aria-label="Next image"
                                    className="pud-catalog-image-nav pud-catalog-image-nav-next"
                                >
                                    <IconChevronRight />
                                </button>
                            </>
                        )}
                    </div>

                    {selectedCatalogImages.length > 1 && (
                        <div className="pud-catalog-thumb-row">
                            {selectedCatalogImages.map((src, idx) => (
                                <button
                                    type="button"
                                    key={idx}
                                    onClick={() => setSelectedImageIndex(idx)}
                                    className={`pud-catalog-thumb${idx === selectedImageIndex ? " pud-catalog-thumb-active" : ""}`}
                                    aria-label={`Show image ${idx + 1}`}
                                    aria-pressed={idx === selectedImageIndex}
                                >
                                    <img src={src} alt="" className="pud-catalog-thumb-img" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div className="pud-catalog-detail-info">
                    <h1 className="pud-title">{selectedCatalogItem.catalogName}</h1>

                    {selectedCatalogItem.catalogType && (
                        <span className="pud-catalog-card-tag">
                            {selectedCatalogItem.catalogType}
                        </span>
                    )}

                    {selectedCatalogItem.description && (
                        <p className="pud-catalog-card-desc pud-catalog-detail-desc">
                            {selectedCatalogItem.description}
                        </p>
                    )}

                    <div className="pud-catalog-detail-price-row">
                        {!!selectedCatalogItem.price && (
                            <span className="pud-catalog-card-price pud-catalog-detail-price">
                                {selectedCatalogItem.currency ? `${selectedCatalogItem.currency} ` : ""}
                                {Number(selectedCatalogItem.price).toFixed(2)}
                            </span>
                        )}
                        {selectedCatalogItem.unitOfMeasure && (
                            <span className="pud-catalog-card-uom">per {selectedCatalogItem.unitOfMeasure}</span>
                        )}
                    </div>

                    {selectedCatalogItem.isPunchOut && selectedCatalogItem.punchOutUrl && (
                        <button
                            type="button"
                            className="pud-btn pud-btn-message sila-btn sila-btn--primary pud-catalog-detail-cta"
                            onClick={() => onOpenPunchOut(selectedCatalogItem.punchOutUrl)}
                        >
                            <IconExternalLink /> View Catalog
                        </button>
                    )}

                    {!selectedCatalogItem.isPunchOut && (
                        <CatalogStockEditor
                            key={selectedCatalogItem.catalogId}
                            catalogItem={selectedCatalogItem}
                            onSaved={onRetry}
                        />
                    )}

                    {(selectedCatalogItem.segment || selectedCatalogItem.family || selectedCatalogItem.class || selectedCatalogItem.commodity) && (
                        <div className="pud-catalog-card-classification">
                            <div className="pud-catalog-form-section-title">Classification</div>
                            {selectedCatalogItem.segment && (
                                <div className="pud-catalog-classification-row">
                                    <span className="pud-catalog-classification-label">Segment:</span>
                                    <span className="pud-catalog-classification-value">
                                        {selectedCatalogItem.segment}
                                        {selectedCatalogItem.segmentTitle && ` - ${selectedCatalogItem.segmentTitle}`}
                                    </span>
                                </div>
                            )}
                            {selectedCatalogItem.family && (
                                <div className="pud-catalog-classification-row">
                                    <span className="pud-catalog-classification-label">Family:</span>
                                    <span className="pud-catalog-classification-value">
                                        {selectedCatalogItem.family}
                                        {selectedCatalogItem.familyTitle && ` - ${selectedCatalogItem.familyTitle}`}
                                    </span>
                                </div>
                            )}
                            {selectedCatalogItem.class && (
                                <div className="pud-catalog-classification-row">
                                    <span className="pud-catalog-classification-label">Class:</span>
                                    <span className="pud-catalog-classification-value">
                                        {selectedCatalogItem.class}
                                        {selectedCatalogItem.classTitle && ` - ${selectedCatalogItem.classTitle}`}
                                    </span>
                                </div>
                            )}
                            {selectedCatalogItem.commodity && (
                                <div className="pud-catalog-classification-row">
                                    <span className="pud-catalog-classification-label">Commodity:</span>
                                    <span className="pud-catalog-classification-value">
                                        {selectedCatalogItem.commodity}
                                        {selectedCatalogItem.commodityTitle && ` - ${selectedCatalogItem.commodityTitle}`}
                                    </span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};

export default CatalogDetail;
