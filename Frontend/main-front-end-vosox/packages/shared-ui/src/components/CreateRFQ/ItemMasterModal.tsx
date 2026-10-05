import React, { useRef, useState } from "react";
import { toastService } from "../../services/toastservice";
import Dropdown from "../DropDown/DropDown";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "../DropDown/DropDown.types";
import { FaTimes } from "react-icons/fa";
import "./ItemMasterModal.css";
import type { ItemMasterModalApi, MasterApprovalFlowDto, ItemMasterSimilarityDto } from "./types";

// Page size used by the async (paginated) Approval Flow Dropdown
const APPROVAL_FLOW_PAGE_SIZE = 40;

interface ItemMasterModalProps {
    isOpen: boolean;
    onClose: () => void;
    buyerId: string;
    api: ItemMasterModalApi;
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

const ItemMasterModal: React.FC<ItemMasterModalProps> = ({
    isOpen,
    onClose,
    buyerId,
    api,
    onSuccess,
}) => {
    const [description, setDescription] = useState("");
    const [materialCode, setMaterialCode] = useState("");
    const [materialGroup, setMaterialGroup] = useState("");
    const [productType, setProductType] = useState("");
    const [baseUnitOfMeasure, setBaseUnitOfMeasure] = useState("");
    const [orderUnitOfMeasure, setOrderUnitOfMeasure] = useState("");
    const [alternateUnitOfMeasure, setAlternateUnitOfMeasure] = useState("");
    const [valuationClass, setValuationClass] = useState("");
    const [unitOfMeasureMapping, setUnitOfMeasureMapping] = useState("");
    const [subUnit, setSubUnit] = useState("");
    const [microUnit, setMicroUnit] = useState("");
    const [selectedApprovalFlow, setSelectedApprovalFlow] = useState<DropdownValue | null>(null);
    const approvalFlowId = selectedApprovalFlow?.value || "";
    const [comment, setComment] = useState("");

    const [approvalFlowError, setApprovalFlowError] = useState("");

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [similarItemMasters, setSimilarItemMasters] = useState<ItemMasterSimilarityDto[]>([]);
    const [isCheckingSimilarity, setIsCheckingSimilarity] = useState(false);
    const [similarityError, setSimilarityError] = useState("");
    // Tracks the (materialGroup, description) pair the last similarity check ran for, so
    // re-focusing/blurring a field without changing its value doesn't re-hit the API.
    const lastSimilarityCheckRef = useRef<{ materialGroup: string; description: string } | null>(null);

    if (!isOpen) {
        return null;
    }

    // ---- Async paginated loader for the Approval Flow Dropdown (server has no search param, so search client-side) ----
    // `index` is an offset: 0, then 0 + 40, then 0 + 40 + 40, ...
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
                // Page through every approval flow so a match on a later page isn't missed, then filter here
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

    // Fires when both Material group and Description have a value and either field loses focus.
    // Surfaces existing item masters that look like duplicates; it never blocks submission.
    const checkSimilarity = async () => {
        const trimmedMaterialGroup = materialGroup.trim();
        const trimmedDescription = description.trim();

        if (!trimmedMaterialGroup || !trimmedDescription || !buyerId) {
            return;
        }

        const lastChecked = lastSimilarityCheckRef.current;
        if (lastChecked && lastChecked.materialGroup === trimmedMaterialGroup && lastChecked.description === trimmedDescription) {
            return;
        }
        lastSimilarityCheckRef.current = { materialGroup: trimmedMaterialGroup, description: trimmedDescription };

        setIsCheckingSimilarity(true);
        setSimilarityError("");

        try {
            const matches = await api.checkItemMasterSimilarity(buyerId, trimmedDescription, trimmedMaterialGroup);
            setSimilarItemMasters(matches);
        } catch (error: any) {
            setSimilarItemMasters([]);
            setSimilarityError(error?.message || "Failed to check for similar item masters.");
        } finally {
            setIsCheckingSimilarity(false);
        }
    };

    const resetForm = () => {
        setDescription("");
        setMaterialCode("");
        setMaterialGroup("");
        setProductType("");
        setBaseUnitOfMeasure("");
        setOrderUnitOfMeasure("");
        setAlternateUnitOfMeasure("");
        setValuationClass("");
        setUnitOfMeasureMapping("");
        setSubUnit("");
        setMicroUnit("");
        setSelectedApprovalFlow(null);
        setComment("");
        setErrors({});
        setSimilarItemMasters([]);
        setSimilarityError("");
        lastSimilarityCheckRef.current = null;
    };

    const handleClose = () => {
        if (isSubmitting) return;

        resetForm();
        onClose();
    };

    const validateForm = () => {
        const newErrors: Record<string, string> = {};

        if (!materialCode.trim()) newErrors.materialCode = "Please enter material code";
        if (!materialGroup.trim()) newErrors.materialGroup = "Please enter material group";
        if (!productType.trim()) newErrors.productType = "Please enter product type";
        if (!description.trim()) newErrors.description = "Please enter description";
        if (!baseUnitOfMeasure.trim()) newErrors.baseUnitOfMeasure = "Please enter base unit of measure";
        if (!orderUnitOfMeasure.trim()) newErrors.orderUnitOfMeasure = "Please enter order unit of measure";
        if (!alternateUnitOfMeasure.trim()) newErrors.alternateUnitOfMeasure = "Please enter alternate unit of measure";
        if (!valuationClass.trim()) newErrors.valuationClass = "Please enter valuation class";
        if (!unitOfMeasureMapping.trim()) newErrors.unitOfMeasureMapping = "Please enter unit of measure mapping";
        if (!approvalFlowId) newErrors.approvalFlowId = "Please select an approval flow";
        if (!comment.trim()) newErrors.comment = "Please add a comment";

        // Sub Unit and Micro Unit are optional - no validation needed

        return newErrors;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const newErrors = validateForm();

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        if (!buyerId) {
            toastService.error("Buyer profile could not be loaded.");
            return;
        }

        setIsSubmitting(true);

        try {
            await api.createItemMaster({
                buyerId,
                description: description.trim(),
                materialCode: materialCode.trim(),
                materialGroup: materialGroup.trim(),
                productType: productType.trim(),
                baseUnitOfMeasure: baseUnitOfMeasure.trim(),
                orderUnitOfMeasure: orderUnitOfMeasure.trim(),
                alternateUnitOfMeasure: alternateUnitOfMeasure.trim(),
                valuationClass: valuationClass.trim(),
                unitOfMeasureMapping: unitOfMeasureMapping.trim(),
                subUnit: subUnit.trim() || undefined,
                microUnit: microUnit.trim() || undefined,
                approvalFlowId,
                comment: comment.trim(),
            });

            toastService.success("Item Master created successfully.");

            resetForm();
            onSuccess?.();
            onClose();
        } catch (error: any) {
            toastService.error(
                error?.message || "Failed to create Item Master."
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div
            className="item-master-modal-overlay"
            onClick={handleClose}
        >
            <div
                className="item-master-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="item-master-modal-title"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="item-master-modal-header">
                    <div>
                        <h2 className="item-master-modal-title" id="item-master-modal-title">
                            Add Item Master
                        </h2>

                        <p className="item-master-modal-subtitle">
                            Create a new item master for your organization.
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

                <form
                    className="item-master-modal-form"
                    onSubmit={handleSubmit}
                >
                    <div className="item-master-modal-body">
                    {/* Material Code */}
                    <div className="item-master-field">
                        <label htmlFor="item-master-material-code">
                            Material code <span className="sila-required" aria-hidden="true">*</span>
                        </label>

                        <input
                            id="item-master-material-code"
                            type="text"
                            placeholder="Enter material code"
                            value={materialCode}
                            aria-invalid={errors.materialCode ? true : undefined}
                            aria-describedby={errors.materialCode ? "item-master-error-materialCode" : undefined}
                            className={errors.materialCode ? "item-master-input-error" : ""}
                            onChange={(e) => {
                                setMaterialCode(e.target.value);
                                clearFieldError(setErrors, "materialCode");
                            }}
                        />

                        {errors.materialCode && (
                            <div className="item-master-error" id="item-master-error-materialCode">
                                {errors.materialCode}
                            </div>
                        )}
                    </div>

                    {/* Material Group, Product Type */}
                    <div className="item-master-fields-row">
                        <div className="item-master-field">
                            <label htmlFor="item-master-material-group">
                                Material group <span className="sila-required" aria-hidden="true">*</span>
                            </label>

                            <input
                                id="item-master-material-group"
                                type="text"
                                placeholder="Enter material group"
                                value={materialGroup}
                                aria-invalid={errors.materialGroup ? true : undefined}
                                aria-describedby={errors.materialGroup ? "item-master-error-materialGroup" : undefined}
                                className={errors.materialGroup ? "item-master-input-error" : ""}
                                onChange={(e) => {
                                    setMaterialGroup(e.target.value);
                                    clearFieldError(setErrors, "materialGroup");
                                    setSimilarItemMasters([]);
                                    setSimilarityError("");
                                }}
                                onBlur={checkSimilarity}
                            />

                            {errors.materialGroup && (
                                <div className="item-master-error" id="item-master-error-materialGroup">
                                    {errors.materialGroup}
                                </div>
                            )}
                        </div>

                        <div className="item-master-field">
                            <label htmlFor="item-master-product-type">
                                Product type <span className="sila-required" aria-hidden="true">*</span>
                            </label>

                            <input
                                id="item-master-product-type"
                                type="text"
                                placeholder="Enter product type"
                                value={productType}
                                aria-invalid={errors.productType ? true : undefined}
                                aria-describedby={errors.productType ? "item-master-error-productType" : undefined}
                                className={errors.productType ? "item-master-input-error" : ""}
                                onChange={(e) => {
                                    setProductType(e.target.value);
                                    clearFieldError(setErrors, "productType");
                                }}
                            />

                            {errors.productType && (
                                <div className="item-master-error" id="item-master-error-productType">
                                    {errors.productType}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div className="item-master-field">
                        <label htmlFor="item-master-description">
                            Description <span className="sila-required" aria-hidden="true">*</span>
                        </label>

                        <input
                            id="item-master-description"
                            type="text"
                            placeholder="Enter description"
                            value={description}
                            aria-invalid={errors.description ? true : undefined}
                            aria-describedby={errors.description ? "item-master-error-description" : undefined}
                            className={errors.description ? "item-master-input-error" : ""}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                clearFieldError(setErrors, "description");
                                setSimilarItemMasters([]);
                                setSimilarityError("");
                            }}
                            onBlur={checkSimilarity}
                        />

                        {errors.description && (
                            <div className="item-master-error" id="item-master-error-description">
                                {errors.description}
                            </div>
                        )}

                        {isCheckingSimilarity && (
                            <div className="item-master-field-hint">Checking for similar item masters...</div>
                        )}

                        {!isCheckingSimilarity && similarityError && (
                            <div className="item-master-field-hint item-master-field-hint-error">
                                {similarityError}
                            </div>
                        )}

                        {!isCheckingSimilarity && !similarityError && similarItemMasters.length > 0 && (
                            <div className="sila-alert item-master-similarity-alert" role="status">
                                <div>
                                    <p className="item-master-similarity-title">
                                        Similar item masters already exist. You can continue with one of these instead of creating a new one:
                                    </p>

                                    <ul className="item-master-similarity-list">
                                        {similarItemMasters.map((item) => (
                                            <li key={item.id}>
                                                <span className="item-master-similarity-code">{item.materialCode}</span>
                                                <span className="item-master-similarity-desc">{item.description}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>

                    <hr className="item-master-section-divider" />

                    {/* Base UOM, Order UOM */}
                    <div className="item-master-fields-row">
                        <div className="item-master-field">
                            <label htmlFor="item-master-base-uom">
                                Base unit of measure <span className="sila-required" aria-hidden="true">*</span>
                            </label>

                            <input
                                id="item-master-base-uom"
                                type="text"
                                placeholder="e.g., KG, L, M"
                                value={baseUnitOfMeasure}
                                aria-invalid={errors.baseUnitOfMeasure ? true : undefined}
                                aria-describedby={errors.baseUnitOfMeasure ? "item-master-error-baseUnitOfMeasure" : undefined}
                                className={errors.baseUnitOfMeasure ? "item-master-input-error" : ""}
                                onChange={(e) => {
                                    setBaseUnitOfMeasure(e.target.value);
                                    clearFieldError(setErrors, "baseUnitOfMeasure");
                                }}
                            />

                            {errors.baseUnitOfMeasure && (
                                <div className="item-master-error" id="item-master-error-baseUnitOfMeasure">
                                    {errors.baseUnitOfMeasure}
                                </div>
                            )}
                        </div>

                        <div className="item-master-field">
                            <label htmlFor="item-master-order-uom">
                                Order unit of measure <span className="sila-required" aria-hidden="true">*</span>
                            </label>

                            <input
                                id="item-master-order-uom"
                                type="text"
                                placeholder="e.g., BOX, CASE, PACK"
                                value={orderUnitOfMeasure}
                                aria-invalid={errors.orderUnitOfMeasure ? true : undefined}
                                aria-describedby={errors.orderUnitOfMeasure ? "item-master-error-orderUnitOfMeasure" : undefined}
                                className={errors.orderUnitOfMeasure ? "item-master-input-error" : ""}
                                onChange={(e) => {
                                    setOrderUnitOfMeasure(e.target.value);
                                    clearFieldError(setErrors, "orderUnitOfMeasure");
                                }}
                            />

                            {errors.orderUnitOfMeasure && (
                                <div className="item-master-error" id="item-master-error-orderUnitOfMeasure">
                                    {errors.orderUnitOfMeasure}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Alternate UOM, Valuation Class */}
                    <div className="item-master-fields-row">
                        <div className="item-master-field">
                            <label htmlFor="item-master-alternate-uom">
                                Alternate unit of measure <span className="sila-required" aria-hidden="true">*</span>
                            </label>

                            <input
                                id="item-master-alternate-uom"
                                type="text"
                                placeholder="e.g., PCS"
                                value={alternateUnitOfMeasure}
                                aria-invalid={errors.alternateUnitOfMeasure ? true : undefined}
                                aria-describedby={errors.alternateUnitOfMeasure ? "item-master-error-alternateUnitOfMeasure" : undefined}
                                className={errors.alternateUnitOfMeasure ? "item-master-input-error" : ""}
                                onChange={(e) => {
                                    setAlternateUnitOfMeasure(e.target.value);
                                    clearFieldError(setErrors, "alternateUnitOfMeasure");
                                }}
                            />

                            {errors.alternateUnitOfMeasure && (
                                <div className="item-master-error" id="item-master-error-alternateUnitOfMeasure">
                                    {errors.alternateUnitOfMeasure}
                                </div>
                            )}
                        </div>

                        <div className="item-master-field">
                            <label htmlFor="item-master-valuation-class">
                                Valuation class <span className="sila-required" aria-hidden="true">*</span>
                            </label>

                            <input
                                id="item-master-valuation-class"
                                type="text"
                                placeholder="Enter valuation class"
                                value={valuationClass}
                                aria-invalid={errors.valuationClass ? true : undefined}
                                aria-describedby={errors.valuationClass ? "item-master-error-valuationClass" : undefined}
                                className={errors.valuationClass ? "item-master-input-error" : ""}
                                onChange={(e) => {
                                    setValuationClass(e.target.value);
                                    clearFieldError(setErrors, "valuationClass");
                                }}
                            />

                            {errors.valuationClass && (
                                <div className="item-master-error" id="item-master-error-valuationClass">
                                    {errors.valuationClass}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Unit of Measure Mapping */}
                    <div className="item-master-field">
                        <label htmlFor="item-master-uom-mapping">
                            Unit of measure mapping <span className="sila-required" aria-hidden="true">*</span>
                        </label>

                        <input
                            id="item-master-uom-mapping"
                            type="text"
                            placeholder="e.g., 1 BOX = 400PCS"
                            value={unitOfMeasureMapping}
                            aria-invalid={errors.unitOfMeasureMapping ? true : undefined}
                            aria-describedby={errors.unitOfMeasureMapping ? "item-master-error-unitOfMeasureMapping" : undefined}
                            className={errors.unitOfMeasureMapping ? "item-master-input-error" : ""}
                            onChange={(e) => {
                                setUnitOfMeasureMapping(e.target.value);
                                clearFieldError(setErrors, "unitOfMeasureMapping");
                            }}
                        />

                        {errors.unitOfMeasureMapping && (
                            <div className="item-master-error" id="item-master-error-unitOfMeasureMapping">
                                {errors.unitOfMeasureMapping}
                            </div>
                        )}
                    </div>

                    {/* Sub Unit, Micro Unit (optional) */}
                    <div className="item-master-fields-row">
                        <div className="item-master-field">
                            <label htmlFor="item-master-sub-unit">
                                Sub unit
                            </label>

                            <input
                                id="item-master-sub-unit"
                                type="text"
                                placeholder="Enter sub unit (optional)"
                                value={subUnit}
                                onChange={(e) => setSubUnit(e.target.value)}
                            />
                        </div>

                        <div className="item-master-field">
                            <label htmlFor="item-master-micro-unit">
                                Micro unit
                            </label>

                            <input
                                id="item-master-micro-unit"
                                type="text"
                                placeholder="Enter micro unit (optional)"
                                value={microUnit}
                                onChange={(e) => setMicroUnit(e.target.value)}
                            />
                        </div>
                    </div>

                    <hr className="item-master-section-divider" />

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
                        <label htmlFor="item-master-comment">
                            Comment <span className="sila-required" aria-hidden="true">*</span>
                        </label>

                        <textarea
                            id="item-master-comment"
                            rows={3}
                            placeholder="Add comments or notes"
                            value={comment}
                            aria-invalid={errors.comment ? true : undefined}
                            aria-describedby={errors.comment ? "item-master-error-comment" : undefined}
                            className={errors.comment ? "item-master-input-error" : ""}
                            onChange={(e) => {
                                setComment(e.target.value);
                                clearFieldError(setErrors, "comment");
                            }}
                        />

                        {errors.comment && (
                            <div className="item-master-error" id="item-master-error-comment">
                                {errors.comment}
                            </div>
                        )}
                    </div>
                    </div>

                    {/* Footer */}
                    <div className="item-master-modal-footer">
                        <button
                            type="button"
                            className="item-master-cancel-btn"
                            onClick={handleClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>

                        <button
                            type="submit"
                            className="item-master-create-btn"
                            disabled={isSubmitting}
                        >
                            {isSubmitting
                                ? "Creating..."
                                : "Create Item Master"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ItemMasterModal;
