import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import "./Catalog.css";
import { useCatalogList } from "../hooks/useCatalogList";
import { useCatalogDetail } from "../hooks/useCatalogDetail";
import { useCreateCatalogForm } from "../hooks/useCreateCatalogForm";
import CreateCatalogModal from "./Catalog/CreateCatalogModal";
import UploadCatalogModal from "./Catalog/UploadCatalogModal";
import CatalogList from "./Catalog/CatalogList";
import CatalogDetail from "./Catalog/CatalogDetail";
import { NavIconCatalog, IconChevronRight, IconPlusCircle, IconUploadCloud, IconGrid } from "./Catalog/icons";

interface CatalogProps {
    onShowCatalogList?: () => void;
    fullViewContainer?: HTMLDivElement | null;
    isAdmin?: boolean;
}

const Catalog: React.FC<CatalogProps> = ({
    onShowCatalogList,
    fullViewContainer,
    isAdmin = false
}) => {
    const [isCatalogExpanded, setIsCatalogExpanded] = useState(false);
    const [showCreateCatalogModal, setShowCreateCatalogModal] = useState(false);
    const [showUploadCatalogModal, setShowUploadCatalogModal] = useState(false);
    const [showCatalogListModal, setShowCatalogListModal] = useState(false);

    const {
        catalogList,
        loadingCatalogList,
        catalogListError,
        catalogPage,
        setCatalogPage,
        catalogTotalPages,
        pagedCatalogList,
        catalogAssetImages,
        loadCatalogAssetImage,
        loadCatalogList,
    } = useCatalogList();

    const {
        selectedCatalogItem,
        loadingCatalogDetail,
        catalogDetailError,
        selectedImageIndex,
        setSelectedImageIndex,
        loadingSelectedImages,
        showPunchOutFullPage,
        setShowPunchOutFullPage,
        punchOutPreviewUrl,
        punchOutIframeBlocked,
        setPunchOutIframeBlocked,
        openCatalogDetail,
        closeCatalogDetail,
        selectedCatalogImages,
        goToPrevImage,
        goToNextImage,
        handlePunchOutPreview,
    } = useCatalogDetail(loadCatalogAssetImage, catalogAssetImages);

    useEffect(() => {
        if (fullViewContainer) {
            loadCatalogList();
        }
    }, [fullViewContainer]);

    const createForm = useCreateCatalogForm({
        onCreated: loadCatalogList,
        onClose: () => setShowCreateCatalogModal(false),
    });

    return (
        <>
            <div
                className="pud-nav-item"
                onClick={() => setIsCatalogExpanded((prev) => !prev)}
            >
                <span className="pud-nav-icon"><NavIconCatalog /></span>
                <span className="pud-nav-label">Catalog</span>
                <span className="pud-nav-chevron">
                    <IconChevronRight />
                </span>
            </div>
            {isCatalogExpanded && (
                <div className="pud-nav-subgroup">
                    {isAdmin && (
                        <div className="pud-nav-subitem" onClick={() => setShowCreateCatalogModal(true)}>
                            <span className="pud-nav-icon"><IconPlusCircle /></span>
                            <span className="pud-nav-label">Create Catalog</span>
                        </div>
                    )}

                    {isAdmin && (
                        <div className="pud-nav-subitem" onClick={() => setShowUploadCatalogModal(true)}>
                            <span className="pud-nav-icon"><IconUploadCloud /></span>
                            <span className="pud-nav-label">Upload Catalog</span>
                        </div>
                    )}

                    <div
                        className="pud-nav-subitem"
                        onClick={() => {
                            setShowCatalogListModal(true);
                            onShowCatalogList?.();
                            loadCatalogList();
                        }}
                    >
                        <span className="pud-nav-icon"><IconGrid /></span>
                        <span className="pud-nav-label">Show Catalogs</span>
                    </div>
                </div>
            )}

            <CreateCatalogModal isOpen={showCreateCatalogModal} form={createForm} />

            <UploadCatalogModal
                isOpen={showUploadCatalogModal}
                onClose={() => setShowUploadCatalogModal(false)}
                onUploaded={loadCatalogList}
            />

            {/* Catalog List Portal */}
            {(showCatalogListModal || !!fullViewContainer) && fullViewContainer && createPortal(
                <>
                    {selectedCatalogItem ? (
                        <CatalogDetail
                            selectedCatalogItem={selectedCatalogItem}
                            loadingCatalogDetail={loadingCatalogDetail}
                            loadingSelectedImages={loadingSelectedImages}
                            catalogDetailError={catalogDetailError}
                            selectedCatalogImages={selectedCatalogImages}
                            selectedImageIndex={selectedImageIndex}
                            setSelectedImageIndex={setSelectedImageIndex}
                            goToPrevImage={goToPrevImage}
                            goToNextImage={goToNextImage}
                            showPunchOutFullPage={showPunchOutFullPage}
                            punchOutPreviewUrl={punchOutPreviewUrl}
                            punchOutIframeBlocked={punchOutIframeBlocked}
                            onIframeError={() => setPunchOutIframeBlocked(true)}
                            onBackFromPunchOut={() => setShowPunchOutFullPage(false)}
                            onClose={closeCatalogDetail}
                            onRetry={() => selectedCatalogItem && openCatalogDetail(selectedCatalogItem.catalogId)}
                            onOpenPunchOut={handlePunchOutPreview}
                        />
                    ) : (
                        <CatalogList
                            catalogList={catalogList}
                            pagedCatalogList={pagedCatalogList}
                            catalogAssetImages={catalogAssetImages}
                            loadingCatalogList={loadingCatalogList}
                            catalogListError={catalogListError}
                            isAdmin={isAdmin}
                            catalogPage={catalogPage}
                            catalogTotalPages={catalogTotalPages}
                            onRetry={loadCatalogList}
                            onOpenItem={openCatalogDetail}
                            onShowUploadModal={() => setShowUploadCatalogModal(true)}
                            onShowCreateModal={() => setShowCreateCatalogModal(true)}
                            onPrevPage={() => setCatalogPage((p) => Math.max(0, p - 1))}
                            onNextPage={() => setCatalogPage((p) => Math.min(catalogTotalPages - 1, p + 1))}
                        />
                    )}
                </>,
                fullViewContainer
            )}
        </>
    );
};

export default Catalog;
