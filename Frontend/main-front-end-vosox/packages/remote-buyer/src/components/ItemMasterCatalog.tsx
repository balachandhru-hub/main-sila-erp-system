import React, { useEffect, useState } from "react";
import {
    getAllItemMasters,
    getItemMasterById,
    createItemMaster,
    getMasterApprovalFlows,
    checkItemMasterSimilarity,
    uploadItemMasterFile,
    type ItemMasterDto,
    type ItemMasterDetailDto,
} from "../api/Buyerapi";
import {
    EmptyState,
    Loader,
    isErrorResponse,
    toastService,
    ItemMasterModal,
    type ItemMasterModalApi,
    ItemMasterUploadModal,
    type ItemMasterUploadModalApi,
    SearchInput,
    ChevronLeftIcon,
    ChevronRightIcon,
} from "@vosox/shared-ui";
import { FaPlus, FaUpload } from "react-icons/fa";
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
    const [itemMasters, setItemMasters] = useState<ItemMasterDto[]>([]);
    const [showListView, setShowListView] = useState(true);
    const [selectedItemDetail, setSelectedItemDetail] = useState<ItemMasterDetailDto | null>(null);
    const [showItemMasterModal, setShowItemMasterModal] = useState(false);
    const [showItemMasterUploadModal, setShowItemMasterUploadModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [detailError, setDetailError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [itemMasterPage, setItemMasterPage] = useState(1);
    const[itemMasterHasMore, setItemMasterHasMore] = useState(true);
    const ITEM_MASTER_PAGE_SIZE=10;

    const fetchItemMasters = async (page:number) => {
        if (!buyerId) return;

        setLoading(true);
        setError(null);
        const index = (page - 1) * ITEM_MASTER_PAGE_SIZE;
        const limit = ITEM_MASTER_PAGE_SIZE+1;

        try {
            const result = await getAllItemMasters(buyerId, index, limit,searchQuery.trim());
            const resolved = result?.data?.data || result?.data || result || [];
            const hasMore = Array.isArray(resolved) && resolved.length > ITEM_MASTER_PAGE_SIZE;

            const pageItems = hasMore
             ? resolved.slice(0, ITEM_MASTER_PAGE_SIZE)
             : resolved;

            setItemMasters(pageItems);
            setItemMasterPage(page);
            setItemMasterHasMore(hasMore);
        } catch (err: any) {
            const message = err?.message || "Failed to load item masters.";
            setError(message);
            toastService.error(message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchItemMasters(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buyerId,searchQuery]);

    const handleItemMasterNextPage = () => {
       if (loading || !itemMasterHasMore) return;
       fetchItemMasters(itemMasterPage + 1);
    };

    const handleItemMasterPrevPage = () => {
       if (loading || itemMasterPage <= 1) return;
       fetchItemMasters(itemMasterPage - 1);
    };

    const startIndex = (itemMasterPage - 1) * ITEM_MASTER_PAGE_SIZE;

    const handleRowClick = async (id: string) => {
        setShowListView(false);
        setDetailLoading(true);
        setDetailError(null);

        const result = await getItemMasterById(id);

        if (isErrorResponse(result)) {
            const message = result.message || "Failed to load item master details.";
            setDetailError(message);
            toastService.error(message);
            setSelectedItemDetail(null);
            setDetailLoading(false);
            return;
        }

        setSelectedItemDetail(result as ItemMasterDetailDto);
        setDetailLoading(false);
    };

    const handleBackToList = () => {
        setShowListView(true);
        setSelectedItemDetail(null);
        setDetailError(null);
    };

    const handleAddItemMasterClick = () => {
        setShowItemMasterModal(true);
    };

    const handleUploadItemMasterClick = () => {
        setShowItemMasterUploadModal(true);
    };

    return (
        <div className="imc-container">
            {error && (
                <div className="imc-error-banner" role="alert">
                    <span>{error}</span>
                    <button type="button" className="imc-btn-retry sila-btn sila-btn--secondary sila-btn--sm" onClick={() => fetchItemMasters(itemMasterPage)}>
                        Retry
                    </button>
                </div>
            )}

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

                    <SearchInput
                             containerClassName="ua-search-wrapper"
                             className="ua-search-input"
                             placeholder="Search by material, description, or group..."
                             label="Search item masters"
                             value={searchQuery}
                             onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    {loading ? (
                        <div className="imc-loading-state">
                            <Loader size={28} message="Loading item masters..." />
                        </div>
                    ) : itemMasters.length === 0 ? (
                        <EmptyState
                            className="imc-empty-state"
                            title="No item masters found."
                            action={
                                <button type="button" className="imc-btn-primary sila-btn sila-btn--primary" onClick={handleAddItemMasterClick}>
                                    <FaPlus aria-hidden="true" />
                                    Add Item Master
                                </button>
                            }
                        />
                    ) : (
                        <>
                        <div className="item-master-table-container">
                            <table className="item-master-table">
                                <thead>
                                    <tr>
                                        <th scope="col" className="imc-col-index">S.No</th>
                                        <th scope="col">Material</th>
                                        <th scope="col">Description</th>
                                        <th scope="col">Group</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {itemMasters.map((item, index) => (
                                        <tr
                                            key={item.id}
                                            tabIndex={0}
                                            onClick={() => handleRowClick(item.id)}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") handleRowClick(item.id);
                                            }}
                                        >   
                                            <td className="imc-col-index">{startIndex + index + 1}</td>
                                            <td><span className="sila-ref">{item.materialCode}</span></td>
                                            <td>{item.description}</td>
                                            <td>{item.materialGroup}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="imc-pagination">
                                  <button
                                    className="imc-pagination-button"
                                    type="button"
                                    onClick={handleItemMasterPrevPage}
                                    disabled={itemMasterPage <= 1 || loading}
                                  >
                                  <ChevronLeftIcon className="back-icon" width={undefined} height={undefined} />
                                  </button>

                                  <span className="imc-pagination-number">
                                    Page {itemMasterPage}
                                  </span>

                                  <button
                                     className="imc-pagination-button"
                                     type="button"
                                     onClick={handleItemMasterNextPage}
                                     disabled={!itemMasterHasMore || loading}
                                   >
                                   <ChevronRightIcon />
                                   </button>
                                 </div>
                       </>
                    )}
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
