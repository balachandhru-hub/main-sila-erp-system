import React from "react";
import { Button, EmptyState, Loader, Pagination } from "@vosox/shared-ui";
import type { SupplierCatalogListItem } from "../../dto/supplierDto";
import { CATALOG_PAGE_SIZE } from "../../hooks/useCatalogList";
import { IconGrid, IconUploadCloud, IconFileGeneric } from "./icons";

interface CatalogListProps {
    catalogList: SupplierCatalogListItem[];
    pagedCatalogList: SupplierCatalogListItem[];
    catalogAssetImages: Record<string, string>;
    loadingCatalogList: boolean;
    catalogListError: string | null;
    isAdmin: boolean;
    catalogPage: number;
    catalogTotalPages: number;
    onRetry: () => void;
    onOpenItem: (catalogId: string) => void;
    onShowUploadModal: () => void;
    onShowCreateModal: () => void;
    onPrevPage: () => void;
    onNextPage: () => void;
}

const CatalogList: React.FC<CatalogListProps> = ({
    catalogList,
    pagedCatalogList,
    catalogAssetImages,
    loadingCatalogList,
    catalogListError,
    isAdmin,
    catalogPage,
    catalogTotalPages,
    onRetry,
    onOpenItem,
    onShowUploadModal,
    onShowCreateModal,
    onPrevPage,
    onNextPage,
}) => {
    return (
        <>
            <div className="pud-catalog-fullview-header">
                <div>
                    <h1 className="pud-title">Your Catalogs</h1>
                    <p className="pud-subtitle pud-catalog-count">
                        <IconGrid aria-hidden="true" /> {catalogList.length} {catalogList.length === 1 ? "Item" : "Items"} in your supplier catalog
                    </p>
                </div>
                <div className="pud-catalog-fullview-actions">
                    {isAdmin && (
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onShowUploadModal}
                        >
                            <IconUploadCloud /> Upload Catalog
                        </Button>
                    )}
                    {isAdmin && (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={onShowCreateModal}
                        >
                            + Add Catalog
                        </Button>
                    )}
                </div>
            </div>

            {loadingCatalogList ? (
                <div className="pud-catalog-state-center">
                    <Loader size={24} message="Loading your catalogs..." />
                </div>
            ) : catalogListError ? (
                <div className="pud-catalog-state-center pud-catalog-state-padded">
                    <EmptyState
                        variant="error"
                        title={catalogListError}
                        action={
                            <button
                                type="button"
                                className="pud-btn pud-btn-outline sila-btn sila-btn--secondary"
                                onClick={onRetry}
                            >
                                Retry
                            </button>
                        }
                    />
                </div>
            ) : catalogList.length === 0 ? (
                <div className="pud-catalog-empty-state">
                    <EmptyState
                        icon={<IconGrid />}
                        title="No catalogs yet"
                        description={isAdmin
                            ? 'Use "Create Catalog" or "Upload Catalog" to add your first item.'
                            : 'No catalogs are currently available.'
                        }
                    />
                </div>
            ) : (
                <>
                    <div className="pud-catalog-grid">
                        {pagedCatalogList.map((item) => (
                            <div
                                className="pud-catalog-card"
                                key={item.id}
                                onClick={() => onOpenItem(item.id)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onOpenItem(item.id);
                                    }
                                }}
                                role="button"
                                tabIndex={0}
                                title={`View ${item.catalogName}`}
                            >
                                <div className="pud-catalog-card-media">
                                    {(() => {
                                        const firstAssetId = item.assets && item.assets[0]?.id;
                                        const imageSrc = firstAssetId ? catalogAssetImages[firstAssetId] : undefined;
                                        return imageSrc ? (
                                            <img src={imageSrc} alt={item.catalogName} />
                                        ) : (
                                            <div className="pud-catalog-card-media-placeholder" aria-hidden="true"><IconFileGeneric /></div>
                                        );
                                    })()}
                                </div>
                                <div className="pud-catalog-card-body">
                                    <div className="pud-catalog-card-name" title={item.catalogName}>{item.catalogName}</div>
                                    {item.description && (
                                        <div className="pud-catalog-card-desc">{item.description}</div>
                                    )}
                                    <div className="pud-catalog-card-meta">
                                        {!!item.price && (
                                            <span className="pud-catalog-card-price">
                                                {item.currency ? `${item.currency} ` : ""}{Number(item.price).toFixed(2)}
                                            </span>
                                        )}
                                        {item.unitOfMeasure && (
                                            <span className="pud-catalog-card-uom">{item.unitOfMeasure}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {catalogList.length > CATALOG_PAGE_SIZE && (
                        <Pagination
                            className="pud-catalog-pagination"
                            page={catalogPage + 1}
                            totalPages={catalogTotalPages}
                            onPrevious={onPrevPage}
                            onNext={onNextPage}
                        />
                    )}
                </>
            )}
        </>
    );
};

export default CatalogList;
