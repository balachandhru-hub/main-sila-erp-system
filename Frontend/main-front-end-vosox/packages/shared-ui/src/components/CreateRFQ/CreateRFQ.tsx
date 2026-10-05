import React, { useRef, useState, useEffect } from "react";
import "./CreateRFQ.css";
import { Button } from "../Button";
import Dropdown from "../DropDown/DropDown";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "../DropDown/DropDown.types";
import { toastService } from "../../services/toastservice";
import { DateTimePicker } from "../DateTimePicker/DateTimePicker";
import { StatusBadge } from "../StatusBadge";
import { Loader } from "../Loader";
import { FaCloudUploadAlt, FaFileAlt, FaShieldAlt, FaTimes } from "react-icons/fa";
import ItemMasterModal from "./ItemMasterModal";
import ItemMasterUploadModal from "./ItemMasterUploadModal";
import SupplierUsersModal from "./SupplierUsersModal";
import ExternalSupplierModal, { type ExternalSupplierFormValues } from "./ExternalSupplierModal";
import type {
    CreateRFQApi,
    CreateRFQPayload,
    CountryDto,
    CurrencyDto,
    ExternalSupplierDto,
    RfqDocumentAssetDto,
    RfqItemDto,
    RfqQuestionDto,
    SupplierInviteDto,
    SupplierVerificationType,
    UnitDto,
    VerificationTemplate,
    VerifiedSupplierDto,
} from "./types";


const HARDCODED_RFQ_VERIFICATION_TEMPLATE_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

interface LineItem {
    id: string;
    description: string;
    quantity: number;
    uom: string;
    price: string;
    materialCode: string;
}

type StepKey = "details" | "suppliers" | "summary";

type FieldType = "INPUT" | "RADIO_BUTTON" | "CHECK_BOX" | "FILE";

interface CustomField {
    id: string;
    label: string;
    type: FieldType;
    options: string[];
}


const IconTrash = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

const IconPlus = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const IconList = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="8" y1="6" x2="21" y2="6" />
        <line x1="8" y1="12" x2="21" y2="12" />
        <line x1="8" y1="18" x2="21" y2="18" />
        <line x1="3" y1="6" x2="3.01" y2="6" />
        <line x1="3" y1="12" x2="3.01" y2="12" />
        <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
);

const IconSourcing = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 10 10" />
        <path d="M12 2v10l7 4" />
    </svg>
);


const IconArrowRight = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
    </svg>
);

const IconSearch = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const IconCheckCircle = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <polyline points="16 9 10.5 15 8 12.5" />
    </svg>
);

const IconXCircle = () => (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="14.5" y1="9.5" x2="9.5" y2="14.5" />
        <line x1="9.5" y1="9.5" x2="14.5" y2="14.5" />
    </svg>
);

const IconMail = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 6-10 7L2 6" />
    </svg>
);

const IconSend = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
);

const IconEye = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <circle cx="12" cy="12" r="3" />
    </svg>
);

const IconCheckBig = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const steps: { key: StepKey; label: string }[] = [
    { key: "details", label: "RFQ Details" },
    { key: "suppliers", label: "Select Suppliers" },
    { key: "summary", label: "Summary & Dispatch" },
];

const initialLineItems: LineItem[] = [];

const initialCustomFields: CustomField[] = [];


// Page size used by every async (paginated) Dropdown
const DROPDOWN_PAGE_SIZE = 40;

/* ---------------------------------- Helpers ---------------------------------- */

const fileToBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.includes(",") ? result.split(",")[1] : result;
            resolve(base64);
        };
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
    });

const buildDocumentAsset = async (
    file: File,
    entityId: string,
    assetType: string
): Promise<RfqDocumentAssetDto> => {
    const fileBytes = await fileToBase64(file);
    return {
        entityType: "RFQ",
        entityId: entityId || "",
        assetType,
        fileBytes,
        fileName: file.name,
        contentType: file.type || "application/octet-stream",
        isSingletonAsset: false,
    };
};


