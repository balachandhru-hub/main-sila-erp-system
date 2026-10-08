import React, { useState } from "react";
import {
    createItemMaster,
    getMasterApprovalFlows,
    checkItemMasterSimilarity,
    uploadItemMasterFile,
    type ItemMasterDetailDto,
    type ItemMasterDto,
} from "../api/Buyerapi";
import {
    Loader,
    ItemMasterModal,
    type ItemMasterModalApi,
    ItemMasterUploadModal,
    type ItemMasterUploadModalApi,
    SearchInput,
    ChevronLeftIcon,
    Table,
    type TableColumn,
} from "@vosox/shared-ui";
import { FaPlus, FaUpload } from "react-icons/fa";
import { useItemMasterCatalog } from "../hooks/useItemMasterCatalog";
import "./ItemMasterCatalog.css";

const itemMasterModalApi: ItemMasterModalApi = { createItemMaster, getMasterApprovalFlows, checkItemMasterSimilarity };
const itemMasterUploadModalApi: ItemMasterUploadModalApi = { uploadItemMasterFile, getMasterApprovalFlows };

interface ItemMasterCatalogProps {
    buyerId: string;
    organizationId: string;
    onClose?: () => void;
}

const DETAIL_FIELDS: { key: keyof ItemMasterDetailDto; label: string }[] = [
    { key: "productType", label: "Product Type" },
    { key: "baseUnitOfMeasure", label: "Base Unit of Measure" },
    { key: "orderUnitOfMeasure", label: "Order Unit of Measure" },
    { key: "alternateUnitOfMeasure", label: "Alternate Unit of Measure" },
    { key: "valuationClass", label: "Valuation Class" },
    { key: "unitOfMeasureMapping", label: "Unit of Measure Mapping" },
    { key: "subUnit", label: "Sub Unit" },
    { key: "microUnit", label: "Micro Unit" },
];

const ItemMasterCatalog: React.FC<ItemMasterCatalogProps> = ({ buyerId, organizationId, onClose }) => {
    const [showItemMasterModal, setShowItemMasterModal] = useState(false);
    const [showItemMasterUploadModal, setShowItemMasterUploadModal] = useState(false);

    const {
        itemMasters,
        showListView,
        selectedItemDetail,
        loading,
        detailLoading,
        error,
        detailError,
        searchQuery,
        setSearchQuery,
        itemMasterPage,
        itemMasterHasMore,
        startIndex,
        fetchItemMasters,
        handleItemMasterNextPage,
        handleItemMasterPrevPage,
        handleRowClick,
        handleBackToList,
    } = useItemMasterCatalog(buyerId);

    const columns: TableColumn<ItemMasterDto>[] = [
        { id: "sno", header: "S.No", headerClassName: "imc-col-index", align: "right", cell: ({ rowIndex }) => startIndex + rowIndex + 1 },
        { id: "material", header: "Material", cell: ({ row }) => <span className="sila-ref">{row.materialCode}</span> },
        { id: "description", header: "Description", accessorKey: "description" },
        { id: "group", header: "Group", accessorKey: "materialGroup" },
    ];

    const handleAddItemMasterClick = () => {
        setShowItemMasterModal(true);
    };

    const handleUploadItemMasterClick = () => {
        setShowItemMasterUploadModal(true);
    };

    return (
        <div className="imc-container">
            {!showListView ? (
                    <>
                    <div className="detail-header">
                        <button
                            type="button"
                            className="back-button"
                            onClick={handleBackToList}
                            title="Go back to list"
                            aria-label="Go back"
                        >
                            <ChevronLeftIcon className="back-icon" width={undefined} height={undefined} />
                        </button>

                        <div className="detail-header-title">
                            <h2 className="imc-title">Material Details</h2>
                        </div>

                    </div>

                    <div className="imc-page">

                    {detailLoading ? (
                        <div className="imc-loading-state">
                            <Loader size={28} message="Loading details..." />
                        </div>
                    ) : detailError ? (
                        <div className="imc-error-banner" role="alert">
                            <span>{detailError}</span>
                        </div>
                    ) : selectedItemDetail ? (
                        <div className="detail-card">
                            {DETAIL_FIELDS.map(({ key, label }) => {
                                const value = selectedItemDetail[key];
                                return (
                                    <div className="detail-field" key={String(key)}>
                                        <span className="label">{label}</span>
                                        <span className={`value${value ? "" : " value-empty"}`}>
                                            {value ? String(value) : "-"}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    ) : null}
                    </div>
                    </>
            ) : (
                <div className="imc-page">
                    <div className="imc-header">
                        <div>
                            <h1 className="imc-title">Material Master</h1>
                            <p className="imc-subtitle">Browse and manage item masters for your organization.</p>
                        </div>

                        <div className="imc-header-actions">
                            {onClose && (
                                <button type="button" className="imc-btn-secondary sila-btn sila-btn--secondary" onClick={onClose}>
                                    Close
                                </button>
                            )}

                            <button type="button" className="imc-btn-secondary sila-btn sila-btn--secondary" onClick={handleUploadItemMasterClick}>
                                <FaUpload aria-hidden="true" />
                                Upload Item Master
                            </button>

                            <button type="button" className="imc-btn-primary sila-btn sila-btn--primary" onClick={handleAddItemMasterClick}>
                                <FaPlus aria-hidden="true" />
                                Add Item Master
                            </button>
                        </div>
                    </div>

                    <Table<ItemMasterDto>
                        columns={columns}
                        data={itemMasters}
                        getRowId={(item) => item.id}
                        loading={loading}
                        loadingLabel="Loading item masters…"
                        error={error ?? undefined}
                        errorAction={
                            <button type="button" className="imc-btn-retry sila-btn sila-btn--secondary sila-btn--sm" onClick={() => fetchItemMasters(itemMasterPage)}>
                                Retry
                            </button>
                        }
                        alwaysShowHeader
                        emptyState={{
                            title: "No item masters found.",
                            action: (
                                <button type="button" className="imc-btn-primary sila-btn sila-btn--primary" onClick={handleAddItemMasterClick}>
                                    <FaPlus aria-hidden="true" />
                                    Add Item Master
                                </button>
                            ),
                        }}
                        onRowClick={(item) => handleRowClick(item.id)}
                        className="imc-table"
                        headerComponent={
                            <SearchInput
                                placeholder="Search by material, description, or group..."
                                label="Search item masters"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        }
                        pagination={
                            itemMasters.length > 0
                                ? {
                                      page: itemMasterPage,
                                      hasNext: itemMasterHasMore,
                                      onPrevious: handleItemMasterPrevPage,
                                      onNext: handleItemMasterNextPage,
                                      disabled: loading,
                                      summary: `Page ${itemMasterPage}`,
                                  }
                                : undefined
                        }
                    />
                </div>
            )}

            <ItemMasterModal
                isOpen={showItemMasterModal}
                onClose={() => setShowItemMasterModal(false)}
                buyerId={buyerId}
                api={itemMasterModalApi}
                onSuccess={() => {
                    fetchItemMasters(1);
                    handleBackToList();
                }}
            />

            <ItemMasterUploadModal
                isOpen={showItemMasterUploadModal}
                onClose={() => setShowItemMasterUploadModal(false)}
                buyerId={buyerId}
                organizationId={organizationId}
                api={itemMasterUploadModalApi}
                onSuccess={() => {
                    fetchItemMasters(1);
                    handleBackToList();
                }}
            />
        </div>
    );
};

export default ItemMasterCatalog;