const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatLabel = (value: string | undefined | null): string => {
    if (!value) return "";
    return value
        .trim()
        .replace(/\s+/g, " ")
        .split(" ")
        .map((word) => (word.length > 0 ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
        .join(" ");
};


const getNowDateTimeLocalString = (): string => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d}T${hh}:${mm}`;
};

const getMaterialCodeDescription = (m: any): string => {
    if (!m || typeof m === "string") return "";
    return m.description || m.Description || m.itemDescription || m.materialDescription || m.itemMasterDescription || "";
};

const SUPPLIER_FILTER_OPTIONS: { name: string; value: "ALL" | SupplierVerificationType }[] = [
    { name: "All Suppliers", value: "ALL" },
    { name: "Verified", value: "VERIFIED" },
    { name: "Unverified", value: "UNVERIFIED" },
];

/* ---------------------------------- Component ---------------------------------- */

interface CreateRFQProps {
    onNavClick: (key: string) => void;
    onRfqCreated: () => Promise<void>;
    api: CreateRFQApi;
}

const CreateRFQ: React.FC<CreateRFQProps> = ({ onNavClick, onRfqCreated, api }) => {
    const [activeStep, setActiveStep] = useState<StepKey>("details");

    const [buyerProfileId, setBuyerProfileId] = useState<string>("");
    const [buyerOrganizationId, setBuyerOrganizationId] = useState<string>("");

    const [rfqTitle, setRfqTitle] = useState("");
    const [department, setDepartment] = useState("");

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const profile = await api.getBuyerProfile();
                if (profile?.id) {
                    setBuyerProfileId(profile.id);
                }
                if (profile?.organizationId) {
                    setBuyerOrganizationId(profile.organizationId);
                }
            } catch (err) {

            }
        };
        fetchInitialData();
    }, []);
    const [costCenter, setCostCenter] = useState("");

    const [departmentLabel, setDepartmentLabel] = useState("");

    const getDeptName = (d: any, idx: number) =>
        typeof d === "string" ? d : (d.department || d.name || d.Name || `Dept ${idx}`);
    const getDeptId = (d: any, idx: number) =>
        typeof d === "string" ? d : (d.id || getDeptName(d, idx));

    // ---- Async paginated loader for the Department Dropdown (`index` is an offset: 0, 40, 80, ...) ----
    const loadDepartmentOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        if (!buyerProfileId) {
            return { options: [], hasMore: false };
        }
        const res = await api.getAllDepartments(buyerProfileId, page * DROPDOWN_PAGE_SIZE, DROPDOWN_PAGE_SIZE, search || undefined);
        const data = res?.data?.data || res?.data || res || [];
        const departments: any[] = Array.isArray(data) ? data : [];
        return {
            options: departments.map((d, idx) => ({ name: formatLabel(getDeptName(d, idx)), value: String(getDeptId(d, idx)) })),
            hasMore: departments.length === DROPDOWN_PAGE_SIZE,
        };
    };

    const [costCenterLabel, setCostCenterLabel] = useState("");

    const getCcName = (c: any, idx: number) =>
        typeof c === "string" ? c : (c.costCenter || c.name || c.Name || `CC ${idx}`);
    const getCcId = (c: any, idx: number) =>
        typeof c === "string" ? c : (c.id || getCcName(c, idx));

    // ---- Async paginated loader for the Cost Center Dropdown (`index` is an offset: 0, 40, 80, ...) ----
    const loadCostCenterOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        if (!department) {
            return { options: [], hasMore: false };
        }
        const res = await api.getAllCostCenters(department, page * DROPDOWN_PAGE_SIZE, DROPDOWN_PAGE_SIZE, search || undefined);
        const data = res?.data?.data || res?.data || res || [];
        const costCenters: any[] = Array.isArray(data) ? data : [];
        return {
            options: costCenters.map((c, idx) => ({ name: formatLabel(getCcName(c, idx)), value: String(getCcId(c, idx)) })),
            hasMore: costCenters.length === DROPDOWN_PAGE_SIZE,
        };
    };

    const handleDepartmentChange = (val: DropdownValue | null) => {
        setDepartment(val?.value || "");
        setDepartmentLabel(val?.name || "");
        setCostCenter("");
        setCostCenterLabel("");
        setErrors((p) => { const np = { ...p }; delete np.department; return np; });
    };

    const handleCostCenterChange = (val: DropdownValue | null) => {
        setCostCenter(val?.value || "");
        setCostCenterLabel(val?.name || "");
    };

    const [segmentCode, setSegmentCode] = useState("");
    const [segmentTitle, setSegmentTitle] = useState("");
    const [familyCode, setFamilyCode] = useState("");
    const [familyTitle, setFamilyTitle] = useState("");

    // ---- Async paginated loader for the Segment Dropdown ----
    const loadSegmentOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        const pageIndex = page * DROPDOWN_PAGE_SIZE; // index of the first item on the page: 0, 40, 80, ...
        const segments = await api.getUnspscSegments(pageIndex, DROPDOWN_PAGE_SIZE, search || undefined);
        return {
            options: segments.map((seg) => ({ name: seg.title, value: String(seg.segment) })),
            hasMore: segments.length === DROPDOWN_PAGE_SIZE,
        };
    };

    // ---- Async paginated loader for the Family Dropdown (server has no search param, so filter client-side) ----
    const loadFamilyOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        if (!segmentCode) {
            return { options: [], hasMore: false };
        }
        const pageIndex = page * DROPDOWN_PAGE_SIZE; // index of the first item on the page: 0, 40, 80, ...
        const families = await api.getUnspscFamilies(Number(segmentCode), pageIndex, DROPDOWN_PAGE_SIZE);
        const searchTerm = search.trim().toLowerCase();
        const options = families
            .filter((fam) => !searchTerm || fam.title.toLowerCase().includes(searchTerm))
            .map((fam) => ({ name: fam.title, value: String(fam.family) }));
        return { options, hasMore: families.length === DROPDOWN_PAGE_SIZE };
    };

    const handleSegmentChange = (val: DropdownValue | null) => {
        setSegmentCode(val?.value || "");
        setSegmentTitle(val?.name || "");
        setFamilyCode("");
        setFamilyTitle("");
    };

    const handleFamilyChange = (val: DropdownValue | null) => {
        setFamilyCode(val?.value || "");
        setFamilyTitle(val?.name || "");
    };

    const getCurrenciesSafe = async (
        index: number,
        limit: number
    ): Promise<{ items: CurrencyDto[]; totalCount: number }> => {
        try {
            const res = await api.getCurrencies(index, limit);
            if (res && Array.isArray((res as any).items)) {
                return res as { items: CurrencyDto[]; totalCount: number };
            }
        } catch (err) {
        }
        return { items: [], totalCount: 0 };
    };

    const getCountriesSafe = async (
        index: number,
        limit: number,
        searchTerm?: string
    ): Promise<{ items: CountryDto[]; totalCount: number }> => {
        try {
            const res = await api.getCountries(index, limit, searchTerm);
            if (res && Array.isArray((res as any).items)) {
                return res as { items: CountryDto[]; totalCount: number };
            }
        } catch (err) {
        }
        return { items: [], totalCount: 0 };
    };

    const getUnitsSafe = async (
        index: number,
        limit: number
    ): Promise<{ items: UnitDto[]; totalCount: number }> => {
        try {
            const res = await api.getUnits(index, limit);
            if (res && Array.isArray((res as any).items)) {
                return res as { items: UnitDto[]; totalCount: number };
            }
        } catch (err) {
        }
        return { items: [], totalCount: 0 };
    };

    const [currency, setCurrency] = useState("");
    const [region, setRegion] = useState("");

    // ---- Async paginated loader for the Currency Dropdown (server has no search param, so search client-side) ----
    // For the masterdata APIs `index` is an offset: 0, then 0 + 40, then 0 + 40 + 40, ...
    const loadCurrencyOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        const toOption = (c: CurrencyDto) => ({ name: c.currencyName, value: c.currencyName });
        const searchTerm = search.trim().toLowerCase();

        if (searchTerm) {
            // Page through every currency so a match on a later page isn't missed, then filter here
            const matches: CurrencyDto[] = [];
            let index = 0;
            let totalCount = 0;
            do {
                const res = await getCurrenciesSafe(index, DROPDOWN_PAGE_SIZE);
                matches.push(...res.items.filter((c) => c.currencyName.toLowerCase().includes(searchTerm)));
                totalCount = res.totalCount;
                if (res.items.length === 0) break;
                index += res.items.length;
            } while (index < totalCount);
            return { options: matches.map(toOption), hasMore: false, total: matches.length };
        }

        const index = page * DROPDOWN_PAGE_SIZE;
        const res = await getCurrenciesSafe(index, DROPDOWN_PAGE_SIZE);
        return {
            options: res.items.map(toOption),
            hasMore: index + res.items.length < res.totalCount,
            total: res.totalCount,
        };
    };

    // ---- Async paginated loader for the Region (Country) Dropdown ----
    const loadRegionOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        const res = await getCountriesSafe(page * DROPDOWN_PAGE_SIZE, DROPDOWN_PAGE_SIZE, search || undefined);
        return {
            options: res.items.map((c) => ({ name: c.countryName, value: c.countryName })),
            hasMore: res.items.length === DROPDOWN_PAGE_SIZE,
        };
    };

    // ---- Async paginated loader for the Unit of Measure Dropdown (server has no search param, so search client-side) ----
    const loadUomOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        const toOption = (u: UnitDto) => ({ name: u.key, value: u.key });
        const searchTerm = search.trim().toLowerCase();

        if (searchTerm) {
            // Page through every unit so a match on a later page isn't missed, then filter here
            const matches: UnitDto[] = [];
            let index = 0;
            let totalCount = 0;
            do {
                const res = await getUnitsSafe(index, DROPDOWN_PAGE_SIZE);
                matches.push(...res.items.filter((u) => u.key.toLowerCase().includes(searchTerm)));
                totalCount = res.totalCount;
                if (res.items.length === 0) break;
                index += res.items.length;
            } while (index < totalCount);
            return { options: matches.map(toOption), hasMore: false, total: matches.length };
        }

        const index = page * DROPDOWN_PAGE_SIZE;
        const res = await getUnitsSafe(index, DROPDOWN_PAGE_SIZE);
        return {
            options: res.items.map(toOption),
            hasMore: index + res.items.length < res.totalCount,
            total: res.totalCount,
        };
    };
    const [description, setDescription] = useState("");
    const [deliveryLocation, setDeliveryLocation] = useState("");
    const [startDateTime, setStartDateTime] = useState("");
    const [endDateTime, setEndDateTime] = useState("");
    const [deliveryTargetDate, setDeliveryTargetDate] = useState("");

    const [techSpecFiles, setTechSpecFiles] = useState<File[]>([]);
    const [termsFiles, setTermsFiles] = useState<File[]>([]);

    const techSpecInputRef = useRef<HTMLInputElement>(null);
    const termsInputRef = useRef<HTMLInputElement>(null);

    const [lotOption, setLotOption] = useState(false);
    const [totalBudget, setTotalBudget] = useState("");

    const [customFields, setCustomFields] = useState<CustomField[]>(initialCustomFields);
    const [newFieldLabel, setNewFieldLabel] = useState("");
    const [newFieldType, setNewFieldType] = useState<FieldType>("INPUT");

    const [fieldTypeOptions, setFieldTypeOptions] = useState<any[]>([]);
    const [checkboxOptions, setCheckboxOptions] = useState<string[]>([]);
    const [checkboxOptionInput, setCheckboxOptionInput] = useState("");

    useEffect(() => {
        const loadFieldTypes = async () => {
            try {
                const data = await api.fetchReferenceList(["QUESTION_TYPE"]);
if (Array.isArray(data)) {
    const filtered = data.filter((item: any) =>
        ["INPUT", "RADIO_BUTTON", "CHECK_BOX", "FILE"].includes(item.key)
    );
    setFieldTypeOptions(filtered);
}
            } catch (err) {
            }
        };
        loadFieldTypes();
    }, []);

    const getFieldTypeLabel = (key: string) =>
        fieldTypeOptions.find((t) => t.key === key)?.description || key;

    const [lineItems, setLineItems] = useState<LineItem[]>(initialLineItems);
    const [newItemDesc, setNewItemDesc] = useState("");
    const [newItemQty, setNewItemQty] = useState(1);
    const [newItemUom, setNewItemUom] = useState("EA");
    const [newItemPrice, setNewItemPrice] = useState("");
    const [newItemMaterialCode, setNewItemMaterialCode] = useState("");

    // Descriptions of the material codes loaded so far, used to prefill the item description on select
    const materialCodeDescriptions = useRef<Record<string, string>>({});

    // ---- Async paginated loader for the Material Code Dropdown (`index` is an offset: 0, 40, 80, ...) ----
    const loadMaterialCodeOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        if (!buyerProfileId) {
            return { options: [], hasMore: false };
        }
        const res = await api.getAllItemMasters(buyerProfileId, page * DROPDOWN_PAGE_SIZE, DROPDOWN_PAGE_SIZE, search || undefined);
        const data = res?.data?.data || res?.data || res || [];
        const items: any[] = Array.isArray(data) ? data : [];
        const options = items.map((m, idx) => {
            const code: string = typeof m === "string" ? m : (m.materialCode || m.id || `Code ${idx}`);
            materialCodeDescriptions.current[code] = getMaterialCodeDescription(m);
            return { name: code, value: code };
        });
        return { options, hasMore: items.length === DROPDOWN_PAGE_SIZE };
    };

    const handleMaterialCodeChange = (code: string) => {
        setNewItemMaterialCode(code);
        if (!code) return;
        const desc = materialCodeDescriptions.current[code];
        if (desc && !newItemDesc) {
            setNewItemDesc(desc);
        }
    };

    const [suppliers, setSuppliers] = useState<VerifiedSupplierDto[]>([]);
    const [suppliersLoading, setSuppliersLoading] = useState(false);
    const [suppliersError, setSuppliersError] = useState<string | null>(null);
    const [selectedSupplierIds, setSelectedSupplierIds] = useState<string[]>([]);
    const [externalSuppliers, setExternalSuppliers] = useState<ExternalSupplierDto[]>([]);
    const [supplierSelectedUserIds, setSupplierSelectedUserIds] = useState<Record<string, string[]>>({});
    const [activeSupplierForUsers, setActiveSupplierForUsers] = useState<VerifiedSupplierDto | null>(null);
    const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<DropdownValue | null>(SUPPLIER_FILTER_OPTIONS[0]);
    const supplierTypeFilter = (selectedSupplierFilter?.value || "ALL") as "ALL" | SupplierVerificationType;
    const [supplierSearchQuery, setSupplierSearchQuery] = useState("");
    const [registrationTemplate, setRegistrationTemplate] = useState("");
    const [registrationTemplateId, setRegistrationTemplateId] = useState("");
    // const supplierRegistrationLink = "https://supplier.company.com/register";

    const DEFAULT_REGISTRATION_TEMPLATE_NAME = "Default Supplier Registration";

    // ---- Preselect the "Default Supplier Registration" template so the field isn't left empty ----
    useEffect(() => {
        const loadDefaultTemplate = async () => {
            try {
                const data = await api.fetchBuyerVerificationTemplates(0, DROPDOWN_PAGE_SIZE);
                if (!Array.isArray(data)) return;
                const defaultTemplate = data.find(
                    (t) => t.templateName.trim().toLowerCase() === DEFAULT_REGISTRATION_TEMPLATE_NAME.toLowerCase()
                );
                if (defaultTemplate) {
                    setRegistrationTemplateId(defaultTemplate.templateId);
                    setRegistrationTemplate(defaultTemplate.templateName);
                }
            } catch (err) {
            }
        };
        loadDefaultTemplate();
    }, []);

    // ---- Async paginated loader for the Registration Template Dropdown (server has no search param, so filter client-side) ----
    const loadTemplateOptions = async ({ page, search }: DropdownLoadParams): Promise<DropdownLoadResult> => {
        const data = await api.fetchBuyerVerificationTemplates(page * DROPDOWN_PAGE_SIZE, DROPDOWN_PAGE_SIZE);
        if (!Array.isArray(data)) {
            return { options: [], hasMore: false };
        }
        const searchTerm = search.trim().toLowerCase();
        return {
            options: data
                .filter((t) => !searchTerm || t.templateName.toLowerCase().includes(searchTerm))
                .map((t) => ({ name: t.templateName, value: t.templateId })),
            hasMore: data.length === DROPDOWN_PAGE_SIZE,
        };
    };

    const handleTemplateChange = (val: DropdownValue | null) => {
        setRegistrationTemplateId(val?.value || "");
        setRegistrationTemplate(val?.name || "");
    };

    const [isViewTemplateOpen, setIsViewTemplateOpen] = useState(false);
    const [viewTemplateLoading, setViewTemplateLoading] = useState(false);
    const [viewTemplateError, setViewTemplateError] = useState<string | null>(null);
    const [viewTemplateData, setViewTemplateData] = useState<VerificationTemplate | null>(null);
    const [isItemMasterModalOpen, setIsItemMasterModalOpen] = useState(false);
    const [isItemMasterUploadModalOpen, setIsItemMasterUploadModalOpen] = useState(false);
    const [isExternalSupplierModalOpen, setIsExternalSupplierModalOpen] = useState(false);

    const handleViewTemplate = async () => {
        if (!registrationTemplateId) return;
        setIsViewTemplateOpen(true);
        setViewTemplateLoading(true);
        setViewTemplateError(null);
        try {
            const data = await api.fetchBuyerVerificationTemplateById(registrationTemplateId);
            if (data && "statusCode" in data) {
                setViewTemplateError((data as any).message || "Failed to load template.");
                setViewTemplateData(null);
            } else {
                setViewTemplateData(data as VerificationTemplate);
            }
        } catch (err: any) {
            setViewTemplateError(err?.message || "Failed to load template.");
        } finally {
            setViewTemplateLoading(false);
        }
    };

    const closeViewTemplate = () => {
        setIsViewTemplateOpen(false);
        setViewTemplateData(null);
        setViewTemplateError(null);
    };

    useEffect(() => {
        if (activeStep !== "suppliers") return;
        if (!buyerProfileId) return;

        const timer = setTimeout(() => {
            const fetchSuppliers = async () => {
                setSuppliersLoading(true);
                setSuppliersError(null);
                try {
                    const payload: {
                        index: number;
                        limit: number;
                        searchTerm?: string;
                        segmentCode?: string;
                        familyCode?: string;
                        type?: SupplierVerificationType;
                        buyerId: string;
                    } = {
                        index: 0,
                        limit: 50,
                        buyerId: buyerProfileId,
                    };
                    if (supplierSearchQuery.trim()) payload.searchTerm = supplierSearchQuery.trim();
                    if (supplierTypeFilter !== "ALL") payload.type = supplierTypeFilter;
                    if (segmentCode) payload.segmentCode = segmentCode;
                    if (familyCode) payload.familyCode = familyCode;

                    const data = await api.getVerifiedSuppliers(payload);

                    const uniqueSuppliers = Array.from(
                        new Map(data.map(s => [s.supplierId, s])).values()
                    );

                    setSuppliers(uniqueSuppliers);
                } catch (err: any) {
                    setSuppliersError(err?.message || "Failed to fetch suppliers.");
                    setSuppliers([]);
                } finally {
                    setSuppliersLoading(false);
                }
            };
            fetchSuppliers();
        }, 350);

        return () => clearTimeout(timer);
    }, [activeStep, buyerProfileId, supplierSearchQuery, supplierTypeFilter, segmentCode, familyCode]);

    const [rfqNumber, setRfqNumber] = useState("");

    const [errors, setErrors] = useState<Record<string, string>>({});

    const [isSubmittingRFQ, setIsSubmittingRFQ] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);

    const formatDateTimeLabel = (value: string) => {
        if (!value) return "";
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;
        const d = String(date.getDate()).padStart(2, "0");
        const m = String(date.getMonth() + 1).padStart(2, "0");
        const y = date.getFullYear();
        let hh = date.getHours();
        const mm = String(date.getMinutes()).padStart(2, "0");
        const suffix = hh >= 12 ? "PM" : "AM";
        hh = hh % 12 || 12;
        return `${d}/${m}/${y} ~ ${String(hh).padStart(2, "0")}:${mm} ${suffix}`;
    };

    const handleAddLineItem = () => {
        if (!newItemDesc.trim()) return;
        const item: LineItem = {
            id: `li-${Date.now()}`,
            description: newItemDesc.trim(),
            quantity: newItemQty || 1,
            uom: newItemUom,
            price: newItemPrice.trim(),
            materialCode: newItemMaterialCode,
        };
        setLineItems((prev) => {
            const next = [...prev, item];
            return next;
        });
        setErrors((p) => { const np = { ...p }; delete np.lineItems; return np; });
        setNewItemDesc("");
        setNewItemQty(1);
        setNewItemUom("EA");
        setNewItemPrice("");
        setNewItemMaterialCode("");
    };

    const handleRemoveLineItem = (id: string) => {
        setLineItems((prev) => prev.filter((li) => li.id !== id));
    };

    const handleAddCheckboxOption = () => {
        const val = checkboxOptionInput.trim();
        if (!val) return;
        if (checkboxOptions.includes(val)) return;
        setCheckboxOptions((prev) => [...prev, val]);
        setCheckboxOptionInput("");
    };

    const handleRemoveCheckboxOption = (idx: number) => {
        setCheckboxOptions((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleAddCustomField = () => {
        if (!newFieldLabel.trim()) return;
        if (newFieldType === "CHECK_BOX" && checkboxOptions.length < 2) return;

        let options: string[] = [];
        if (newFieldType === "RADIO_BUTTON") {
            options = ["Yes", "No"];
        } else if (newFieldType === "CHECK_BOX") {
            options = [...checkboxOptions];
        }

        const field: CustomField = {
            id: `cf-${Date.now()}`,
            label: newFieldLabel.trim(),
            type: newFieldType,
            options,
        };

        setCustomFields((prev) => [...prev, field]);
        setNewFieldLabel("");
        setNewFieldType("INPUT");
        setCheckboxOptions([]);
        setCheckboxOptionInput("");
    };

    const handleRemoveCustomField = (id: string) => {
        setCustomFields((prev) => prev.filter((f) => f.id !== id));
    };

    const handleFilesChosen = (
        files: FileList | File[] | null,
        setFilesState: React.Dispatch<React.SetStateAction<File[]>>
    ) => {
        if (!files || files.length === 0) return;
        const fileArray = Array.from(files);
        setFilesState((prev) => {
            const existingNames = new Set(prev.map((f) => f.name));
            const filteredNew = fileArray.filter((f) => !existingNames.has(f.name));
            return [...prev, ...filteredNew];
        });
    };

    const handleNext = () => {
        if (activeStep === "details") {
            const newErrors: Record<string, string> = {};
            if (!rfqTitle.trim()) newErrors.rfqTitle = "Please enter RFQ Title";
            if (!department) newErrors.department = "Please select Department";
            if (!description.trim()) newErrors.description = "Please enter description";
            if (!currency) newErrors.currency = "Please select Currency";
            if (!region) newErrors.region = "Please select Region";
            if (!startDateTime) {
                newErrors.startDateTime = "Start Date & Time is required.";
            } else if (startDateTime < getNowDateTimeLocalString()) {
                newErrors.startDateTime = "Start Date & Time cannot be in the past.";
            }
            if (endDateTime && startDateTime && endDateTime < startDateTime) {
                newErrors.endDateTime = "End Date cannot be before Start Date.";
            }
            if (deliveryTargetDate && startDateTime && deliveryTargetDate < startDateTime) {
                newErrors.deliveryTargetDate = "Delivery Target Date cannot be before Start Date.";
            }
            if (!lineItems || lineItems.length === 0) newErrors.lineItems = "Please add at least one line item";

            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                try {
                    if (typeof toastService !== "undefined" && toastService && typeof toastService.error === "function") {
                        toastService.error("Please fill the required fields");
                    }
                } catch (e) {
                }
                return;
            }

            setErrors({});
            setActiveStep("suppliers");
        } else if (activeStep === "suppliers") setActiveStep("summary");
    };

    const toggleSupplier = (id: string) => {
        setSelectedSupplierIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    };

    const handleAddExternalSupplier = (supplier: ExternalSupplierFormValues) => {
        setExternalSuppliers((prev) => [...prev, supplier]);
        toastService.success("External supplier added.");
    };

    const handleRemoveExternalSupplier = (index: number) => {
        setExternalSuppliers((prev) => prev.filter((_, i) => i !== index));
    };

    const handleSaveSupplierUsers = (supplierId: string, userIds: string[]) => {
        setSupplierSelectedUserIds((prev) => ({ ...prev, [supplierId]: userIds }));
    };

    const selectedSuppliers = suppliers.filter((s) => selectedSupplierIds.includes(s.supplierId));
    const verifiedSelectedCount = selectedSuppliers.filter((s) => s.isVerified).length;
    const unverifiedSelectedCount = selectedSuppliers.length - verifiedSelectedCount;
    const hasUnverifiedSelected = unverifiedSelectedCount > 0;
    const targetCategory = familyTitle || segmentTitle || "Not set";

    const handleSubmitRFQ = async () => {
        if (selectedSupplierIds.length === 0 && externalSuppliers.length === 0) return;

        const suppliersMissingUsers = selectedSuppliers.filter(
            (s) => (supplierSelectedUserIds[s.supplierId] || []).length === 0
        );
        if (suppliersMissingUsers.length > 0) {
            const message = suppliersMissingUsers.length === 1
                ? `Please select at least one user for ${suppliersMissingUsers[0].supplierName}.`
                : "Please select at least one user for each selected supplier.";
            toastService.error(message);
            return;
        }

        setSubmitError(null);
        setIsSubmittingRFQ(true);

        try {
            const technicalSpecificationDocuments: RfqDocumentAssetDto[] = await Promise.all(
                techSpecFiles.map((file) => buildDocumentAsset(file, buyerProfileId, "TECHNICAL_SPECIFICATION"))
            );

            const termsConditionDocuments: RfqDocumentAssetDto[] = await Promise.all(
                termsFiles.map((file) => buildDocumentAsset(file, buyerProfileId, "TERMS_CONDITION"))
            );

            const questionTypeLegacyMap: Record<string, string> = {
                INPUT: "Text",
                RADIO_BUTTON: "Radio",
                CHECK_BOX: "Checkbox",
            };

            const questions: RfqQuestionDto[] = customFields.map((field, idx) => ({
                question: field.label,
                questionType: questionTypeLegacyMap[field.type] || field.type,
                isRequired: false,
                displayOrder: idx,
                options: field.options,
            }));

            const items: RfqItemDto[] = lineItems.map((li) => ({
                description: li.description,
                quantity: li.quantity,
                uom: li.uom,
                materialCode: li.materialCode,
                materialGroup: "",
                costCenter: costCenter,
                attachments: [],
            }));

            const supplierInvites: SupplierInviteDto[] = selectedSuppliers.map((s) => ({
                supplierId: s.supplierId,
                userIds: supplierSelectedUserIds[s.supplierId] || [],
            }));

            const payload: CreateRFQPayload = {
                title: rfqTitle,
                description,
                department,
                region,
                currency,
                deliveryLocation,
                startDate: new Date(startDateTime).toISOString(),
                endDate: endDateTime ? new Date(endDateTime).toISOString() : "",
                deliveryTargetDate: deliveryTargetDate ? new Date(deliveryTargetDate).toISOString() : "",
                budget: Number(totalBudget) || 0,
                addLotOption: lotOption,
                segmentId: segmentCode,
                segmentTitle,
                familyId: familyCode,
                familyTitle,
                technicalSpecificationDocuments,
                termsConditionDocuments,
                questions,
                items,
                supplierIds: selectedSupplierIds,
                supplierInvites,
                externalSuppliers,
                rfqVerificationTemplateId: registrationTemplateId || HARDCODED_RFQ_VERIFICATION_TEMPLATE_ID,
            };

            const response = await api.createRFQ(payload);
            setRfqNumber(response.id);
            await onRfqCreated();
            setActiveStep("summary");
        } catch (err: any) {
            setSubmitError(err?.message || "Failed to submit RFQ. Please try again.");
        } finally {
            setIsSubmittingRFQ(false);
        }
    };

    // const handleReset = () => {
    //     setActiveStep("details");
    // };

    const activeStepIndex = steps.findIndex((step) => step.key === activeStep);

    const renderFileList = (
        files: File[],
        setFilesState: React.Dispatch<React.SetStateAction<File[]>>
    ) =>
        files.length > 0 && (
            <ul className="bd-file-list sila-file-list">
                {files.map((file, idx) => (
                    <li key={idx} className="bd-chip sila-file">
                        <span className="sila-file-icon" aria-hidden="true">
                            <FaFileAlt />
                        </span>
                        <span className="sila-file-name" title={file.name}>{file.name}</span>
                        <span className="sila-file-meta">{formatFileSize(file.size)}</span>
                        <button
                            className="bd-chip-remove sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                            onClick={(e) => {
                                e.stopPropagation();
                                setFilesState((prev) => prev.filter((_, i) => i !== idx));
                            }}
                            type="button"
                            aria-label={`Remove ${file.name}`}
                            title="Remove file"
                        >
                            <FaTimes aria-hidden="true" />
                        </button>
                    </li>
                ))}
            </ul>
        );

    const openFilePicker = (ref: React.RefObject<HTMLInputElement | null>) => (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            ref.current?.click();
        }
    };

    return (
        <div className="bd-rfq-card">
            <div className="bd-rfq-header">
                <div className="bd-rfq-heading">
                    <h1 className="bd-rfq-title">Create Request For Quotation (RFQ)</h1>
                    <p className="bd-rfq-subtitle">
                        Draft your requirements, item catalogs, and dispatch directly to approved suppliers.
                    </p>
                </div>
                <ol className="bd-stepper sila-steps" aria-label="RFQ creation progress">
                    {steps.map((step, idx) => {
                        const isCurrent = activeStep === step.key;
                        const isDone = idx < activeStepIndex;
                        return (
                            <li
                                key={step.key}
                                className={`bd-step sila-step${isCurrent ? " bd-step-active sila-step--current" : ""}${isDone ? " sila-step--done" : ""}`}
                                aria-current={isCurrent ? "step" : undefined}
                            >
                                <span className="sila-step-marker" aria-hidden="true">
                                    {isDone ? "✓" : idx + 1}
                                </span>
                                <span>{step.label}</span>
                            </li>
                        );
                    })}
                </ol>
            </div>

            <div className="bd-rfq-body">
            {activeStep === "details" && (
                <>
                    <section className="bd-form-section sila-form-section" aria-labelledby="bd-sec-general">
                        <h2 className="sila-form-section-title" id="bd-sec-general">RFQ information</h2>
                        <p className="sila-form-section-description">Title, owning department and procurement category.</p>
                        <div className="sila-form-grid bd-form-grid">
                            <div className={`bd-field sila-field sila-field--full${errors.rfqTitle ? " sila-field--error" : ""}`}>
                                <label className="bd-label sila-label" htmlFor="bd-rfq-title">
                                    RFQ Title<span className="sila-required" aria-hidden="true">*</span>
                                </label>
                                <input
                                    id="bd-rfq-title"
                                    className={`bd-input ${errors.rfqTitle ? "bd-input-error" : ""}`}
                                    type="text"
                                    required
                                    aria-invalid={!!errors.rfqTitle || undefined}
                                    aria-describedby={errors.rfqTitle ? "bd-rfq-title-error" : undefined}
                                    value={rfqTitle}
                                    onChange={(e) => {
                                        setRfqTitle(e.target.value);
                                        setErrors((p) => { const np = { ...p }; delete np.rfqTitle; return np; });
                                    }}
                                    onBlur={() => setErrors((p) => { const np = { ...p }; delete np.rfqTitle; return np; })}
                                />
                                {errors.rfqTitle && <div className="bd-error-text sila-error-text" id="bd-rfq-title-error">{errors.rfqTitle}</div>}
                            </div>

                            <div className="bd-row-2 sila-field--full">
                                <div className={`bd-field sila-field${errors.department ? " sila-field--error" : ""}`}>
                                    <Dropdown
                                        label="Department"
                                        isRequired
                                        placeholder="Select Department"
                                        isAsync
                                        loadOptions={loadDepartmentOptions}
                                        cacheUniques={[buyerProfileId]}
                                        value={department ? { name: departmentLabel, value: department } : null}
                                        onChange={handleDepartmentChange}
                                        error={errors.department}
                                    />
                                </div>
                                <div className="bd-field sila-field">
                                    <Dropdown
                                        label="Cost Center"
                                        placeholder={department ? "Select Cost Center" : "Select Department First"}
                                        isAsync
                                        loadOptions={loadCostCenterOptions}
                                        value={costCenter ? { name: costCenterLabel, value: costCenter } : null}
                                        onChange={handleCostCenterChange}
                                        cacheUniques={[department]}
                                        isDisable={!department}
                                    />
                                </div>

                                <div className="bd-field sila-field">
                                    <Dropdown
                                        label="Segment"
                                        placeholder="Select Segment"
                                        isAsync
                                        loadOptions={loadSegmentOptions}
                                        value={segmentCode ? { name: segmentTitle, value: segmentCode } : null}
                                        onChange={handleSegmentChange}
                                    />
                                </div>
                                <div className="bd-field sila-field">
                                    <Dropdown
                                        label="Family"
                                        placeholder={segmentCode ? "Select Family" : "Select Segment First"}
                                        isAsync
                                        loadOptions={loadFamilyOptions}
                                        cacheUniques={[segmentCode]}
                                        value={familyCode ? { name: familyTitle, value: familyCode } : null}
                                        onChange={handleFamilyChange}
                                        isDisable={!segmentCode}
                                    />
                                </div>
                            </div>

                            <div className={`bd-field sila-field sila-field--full${errors.description ? " sila-field--error" : ""}`}>
                                <label className="bd-label sila-label" htmlFor="bd-rfq-description">
                                    Description<span className="sila-required" aria-hidden="true">*</span>
                                </label>
                                <textarea
                                    id="bd-rfq-description"
                                    className={`bd-textarea ${errors.description ? "bd-input-error" : ""}`}
                                    rows={3}
                                    required
                                    aria-invalid={!!errors.description || undefined}
                                    aria-describedby={errors.description ? "bd-rfq-description-error" : undefined}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    onBlur={() => setErrors((p) => { const np = { ...p }; delete np.description; return np; })}
                                />
                                {errors.description && <div className="bd-error-text sila-error-text" id="bd-rfq-description-error">{errors.description}</div>}
                            </div>
                        </div>
                    </section>

                    <section className="bd-form-section sila-form-section" aria-labelledby="bd-sec-commercial">
                        <h2 className="sila-form-section-title" id="bd-sec-commercial">Commercial &amp; delivery</h2>
                        <p className="sila-form-section-description">Currency, sourcing region, delivery point and budget.</p>
                        <div className="bd-row-2">
                            <div className={`bd-field sila-field${errors.currency ? " sila-field--error" : ""}`}>
                                <Dropdown
                                    label="Currency"
                                    isRequired
                                    placeholder="Select Currency"
                                    isAsync
                                    loadOptions={loadCurrencyOptions}
                                    value={currency ? { name: currency, value: currency } : null}
                                    onChange={(val) => {
                                        setCurrency(val?.name || "");
                                        setErrors((p) => { const np = { ...p }; delete np.currency; return np; });
                                    }}
                                    error={errors.currency}
                                />
                            </div>
                        </div>

                        <div className="bd-row-2">
                            <div className={`bd-field sila-field${errors.region ? " sila-field--error" : ""}`}>
                                <Dropdown
                                    label="Region"
                                    isRequired
                                    placeholder="Select Region"
                                    isAsync
                                    loadOptions={loadRegionOptions}
                                    value={region ? { name: region, value: region } : null}
                                    onChange={(val) => {
                                        setRegion(val?.name || "");
                                        setErrors((p) => { const np = { ...p }; delete np.region; return np; });
                                    }}
                                    error={errors.region}
                                />
                            </div>
                            <div className="bd-field sila-field">
                                <label className="bd-label sila-label" htmlFor="bd-rfq-delivery-location">Delivery Location</label>
                                <input
                                    id="bd-rfq-delivery-location"
                                    className={`bd-input ${errors.deliveryLocation ? "bd-input-error" : ""}`}
                                    type="text"
                                    aria-invalid={!!errors.deliveryLocation || undefined}
                                    value={deliveryLocation}
                                    onChange={(e) => {
                                        setDeliveryLocation(e.target.value);
                                        setErrors((p) => { const np = { ...p }; delete np.deliveryLocation; return np; });
                                    }}
                                />
                            </div>
                        </div>

                        <div className="bd-toggle-row">
                            <div>
                                <div className="bd-toggle-row-title" id="bd-rfq-lot-title">Lot Option</div>
                                <div className="bd-toggle-row-desc" id="bd-rfq-lot-desc">
                                    Disable item-level price evaluation. When enabled, evaluation is based on Total Budget.
                                </div>
                            </div>
                            <label className="bd-switch">
                                <input
                                    type="checkbox"
                                    role="switch"
                                    aria-labelledby="bd-rfq-lot-title"
                                    aria-describedby="bd-rfq-lot-desc"
                                    checked={lotOption}
                                    onChange={(e) => setLotOption(e.target.checked)}
                                />
                                <span className="bd-switch-slider" aria-hidden="true" />
                            </label>
                        </div>

                        <div className="bd-field sila-field">
                            <label className="bd-label sila-label" htmlFor="bd-rfq-budget">Total Budget</label>
                            <input
                                id="bd-rfq-budget"
                                className="bd-input bd-input-num"
                                type="text"
                                value={totalBudget}
                                onChange={(e) => setTotalBudget(e.target.value)}
                            />
                        </div>
                    </section>

                    <section className="bd-form-section sila-form-section" aria-labelledby="bd-sec-schedule">
                        <h2 className="sila-form-section-title" id="bd-sec-schedule">Schedule</h2>
                        <p className="sila-form-section-description">Bidding window and requested delivery date. All times are UTC.</p>
                        <div className="sila-form-grid bd-form-grid">
                            <div className={`bd-field sila-field${errors.startDateTime ? " sila-field--error" : ""}`}>
                                <label className="bd-label sila-label">
                                    Start Date &amp; Time<span className="sila-required" aria-hidden="true">*</span>
                                </label>
                                <DateTimePicker
                                    mode="datetime"
                                    value={startDateTime}
                                    min={getNowDateTimeLocalString()}
                                    error={!!errors.startDateTime}
                                    displayValue={formatDateTimeLabel(startDateTime)}
                                    onChange={(newStart) => {
                                        setStartDateTime(newStart);
                                        setErrors((p) => { const np = { ...p }; delete np.startDateTime; return np; });
                                        if (endDateTime && newStart && endDateTime < newStart) {
                                            setEndDateTime("");
                                            setErrors((p) => { const np = { ...p }; delete np.endDateTime; return np; });
                                        }
                                        if (deliveryTargetDate && newStart && deliveryTargetDate < newStart) {
                                            setDeliveryTargetDate("");
                                            setErrors((p) => { const np = { ...p }; delete np.deliveryTargetDate; return np; });
                                        }
                                    }}
                                />
                                {errors.startDateTime && <div className="bd-error-text sila-error-text">{errors.startDateTime}</div>}
                            </div>
                            <div className={`bd-field sila-field${errors.endDateTime ? " sila-field--error" : ""}`}>
                                <label className="bd-label sila-label">End Date &amp; Time</label>
                                <DateTimePicker
                                    mode="datetime"
                                    value={endDateTime}
                                    min={startDateTime || undefined}
                                    disabled={!startDateTime}
                                    error={!!errors.endDateTime}
                                    displayValue={formatDateTimeLabel(endDateTime)}
                                    onChange={(newEnd) => {
                                        setEndDateTime(newEnd);
                                        if (newEnd && startDateTime && newEnd < startDateTime) {
                                            setErrors((p) => ({ ...p, endDateTime: "End Date cannot be before Start Date." }));
                                        } else {
                                            setErrors((p) => { const np = { ...p }; delete np.endDateTime; return np; });
                                        }
                                    }}
                                />
                                {errors.endDateTime && <div className="bd-error-text sila-error-text">{errors.endDateTime}</div>}
                            </div>
                            <div className={`bd-field sila-field${errors.deliveryTargetDate ? " sila-field--error" : ""}`}>
                                <label className="bd-label sila-label">Delivery Target Date </label>
                                <DateTimePicker
                                    mode="datetime"
                                    value={deliveryTargetDate}
                                    min={startDateTime || undefined}
                                    disabled={!startDateTime}
                                    error={!!errors.deliveryTargetDate}
                                    displayValue={formatDateTimeLabel(deliveryTargetDate)}
                                    onChange={(newTarget) => {
                                        setDeliveryTargetDate(newTarget);
                                        if (newTarget && startDateTime && newTarget < startDateTime) {
                                            setErrors((p) => ({ ...p, deliveryTargetDate: "Delivery Target Date cannot be before Start Date." }));
                                        } else {
                                            setErrors((p) => { const np = { ...p }; delete np.deliveryTargetDate; return np; });
                                        }
                                    }}
                                />
                                {errors.deliveryTargetDate && <div className="bd-error-text sila-error-text">{errors.deliveryTargetDate}</div>}
                            </div>
                        </div>
                    </section>

                    <section className="bd-form-section sila-form-section" aria-labelledby="bd-sec-attachments">
                        <h2 className="sila-form-section-title" id="bd-sec-attachments">Attachments</h2>
                        <p className="sila-form-section-description">Specifications and commercial terms shared with invited suppliers.</p>
                        <div className="bd-row-2">
                            <div className="bd-field sila-field">
                                <span className="bd-label sila-label" id="bd-rfq-techspec-label">Attachments (Technical Specifications)</span>
                                <div
                                    className="bd-dropzone sila-dropzone"
                                    role="button"
                                    tabIndex={0}
                                    aria-labelledby="bd-rfq-techspec-label"
                                    onClick={() => techSpecInputRef.current?.click()}
                                    onKeyDown={openFilePicker(techSpecInputRef)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        handleFilesChosen(e.dataTransfer.files, setTechSpecFiles);
                                    }}
                                >
                                    <FaCloudUploadAlt className="bd-dropzone-icon" aria-hidden="true" />
                                    <span>Click to select file or drag and drop here</span>
                                </div>
                                <input
                                    ref={techSpecInputRef}
                                    type="file"
                                    multiple
                                    className="bd-hidden-file-input"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    onChange={(e) => {
                                        handleFilesChosen(e.target.files, setTechSpecFiles);
                                        e.target.value = "";
                                    }}
                                />
                                {renderFileList(techSpecFiles, setTechSpecFiles)}
                            </div>
                            <div className="bd-field sila-field">
                                <span className="bd-label sila-label" id="bd-rfq-terms-label">Terms &amp; Conditions</span>
                                <div
                                    className="bd-dropzone sila-dropzone"
                                    role="button"
                                    tabIndex={0}
                                    aria-labelledby="bd-rfq-terms-label"
                                    onClick={() => termsInputRef.current?.click()}
                                    onKeyDown={openFilePicker(termsInputRef)}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        handleFilesChosen(e.dataTransfer.files, setTermsFiles);
                                    }}
                                >
                                    <FaCloudUploadAlt className="bd-dropzone-icon" aria-hidden="true" />
                                    <span>Click to select file or drag and drop here</span>
                                </div>
                                <input
                                    ref={termsInputRef}
                                    type="file"
                                    multiple
                                    className="bd-hidden-file-input"
                                    tabIndex={-1}
                                    aria-hidden="true"
                                    onChange={(e) => {
                                        handleFilesChosen(e.target.files, setTermsFiles);
                                        e.target.value = "";
                                    }}
                                />
                                {renderFileList(termsFiles, setTermsFiles)}
                            </div>
                        </div>
                    </section>

                    <section className="bd-form-section sila-form-section" aria-labelledby="bd-sec-dsr">
                    <div className="bd-dsr-box">
                        <h2 className="bd-dsr-header" id="bd-sec-dsr">
                            <IconSourcing /> Dynamic Sourcing Requirements (Flexible Fields)
                        </h2>
                        <p className="bd-dsr-sub">
                            Configure additional fields (Text, Dropdown, Radio, Checkbox) for suppliers to submit as part
                            of their compliance checklist.
                        </p>

                        <div className="bd-dsr-builder">
                            <div className="bd-dsr-builder-title">Create Custom Field Definition</div>
                            <div className="bd-dsr-builder-row">
                                <div className="bd-item-add-field">
                                    <label className="bd-label-sm" htmlFor="bd-dsr-label">Question / Label</label>
                                    <input
                                        id="bd-dsr-label"
                                        className="bd-input-sm"
                                        type="text"
                                        placeholder="eg. Is the delivery charge separate?..."
                                        value={newFieldLabel}
                                        onChange={(e) => setNewFieldLabel(e.target.value)}
                                    />
                                </div>
                                <div className="bd-item-add-field">
                                    <span className="bd-label-sm">Input field type</span>
                                    <Dropdown
                                        placeholder="Select field type"
                                        options={fieldTypeOptions.map((t) => ({ name: t.description, value: t.key }))}
                                        value={fieldTypeOptions.length > 0 ? { name: getFieldTypeLabel(newFieldType), value: newFieldType } : null}
                                        onChange={(val) => {
                                            if (!val) return;
                                            setNewFieldType(val.value as FieldType);
                                            setCheckboxOptions([]);
                                            setCheckboxOptionInput("");
                                        }}
                                    />
                                </div>
                                <div className="bd-item-add-field">
                                    <label className="bd-label-sm" htmlFor="bd-dsr-options">Options</label>

                                    {newFieldType === "INPUT" && (
                                        <input
                                            id="bd-dsr-options"
                                            className="bd-input-sm"
                                            type="text"
                                            disabled
                                            placeholder="No options required"
                                        />
                                    )}

                                    {newFieldType === "FILE" && (
                                        <input
                                            id="bd-dsr-options"
                                            className="bd-input-sm"
                                            type="text"
                                            disabled
                                            placeholder="No options required"
                                        />
                                    )}

                                    {newFieldType === "RADIO_BUTTON" && (
                                        <div className="bd-radio-preview">
                                            <label className="bd-radio-preview-option">
                                                <input type="radio" disabled name="radio-preview" /> Yes
                                            </label>
                                            <label className="bd-radio-preview-option">
                                                <input type="radio" disabled name="radio-preview" /> No
                                            </label>
                                        </div>
                                    )}

                                    {newFieldType === "CHECK_BOX" && (
                                        <div>
                                            <div className="bd-option-input-row">
                                                <input
                                                    id="bd-dsr-options"
                                                    className="bd-input-sm"
                                                    type="text"
                                                    placeholder="Type option..."
                                                    value={checkboxOptionInput}
                                                    onChange={(e) => setCheckboxOptionInput(e.target.value)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter") {
                                                            e.preventDefault();
                                                            handleAddCheckboxOption();
                                                        }
                                                    }}
                                                />
                                                <button
                                                    className="bd-btn-add bd-btn-add--icon"
                                                    onClick={handleAddCheckboxOption}
                                                    type="button"
                                                    title="Add option"
                                                    aria-label="Add option"
                                                >
                                                    <IconPlus />
                                                </button>
                                            </div>
                                            {checkboxOptions.length > 0 && (
                                                <div className="bd-dsr-field-options bd-dsr-field-options--spaced">
                                                    {checkboxOptions.map((opt, idx) => (
                                                        <span className="bd-dsr-option-pill" key={idx}>
                                                            {opt}
                                                            <button
                                                                className="bd-chip-remove bd-option-remove"
                                                                onClick={() => handleRemoveCheckboxOption(idx)}
                                                                type="button"
                                                                aria-label={`Remove option ${opt}`}
                                                            >
                                                                <FaTimes aria-hidden="true" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button
                                    className="bd-btn-add"
                                    onClick={handleAddCustomField}
                                    type="button"
                                    disabled={!newFieldLabel.trim() || (newFieldType === "CHECK_BOX" && checkboxOptions.length < 2)}
                                    title={
                                        newFieldType === "CHECK_BOX" && checkboxOptions.length < 2
                                            ? "Add at least 2 options for a checkbox field"
                                            : undefined
                                    }
                                >
                                    <IconPlus /> Add
                                </button>
                            </div>

                            {customFields.length > 0 && (
                                <div className="bd-dsr-fields-list">
                                    {customFields.map((field) => (
                                        <div className="bd-dsr-field-card" key={field.id}>
                                            <button
                                                className="bd-dsr-field-remove"
                                                onClick={() => handleRemoveCustomField(field.id)}
                                                type="button"
                                                title="Remove field"
                                                aria-label={`Remove field ${field.label}`}
                                            >
                                                <FaTimes aria-hidden="true" />
                                            </button>
                                            <div className="bd-dsr-field-type">{getFieldTypeLabel(field.type)}</div>
                                            <div className="bd-dsr-field-label">{field.label}</div>
                                            {field.options.length > 0 && (
                                                <div className="bd-dsr-field-options">
                                                    {field.type === "RADIO_BUTTON" ? (
                                                        field.options.map((opt, idx) => (
                                                            <label key={idx} className="bd-radio-preview-option bd-radio-preview-option--sm">
                                                                <input
                                                                    type="radio"
                                                                    disabled
                                                                    name={`preview-${field.id}`}
                                                                />{" "}
                                                                {opt}
                                                            </label>
                                                        ))
                                                    ) : (
                                                        field.options.map((opt, idx) => (
                                                            <span className="bd-dsr-option-pill" key={idx}>
                                                                {opt}
                                                            </span>
                                                        ))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    </section>

                    <section className="bd-form-section sila-form-section" aria-labelledby="bd-sec-items">
                    <h2 className="sila-form-section-title bd-section-label" id="bd-sec-items">Line items</h2>
                    <p className="sila-form-section-description">Add materials or services required</p>

                    <div className="bd-item-add-row">
                        <div className="bd-item-add-grid-top">
                            <div className="bd-item-add-field">
                                <label className="bd-label-sm" htmlFor="bd-item-desc">Description</label>
                                <input
                                    id="bd-item-desc"
                                    className="bd-input-sm"
                                    type="text"
                                    placeholder="Select a material code to auto-fill"
                                    value={newItemDesc}
                                    readOnly
                                />
                            </div>
                            <div className="bd-item-add-field">
                                <label className="bd-label-sm" htmlFor="bd-item-qty">Quantity</label>
                                <input
                                    id="bd-item-qty"
                                    className="bd-input-sm bd-input-num"
                                    type="number"
                                    min={1}
                                    value={newItemQty}
                                    onChange={(e) => setNewItemQty(Number(e.target.value))}
                                />
                            </div>
                            <div className="bd-item-add-field">
                                <span className="bd-label-sm">UOM</span>
                                <Dropdown
                                    placeholder="Select UOM"
                                    isAsync
                                    loadOptions={loadUomOptions}
                                    value={newItemUom ? { name: newItemUom, value: newItemUom } : null}
                                    onChange={(val) => setNewItemUom(val?.value || "")}
                                />
                            </div>
                        </div>
                        <div className="bd-item-add-grid-bottom">
                            <div className="bd-item-add-field">
                                <span className="bd-label-sm">Material code</span>
                                <Dropdown
                                    placeholder="Select Material Code"
                                    isAsync
                                    loadOptions={loadMaterialCodeOptions}
                                    cacheUniques={[buyerProfileId]}
                                    value={newItemMaterialCode ? { name: newItemMaterialCode, value: newItemMaterialCode } : null}
                                    onChange={(val) => handleMaterialCodeChange(val?.value || "")}
                                    isClearable
                                />
                            </div>
                            <div className="bd-item-button-section">
                                <button className="bd-btn-add" onClick={handleAddLineItem} type="button">
                                    <IconPlus /> Add
                                </button>
                                <button
                                    type="button"
                                    className="bd-btn-add bd-btn-add--secondary"
                                    onClick={() => setIsItemMasterModalOpen(true)}
                                >
                                    <IconPlus /> Add Item Master
                                </button>
                                <button
                                    type="button"
                                    className="bd-btn-add bd-btn-add--secondary"
                                    onClick={() => setIsItemMasterUploadModalOpen(true)}
                                >
                                    <FaCloudUploadAlt aria-hidden="true" /> Upload Item Master
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="bd-line-items-label">
                        <IconList /> Line items
                        <span className="bd-line-items-count">{lineItems.length}</span>
                    </div>
                    <div className={`bd-table-responsive${errors.lineItems ? " bd-table-responsive--error" : ""}`}>
                        <table className="bd-table">
                            <thead>
                                <tr>
                                    <th>Description</th>
                                    <th>Material Code</th>
                                    <th className="bd-num">Quantity</th>
                                    <th>UOM</th>
                                    <th className="bd-cell-actions">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {lineItems.map((li) => (
                                    <tr key={li.id}>
                                        <td>{li.description}</td>
                                        <td>{li.materialCode ? <span className="sila-ref">{li.materialCode}</span> : null}</td>
                                        <td className="bd-num">{li.quantity}</td>
                                        <td>{li.uom}</td>
                                        <td className="bd-cell-actions">
                                            <button
                                                className="bd-icon-btn"
                                                onClick={() => handleRemoveLineItem(li.id)}
                                                type="button"
                                                title="Remove item"
                                                aria-label={`Remove ${li.description}`}
                                            >
                                                <IconTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                                {lineItems.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="bd-table-empty">
                                            No line items added yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {errors.lineItems && <div className="bd-error-text sila-error-text bd-error-text--block" role="alert">{errors.lineItems}</div>}
                    </section>

                    <div className="bd-form-footer">
                        <button className="bd-btn-next" onClick={handleNext} type="button">
                            Next <IconArrowRight />
                        </button>
                    </div>
                </>
            )}

            {activeStep === "suppliers" && (
                <div className="bd-suppliers-step">
                    <div className="bd-suppliers-toolbar">
                        <div>
                            <span className="bd-target-badge">Target Category: {targetCategory}</span>
                            <p className="bd-suppliers-tip">
                                System logic will trigger appropriate registration pipelines for unverified vendors.
                            </p>
                        </div>
                        <div className="bd-suppliers-filters">
                            <Dropdown
                                placeholder="All Suppliers"
                                options={SUPPLIER_FILTER_OPTIONS}
                                value={selectedSupplierFilter}
                                onChange={setSelectedSupplierFilter}
                                className="bd-category-filter"
                            />
                            <div className="bd-search-wrap">
                                <span className="bd-search-icon">
                                    <IconSearch />
                                </span>
                                <input
                                    className="bd-input bd-search-input"
                                    type="search"
                                    aria-label="Search suppliers"
                                    placeholder="Search supplier by name or id..."
                                    value={supplierSearchQuery}
                                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={() => setIsExternalSupplierModalOpen(true)}
                            >
                                <IconPlus /> Add External Supplier
                            </Button>
                        </div>
                    </div>

                    {suppliersError && (
                        <div className="bd-alert sila-alert sila-alert--danger" role="alert">
                            {suppliersError}
                        </div>
                    )}

                    <div className="bd-table-card">
                        <table className="bd-table bd-suppliers-table">
                            <thead>
                                <tr>
                                    <th className="bd-checkbox-cell">Select</th>
                                    <th>Supplier Name</th>
                                    <th>SN ID</th>
                                    <th>Email</th>
                                    <th>Verification Status</th>
                                    <th>Pipeline Actions On Submit</th>
                                    <th>Users</th>
                                </tr>
                            </thead>
                            <tbody>
                                {suppliers.map((s) => {
                                    const isSelected = selectedSupplierIds.includes(s.supplierId);
                                    return (
                                    <tr key={s.supplierId} className={isSelected ? "sila-row-selected" : undefined}>
                                        <td className="bd-checkbox-cell">
                                            <input
                                                type="checkbox"
                                                aria-label={`Select ${s.supplierName}`}
                                                checked={isSelected}
                                                onChange={() => toggleSupplier(s.supplierId)}
                                            />
                                        </td>
                                        <td>
                                            <div className="bd-supplier-name">{s.supplierName}</div>
                                        </td>
                                        <td>
                                            <span className="bd-supplier-sn-id sila-ref">{s.snid}</span>
                                        </td>
                                        <td>
                                            <span className="bd-supplier-email">{s.email}</span>
                                        </td>
                                        <td>
                                            {s.isVerified ? (
                                                <StatusBadge status="Verified" label={<><IconCheckCircle /> Verified</>} />
                                            ) : (
                                                <StatusBadge status="Not Verified" tone="warning" label={<><IconXCircle /> Not Verified</>} />
                                            )}
                                        </td>
                                        <td>
                                            {s.isVerified ? (
                                                <span className="bd-pipeline-pill bd-pipeline-pill-green">
                                                    <IconCheckCircle /> Direct RFQ Sent (Instant)
                                                </span>
                                            ) : (
                                                <span className="bd-pipeline-pill bd-pipeline-pill-orange">
                                                    <IconMail /> Send Invitation (Onboarding Verification Flow)
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant={isSelected ? "outline" : "secondary"}
                                                className="bd-users-btn"
                                                disabled={!isSelected}
                                                title={isSelected ? undefined : "Select this supplier first"}
                                                onClick={() => setActiveSupplierForUsers(s)}
                                            >
                                                {(supplierSelectedUserIds[s.supplierId]?.length ?? 0) > 0
                                                    ? `${supplierSelectedUserIds[s.supplierId].length} Selected`
                                                    : "Select Users"}
                                            </Button>
                                        </td>
                                    </tr>
                                    );
                                })}
                                {!suppliersLoading && suppliers.length === 0 && (
                                    <tr>
                                        <td colSpan={7} className="bd-table-empty">
                                            {suppliersError ? "Could not load suppliers." : "No suppliers match your search."}
                                        </td>
                                    </tr>
                                )}
                                {suppliersLoading && (
                                    <tr>
                                        <td colSpan={7} className="bd-table-empty">
                                            <Loader size={20} message="Loading suppliers..." />
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {externalSuppliers.length > 0 && (
                        <div className="bd-table-card">
                            <table className="bd-table bd-suppliers-table">
                                <thead>
                                    <tr>
                                        <th>External Supplier Name</th>
                                        <th>Email</th>
                                        <th>Contact Number</th>
                                        <th>Address</th>
                                        <th className="bd-cell-actions"><span className="sila-visually-hidden">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {externalSuppliers.map((s, idx) => (
                                        <tr key={`${s.email}-${idx}`}>
                                            <td>
                                                <div className="bd-supplier-name">{s.supplierName}</div>
                                            </td>
                                            <td>
                                                <span className="bd-supplier-email">{s.email}</span>
                                            </td>
                                            <td>
                                                <div className="bd-supplier-sn-id">{s.phoneNumber}</div>
                                            </td>
                                            <td>
                                                <div className="bd-supplier-sn-id">{s.address}</div>
                                            </td>
                                            <td className="bd-cell-actions">
                                                <button
                                                    type="button"
                                                    className="bd-btn-back bd-btn-sm"
                                                    onClick={() => handleRemoveExternalSupplier(idx)}
                                                    aria-label={`Remove ${s.supplierName}`}
                                                >
                                                    Remove
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {(externalSuppliers.length > 0 || hasUnverifiedSelected) && (
                        <div className="bd-onboarding-box">
                            <div className="bd-onboarding-header">
                                <FaShieldAlt aria-hidden="true" /> Supplier Verification
                            </div>
                            <p className="bd-onboarding-sub">
                                Some selected vendors are unverified. They will receive an invitation to register first.
                            </p>
                            <div className="bd-onboarding-grid">
                                <div className="bd-onboarding-left">
                                    <span className="bd-label sila-label">
                                        Registration Template<span className="sila-required" aria-hidden="true">*</span>
                                    </span>
                                    <div className="bd-template-row">
                                        <Dropdown
                                            placeholder="Select Template"
                                            isAsync
                                            loadOptions={loadTemplateOptions}
                                            value={registrationTemplateId ? { name: registrationTemplate, value: registrationTemplateId } : null}
                                            onChange={handleTemplateChange}
                                        />
                                        <button
                                            type="button"
                                            className="bd-btn-view-template"
                                            onClick={handleViewTemplate}
                                            disabled={!registrationTemplateId}
                                        >
                                            <IconEye /> View Template
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {submitError && (
                        <div className="bd-alert sila-alert sila-alert--danger" role="alert">
                            {submitError}
                        </div>
                    )}

                    <div className="bd-form-footer bd-form-footer-split">
                        <button className="bd-btn-back" onClick={() => setActiveStep("details")} type="button">
                            ← Back to details
                        </button>
                        <button
                            className="bd-btn-submit"
                            onClick={handleSubmitRFQ}
                            type="button"
                            disabled={(selectedSupplierIds.length === 0 && externalSuppliers.length === 0) || isSubmittingRFQ}
                            aria-busy={isSubmittingRFQ || undefined}
                        >
                            {isSubmittingRFQ ? <span className="sila-spinner" aria-hidden="true" /> : <IconSend />}
                            {isSubmittingRFQ ? "Submitting..." : "Submit RFQ"}
                        </button>
                    </div>
                </div>
            )}

            {activeStep === "summary" && (
                <div className="bd-success-wrap">
                    <div className="bd-success-icon-circle" aria-hidden="true">
                        <IconCheckBig />
                    </div>
                    <h2 className="bd-success-title">RFQ Submitted Successfully!</h2>
                    <p className="bd-success-sub">
                        The RFQ was registered as <strong className="sila-ref">{rfqNumber}</strong>. Interactive logic dispatched notifications to invited vendors.
                    </p>

                    <div className="bd-table-card bd-success-table-card">
                        <table className="bd-table bd-success-table">
                            <thead>
                                <tr>
                                    <th>Supplier Name</th>
                                    <th>Email</th>
                                    <th>Delivery Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {selectedSuppliers.map((s) => (
                                    <tr key={s.supplierId}>
                                        <td>{s.supplierName}</td>
                                        <td>{s.email}</td>
                                        <td>
                                            {s.isVerified ? (
                                                <StatusBadge status="Sent" tone="success" label="RFQ Sent" dot />
                                            ) : (
                                                <StatusBadge status="Sent" tone="warning" label="Invitation Sent" dot />
                                            )}
                                        </td>
                                    </tr>
                                ))}
                                {externalSuppliers.map((s, idx) => (
                                    <tr key={`external-${s.email}-${idx}`}>
                                        <td>{s.supplierName}</td>
                                        <td>{s.email}</td>
                                        <td>
                                            <StatusBadge status="Sent" tone="warning" label="Invitation Sent" dot />
                                        </td>
                                    </tr>
                                ))}
                                {selectedSuppliers.length === 0 && externalSuppliers.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="bd-table-empty">
                                            No suppliers were selected.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="bd-success-footer">
                        <button
                            className="bd-btn-back"
                            onClick={() => onNavClick("dashboard")}
                            type="button"
                        >
                            Back to Dashboard
                        </button>
                        <button
                            className="bd-btn-dark"
                            onClick={() => onNavClick("activeRFQs")}
                            type="button"
                        >
                            View RFQs List
                        </button>
                    </div>
                </div>
            )}
            </div>

            {isViewTemplateOpen && (
                <div className="bd-template-modal-overlay" onClick={closeViewTemplate}>
                    <div
                        className="bd-template-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="bd-template-modal-title"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bd-template-modal-header">
                            <div>
                                <h2 className="bd-template-modal-title" id="bd-template-modal-title">
                                    {viewTemplateData?.templateName || "Registration Template"}
                                </h2>
                                <div className="bd-template-modal-subtitle">
                                    {viewTemplateData?.templateType ? `${viewTemplateData.templateType} • ` : ""}
                                    Code: {viewTemplateData?.templateCode ? <span className="sila-ref">{viewTemplateData.templateCode}</span> : "-"}
                                </div>
                            </div>
                            <button type="button" className="bd-template-modal-close" onClick={closeViewTemplate}>
                                Close
                            </button>
                        </div>

                        <div className="bd-template-modal-body">
                            {viewTemplateLoading && (
                                <div className="bd-template-modal-status">
                                    <Loader size={24} message="Loading template..." />
                                </div>
                            )}
                            {!viewTemplateLoading && viewTemplateError && (
                                <div className="bd-template-modal-error sila-alert sila-alert--danger" role="alert">{viewTemplateError}</div>
                            )}
                            {!viewTemplateLoading && !viewTemplateError && viewTemplateData && (
                                viewTemplateData.questions && viewTemplateData.questions.length > 0 ? (
                                    viewTemplateData.questions
                                        .slice()
                                        .sort((a, b) => a.displayOrder - b.displayOrder)
                                        .map((q) => (
                                            <div className="bd-template-question-card" key={q.questionId}>
                                                <div className="bd-template-question-head">
                                                    <div className="bd-template-question-label">{q.question}</div>
                                                    {q.isRequired && (
                                                        <span className="bd-template-question-mandatory sila-badge sila-badge--danger sila-badge--sm">MANDATORY</span>
                                                    )}
                                                </div>
                                                <div className="bd-template-question-meta">Type: {q.questionType}</div>
                                                {q.options && q.options.length > 0 && (
                                                    <div className="bd-template-question-meta">
                                                        Options: {q.options.join(", ")}
                                                    </div>
                                                )}
                                            </div>
                                        ))
                                ) : (
                                    <div className="bd-template-modal-status">No questions configured for this template.</div>
                                )
                            )}
                        </div>
                    </div>
                </div>
            )}

            <ItemMasterModal
                isOpen={isItemMasterModalOpen}
                onClose={() => setIsItemMasterModalOpen(false)}
                buyerId={buyerProfileId}
                api={api.itemMaster}
            />

            <ItemMasterUploadModal
                isOpen={isItemMasterUploadModalOpen}
                onClose={() => setIsItemMasterUploadModalOpen(false)}
                buyerId={buyerProfileId}
                organizationId={buyerOrganizationId}
                api={api.itemMasterUpload}
            />

            <SupplierUsersModal
                isOpen={!!activeSupplierForUsers}
                supplierName={activeSupplierForUsers?.supplierName || ""}
                organizationId={activeSupplierForUsers?.organizationId}
                initialSelectedUserIds={
                    activeSupplierForUsers
                        ? supplierSelectedUserIds[activeSupplierForUsers.supplierId] || []
                        : []
                }
                api={api.supplierUsers}
                onClose={() => setActiveSupplierForUsers(null)}
                onSave={(userIds) => {
                    if (activeSupplierForUsers) {
                        handleSaveSupplierUsers(activeSupplierForUsers.supplierId, userIds);
                    }
                }}
            />

            <ExternalSupplierModal
                isOpen={isExternalSupplierModalOpen}
                onClose={() => setIsExternalSupplierModalOpen(false)}
                onAdd={handleAddExternalSupplier}
            />
        </div>
    );
};

export default CreateRFQ;
