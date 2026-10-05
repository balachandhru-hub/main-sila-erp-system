import { useState, useEffect, useRef } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Country, State, City } from "country-state-city";
import { FaCheck, FaChevronDown, FaCloudUploadAlt, FaMinus, FaPaperclip, FaPlus, FaTimes, FaTrashAlt } from "react-icons/fa";
import "./BuyerProfile.css";

// TODO: Update this import path to match your actual file location
import { fetchSegments, fetchClasses, fetchReferenceList } from "../api/masterdataApi";
import type { SelectedProduct, SelectedSubProduct } from "../api/masterdataApi";
import type { BuyerProfileResponse } from "../api/Buyerapi";

interface BusinessInfo {
    industry: string;
    businessType: string;
    employeeCount: string;
    annualTurnover: string;
    currency: string;
    yearEstablished: string;
    website: string;
    companyDescription: string;
}

interface Registration {
    id: string;
    type: string;
    number: string;
    name: string;
    expiryDate: string;
    attachmentName: string;
    certificateFile: File | null;
}

interface BankAccount {
    id: string;
    accountHolderName: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    ifscCode: string;
    swiftCode: string;
    iban: string;
    currency: string;
    isPrimary: boolean;
}

interface DispatchLocation {
    id: string;
    locationName: string;
    contactPerson: string;
    country: string;
    state: string;
    addressLine1: string;
    addressLine2: string;
    city: string;
    pinZip: string;
    contactEmail: string;
    contactPhone: string;
    isDefault: boolean;
}

interface Agreements {
    infoAccurate: boolean;
    agreeTerms: boolean;
    authorizeVerification: boolean;
}

// ============================================================================
// UPDATED: Props now include categories data
// ============================================================================
interface BuyerProfileProps {
    onComplete?: (data: {
        businessInfo: BusinessInfo;
        registrations: Registration[];
        bankAccounts: BankAccount[];
        dispatchLocations: DispatchLocation[];
        selectedProducts: SelectedProduct[];
        selectedSubProducts: SelectedSubProduct[];
    }) => Promise<void> | void;
    onboardingData?: {
        organizationName: string;
        email: string;
        phone: string;
        country: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        state: string;
        pinCode: string;
    } | null;
    rejectedProfile?: BuyerProfileResponse | null;
}


// ============================================================================
// UPDATED: 5 steps now
// ============================================================================
const STEP_LABELS = [
    "Business Information",
    "Product & Service Categories",
    "Registrations & Certifications",
    "Bank Account Information",
    "Dispatch Locations",
];

const CURRENCIES = ["INR", "USD", "EUR", "GBP", "AED", "SGD"];





const YEARS = Array.from({ length: 60 }, (_, i) => String(new Date().getFullYear() - i));


const emptyBusinessInfo: BusinessInfo = {
    industry: "",
    businessType: "",
    employeeCount: "",
    annualTurnover: "",
    currency: "INR",
    yearEstablished: "",
    website: "",
    companyDescription: "",
};

const emptyRegistrationDraft = {
    type: "Select Registration Type",
    number: "",
    name: "",
    expiryDate: "",
    attachmentName: "",
    certificateFile: null as File | null,
};

const emptyBankDraft = {
    accountHolderName: "",
    bankName: "",
    branchName: "",
    accountNumber: "",
    ifscCode: "",
    swiftCode: "",
    iban: "",
    currency: "INR",
    isPrimary: false,
};

const emptyLocationDraft = {
    locationName: "",
    contactPerson: "",
    country: "",
    state: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    pinZip: "",
    contactEmail: "",
    contactPhone: "",
    isDefault: false,
};

function makeId(): string {
    return Math.random().toString(36).slice(2, 10);
}

function maskAccountNumber(accountNumber: string): string {
    if (accountNumber.length <= 4) return accountNumber;
    const last4 = accountNumber.slice(-4);
    return "X".repeat(accountNumber.length - 4) + last4;
}


// ============================================================================
// Teammate's ProductDropdown component (unchanged)
// ============================================================================
function ProductDropdown({
    segments,
    onSelect,
    loading
}: {
    segments: any[];
    onSelect: (family: SelectedProduct) => void;
    loading: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedSegments, setExpandedSegments] = useState<number[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleExpand = (segmentId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedSegments(prev =>
            prev.includes(segmentId) ? prev.filter(id => id !== segmentId) : [...prev, segmentId]
        );
    };

    return (
        <div ref={containerRef} className="custom-dropdown-container">
            <button
                type="button"
                id="bp-product-trigger"
                className="custom-dropdown-trigger"
                onClick={() => setIsOpen(!isOpen)}
                aria-haspopup="true"
                aria-expanded={isOpen}
            >
                <span>Select product</span>
                <FaChevronDown className="custom-dropdown-caret" aria-hidden="true" />
            </button>

            {isOpen && (
                <div className="custom-dropdown-menu">
                    {loading ? (
                        <div className="custom-dropdown-item-loading">
                            Loading products...
                        </div>
                    ) : segments.length === 0 ? (
                        <div className="custom-dropdown-item-empty">
                            No products found.
                        </div>
                    ) : (
                        segments.map((seg) => {
                            const isExpanded = expandedSegments.includes(seg.segment);
                            return (
                                <div key={seg.segment} className="custom-dropdown-item-wrapper">
                                    <div className="segment-row" onClick={(e) => toggleExpand(seg.segment, e)}>
                                        <span>{seg.title}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => toggleExpand(seg.segment, e)}
                                            aria-expanded={isExpanded}
                                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${seg.title}`}
                                        >
                                            {isExpanded ? <FaMinus aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                                        </button>
                                    </div>
                                    {isExpanded && seg.family && (
                                        <div className="nested-items-container">
                                            {seg.family.map((fam: any) => (
                                                <div
                                                    key={fam.family}
                                                    className="nested-item-row"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        onSelect({ segment: seg.segment, family: fam.family, title: fam.title });
                                                        setIsOpen(false);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            onSelect({ segment: seg.segment, family: fam.family, title: fam.title });
                                                            setIsOpen(false);
                                                        }
                                                    }}
                                                >
                                                    {fam.title} ({fam.family})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// Teammate's SubProductDropdown component (unchanged)
// ============================================================================
function SubProductDropdown({
    classes,
    onSelect,
    disabled,
    loading
}: {
    classes: any[];
    onSelect: (commodity: SelectedSubProduct) => void;
    disabled: boolean;
    loading: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [expandedClasses, setExpandedClasses] = useState<number[]>([]);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const toggleExpand = (classId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        setExpandedClasses(prev =>
            prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]
        );
    };

    return (
        <div ref={containerRef} className="custom-dropdown-container">
            <button
                type="button"
                id="bp-subproduct-trigger"
                className={`custom-dropdown-trigger ${disabled ? 'custom-dropdown-trigger-disabled' : ''}`}
                onClick={() => !disabled && setIsOpen(!isOpen)}
                disabled={disabled}
                aria-haspopup="true"
                aria-expanded={!disabled && isOpen}
            >
                <span>
                    {disabled ? 'Please select a product first' : 'Select sub-product'}
                </span>
                <FaChevronDown className="custom-dropdown-caret" aria-hidden="true" />
            </button>

            {!disabled && isOpen && (
                <div className="custom-dropdown-menu">
                    {loading ? (
                        <div className="custom-dropdown-item-loading">
                            Loading sub-products...
                        </div>
                    ) : classes.length === 0 ? (
                        <div className="custom-dropdown-item-empty">
                            No sub-products found.
                        </div>
                    ) : (
                        classes.map((cls) => {
                            const isExpanded = expandedClasses.includes(cls.class);
                            return (
                                <div key={cls.class} className="custom-dropdown-item-wrapper">
                                    <div className="class-row" onClick={(e) => toggleExpand(cls.class, e)}>
                                        <span>{cls.title}</span>
                                        <button
                                            type="button"
                                            onClick={(e) => toggleExpand(cls.class, e)}
                                            aria-expanded={isExpanded}
                                            aria-label={`${isExpanded ? 'Collapse' : 'Expand'} ${cls.title}`}
                                        >
                                            {isExpanded ? <FaMinus aria-hidden="true" /> : <FaPlus aria-hidden="true" />}
                                        </button>
                                    </div>
                                    {isExpanded && cls.commodity && (
                                        <div className="nested-items-container">
                                            {cls.commodity.map((com: any) => (
                                                <div
                                                    key={com.commodity}
                                                    className="nested-item-row"
                                                    role="button"
                                                    tabIndex={0}
                                                    onClick={() => {
                                                        onSelect({ class: cls.class, commodity: com.commodity, title: com.title });
                                                        setIsOpen(false);
                                                    }}
                                                    onKeyDown={(e) => {
                                                        if (e.key === "Enter" || e.key === " ") {
                                                            e.preventDefault();
                                                            onSelect({ class: cls.class, commodity: com.commodity, title: com.title });
                                                            setIsOpen(false);
                                                        }
                                                    }}
                                                >
                                                    {com.title} ({com.commodity})
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}


// ============================================================================
// MAIN COMPONENT
// ============================================================================
export default function BuyerProfile({ onComplete, onboardingData, rejectedProfile }: BuyerProfileProps) {
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState<number>(1);
    const [furthestStep, setFurthestStep] = useState<number>(1);

    const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(emptyBusinessInfo);
    // ============================================================================
    // NEW: Categories states from teammate's code
    // ============================================================================
    const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([]);
    const [selectedSubProducts, setSelectedSubProducts] = useState<SelectedSubProduct[]>([]);
    const [activeProduct, setActiveProduct] = useState<SelectedProduct | null>(null);
    const [segments, setSegments] = useState<any[]>([]);
    const [loadingSegments, setLoadingSegments] = useState(false);
    const [classes, setClasses] = useState<any[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(false);
    const [industries, setIndustries] = useState<any[]>([]);
    const [loadingIndustries, setLoadingIndustries] = useState(false);

    const handleIndustryFocus = async () => {
        if (industries.length === 0 && !loadingIndustries) {
            setLoadingIndustries(true);
            try {
                const data = await fetchReferenceList(["INDUSTRY"]);
if (Array.isArray(data)) {
    setIndustries(data);
}
            } catch (err) {
                console.error("Failed to load industries:", err);
            } finally {
                setLoadingIndustries(false);
            }
        }
    };

    const [businessTypes, setBusinessTypes] = useState<any[]>([]);
    const [loadingBusinessTypes, setLoadingBusinessTypes] = useState(false);

    const handleBusinessTypeFocus = async () => {
        if (businessTypes.length === 0 && !loadingBusinessTypes) {
            setLoadingBusinessTypes(true);
            try {
                const data = await fetchReferenceList(["BUSINESS_TYPE"]);
if (Array.isArray(data)) {
    setBusinessTypes(data);
}
            } catch (err) {
                console.error("Failed to load business types:", err);
            } finally {
                setLoadingBusinessTypes(false);
            }
        }
    };

    const [documentTypes, setDocumentTypes] = useState<any[]>([]);
    const [loadingDocumentTypes, setLoadingDocumentTypes] = useState(false);

    const handleDocumentTypeFocus = async () => {
        if (documentTypes.length === 0 && !loadingDocumentTypes) {
            setLoadingDocumentTypes(true);
            try {
                const data = await fetchReferenceList(["DOCUMENT_TYPE"]);
if (Array.isArray(data)) {
    setDocumentTypes(data);
}
            } catch (err) {
                console.error("Failed to load document types:", err);
            } finally {
                setLoadingDocumentTypes(false);
            }
        }
    };

    // Load segments on mount
    useEffect(() => {
        const loadSegments = async () => {
            setLoadingSegments(true);
            try {
                const data = await fetchSegments();
if (Array.isArray(data)) {
    setSegments(data);
}
            } catch (err) {
                console.error("Failed to load segments:", err);
            } finally {
                setLoadingSegments(false);
            }
        };
        loadSegments();
    }, []);

    // Load classes when active product changes
    useEffect(() => {
        if (!activeProduct) {
            setClasses([]);
            return;
        }
        const loadClasses = async () => {
            setLoadingClasses(true);
            try {
                const data = await fetchClasses(activeProduct.segment, activeProduct.family);
if (Array.isArray(data)) {
    setClasses(data);
}
            } catch (err) {
                console.error("Failed to load classes:", err);
            } finally {
                setLoadingClasses(false);
            }
        };
        loadClasses();
    }, [activeProduct]);

    const handleSelectProduct = (product: SelectedProduct) => {
        if (!selectedProducts.some(p => p.family === product.family)) {
            setSelectedProducts((prev) => [...prev, product]);
        }
        setActiveProduct(product);
    };

    const handleRemoveProduct = (familyCode: number) => {
        setSelectedProducts((prev) => {
            const remaining = prev.filter(p => p.family !== familyCode);
            if (activeProduct?.family === familyCode) {
                if (remaining.length > 0) {
                    setActiveProduct(remaining[remaining.length - 1]);
                } else {
                    setActiveProduct(null);
                }
            }
            return remaining;
        });
    };

    const handleSelectSubProduct = (subProduct: SelectedSubProduct) => {
        if (!selectedSubProducts.some(p => p.commodity === subProduct.commodity)) {
            setSelectedSubProducts((prev) => [...prev, {
                ...subProduct,
                parentSegment: activeProduct?.segment || 0,
                parentFamily: activeProduct?.family || 0,
                parentTitle: activeProduct?.title || '',
            }]);
        }
    };

    const handleRemoveSubProduct = (commodityCode: number) => {
        setSelectedSubProducts((prev) => prev.filter((p) => p.commodity !== commodityCode));
    };

    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [registrationDraft, setRegistrationDraft] = useState(emptyRegistrationDraft);

    const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
    const [bankDraft, setBankDraft] = useState(emptyBankDraft);

    const [dispatchLocations, setDispatchLocations] = useState<DispatchLocation[]>([]);
    const [locationDraft, setLocationDraft] = useState(emptyLocationDraft);

    const [agreements, setAgreements] = useState<Agreements>({
        infoAccurate: false,
        agreeTerms: false,
        authorizeVerification: false,
    });

    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ============================================================================
    // NEW: Auto-populate form if rejectedProfile is provided
    // ============================================================================
    useEffect(() => {
        if (rejectedProfile) {
            if (rejectedProfile.businessProfile) {
                setBusinessInfo({
                    industry: rejectedProfile.businessProfile.industry || "",
                    businessType: rejectedProfile.businessProfile.businessType || "",
                    employeeCount: rejectedProfile.businessProfile.employeeCount?.toString() || "",
                    annualTurnover: rejectedProfile.businessProfile.annualTurnover?.toString() || "",
                    currency: rejectedProfile.businessProfile.currency || "INR",
                    yearEstablished: rejectedProfile.businessProfile.yearEstablished?.toString() || "",
                    website: rejectedProfile.businessProfile.website || "",
                    companyDescription: rejectedProfile.businessProfile.description || "",
                });
            }

            const rawCategories = rejectedProfile.categories || rejectedProfile.buyerCategories || [];
            if (rawCategories && rawCategories.length > 0) {
                const productsMap = new Map<number, SelectedProduct>();
                const subProducts: SelectedSubProduct[] = [];

                rawCategories.forEach((cat: any) => {
                    if (cat.family && !productsMap.has(cat.family)) {
                        productsMap.set(cat.family, {
                            segment: cat.segment || 0,
                            family: cat.family || 0,
                            title: cat.familyTitle || cat.segmentTitle || 'Category',
                        });
                    }
                    if (cat.commodity) {
                        subProducts.push({
                            class: cat.class || 0,
                            commodity: cat.commodity || 0,
                            title: cat.commodityTitle || cat.classTitle || 'Sub-Product',
                            parentSegment: cat.segment || 0,
                            parentFamily: cat.family || 0,
                            parentTitle: cat.familyTitle || cat.segmentTitle || '',
                        });
                    }
                });

                const productsList = Array.from(productsMap.values());
                if (productsList.length > 0) {
                    setSelectedProducts(productsList);
                    setActiveProduct(productsList[0]);
                }
                if (subProducts.length > 0) {
                    setSelectedSubProducts(subProducts);
                }
            }

            if (rejectedProfile.registrations && rejectedProfile.registrations.length > 0) {
                const mappedRegistrations = rejectedProfile.registrations.map(r => ({
                    id: makeId(),
                    type: r.registrationType || "",
                    number: r.registrationNumber || "",
                    name: r.registrationName || "",
                    expiryDate: r.expiryDate ? r.expiryDate.split('T')[0] : "",
                    attachmentName: r.asset?.fileName || "",
                    certificateFile: null,
                }));
                setRegistrationDraft({
                    type: mappedRegistrations[0].type || "GST",
                    number: mappedRegistrations[0].number,
                    name: mappedRegistrations[0].name,
                    expiryDate: mappedRegistrations[0].expiryDate,
                    attachmentName: mappedRegistrations[0].attachmentName,
                    certificateFile: null,
                });
                setRegistrations(mappedRegistrations.slice(1));
            }

            if (rejectedProfile.bankAccounts && rejectedProfile.bankAccounts.length > 0) {
                const mappedBanks = rejectedProfile.bankAccounts.map(b => ({
                    id: makeId(),
                    accountHolderName: b.accountHolderName || "",
                    bankName: b.bankName || "",
                    branchName: b.branchName || "",
                    accountNumber: b.accountNumber || "",
                    ifscCode: b.ifscCode || "",
                    swiftCode: b.swiftCode || "",
                    iban: "",
                    currency: b.currency || "INR",
                    isPrimary: b.isPrimary || false,
                }));
                setBankDraft({
                    accountHolderName: mappedBanks[0].accountHolderName,
                    bankName: mappedBanks[0].bankName,
                    branchName: mappedBanks[0].branchName,
                    accountNumber: mappedBanks[0].accountNumber,
                    ifscCode: mappedBanks[0].ifscCode,
                    swiftCode: mappedBanks[0].swiftCode,
                    iban: mappedBanks[0].iban,
                    currency: mappedBanks[0].currency || "INR",
                    isPrimary: mappedBanks[0].isPrimary,
                });
                setBankAccounts(mappedBanks.slice(1));
            }

            if (rejectedProfile.dispatchLocations && rejectedProfile.dispatchLocations.length > 0) {
                const mappedLocations = rejectedProfile.dispatchLocations.map(l => ({
                    id: makeId(),
                    locationName: l.locationName || "",
                    contactPerson: l.contactPerson || "",
                    country: l.country || "",
                    state: l.state || "",
                    addressLine1: l.addressLine1 || "",
                    addressLine2: l.addressLine2 || "",
                    city: l.city || "",
                    pinZip: l.pinCode || "",
                    contactEmail: "",
                    contactPhone: l.contactPhone || "",
                    isDefault: l.isDefault || false,
                }));
                setLocationDraft({
                    locationName: mappedLocations[0].locationName,
                    contactPerson: mappedLocations[0].contactPerson,
                    country: mappedLocations[0].country,
                    state: mappedLocations[0].state,
                    addressLine1: mappedLocations[0].addressLine1,
                    addressLine2: mappedLocations[0].addressLine2,
                    city: mappedLocations[0].city,
                    pinZip: mappedLocations[0].pinZip,
                    contactEmail: mappedLocations[0].contactEmail,
                    contactPhone: mappedLocations[0].contactPhone,
                    isDefault: mappedLocations[0].isDefault,
                });
                setDispatchLocations(mappedLocations.slice(1));
            }
        }
    }, [rejectedProfile]);

    /* ---------------------------- navigation --------------------------- */

    function goToStep(step: number) {
        if (step <= furthestStep) {
            setCurrentStep(step);
        }
    }

    function handleNext() {
        const next = Math.min(currentStep + 1, STEP_LABELS.length);
        setCurrentStep(next);
        setFurthestStep((prev) => Math.max(prev, next));
    }

    function handleBack() {
        setCurrentStep((prev) => Math.max(prev - 1, 1));
    }

    /* ------------------------- step 1 handlers -------------------------- */

    function updateBusinessInfo<K extends keyof BusinessInfo>(field: K, value: BusinessInfo[K]) {
        setBusinessInfo((prev) => ({ ...prev, [field]: value }));
    }

    /* ------------------------- step 3 handlers (was step 2) -------------------------- */

    function updateRegistrationDraft(field: keyof typeof registrationDraft, value: string) {
        setRegistrationDraft((prev) => ({ ...prev, [field]: value }));
    }

    function handleRegistrationFile(e: ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (file) {
            updateRegistrationDraft("attachmentName", file.name);
            updateRegistrationDraft("certificateFile", file.name);
        }
    }

    function addRegistration() {
        if (!registrationDraft.number || !registrationDraft.name) return;
        setRegistrations((prev) => [...prev, { id: makeId(), ...registrationDraft }]);
        setRegistrationDraft(emptyRegistrationDraft);
    }

    function removeRegistration(id: string) {
        setRegistrations((prev) => prev.filter((r) => r.id !== id));
    }

    /* ------------------------- step 4 handlers (was step 3) -------------------------- */

    function updateBankDraft<K extends keyof typeof bankDraft>(field: K, value: (typeof bankDraft)[K]) {
        setBankDraft((prev) => ({ ...prev, [field]: value }));
    }

    function addBankAccount() {
        if (!bankDraft.accountHolderName || !bankDraft.bankName || !bankDraft.accountNumber) return;
        setBankAccounts((prev) => [...prev, { id: makeId(), ...bankDraft }]);
        setBankDraft(emptyBankDraft);
    }

    function removeBankAccount(id: string) {
        setBankAccounts((prev) => prev.filter((b) => b.id !== id));
    }

    /* ------------------------- step 5 handlers (was step 4) -------------------------- */

    function updateLocationDraft<K extends keyof typeof locationDraft>(
        field: K,
        value: (typeof locationDraft)[K]
    ) {
        setLocationDraft((prev) => ({ ...prev, [field]: value }));
    }

    function addLocation() {
        if (!locationDraft.locationName || !locationDraft.addressLine1 || !locationDraft.city) return;

        setDispatchLocations((prev) => [...prev, {
            id: makeId(),
            ...locationDraft
        }]);

        setLocationDraft(emptyLocationDraft);
    }

    function removeLocation(id: string) {
        setDispatchLocations((prev) => prev.filter((l) => l.id !== id));
    }

    function updateAgreement(field: keyof Agreements, value: boolean) {
        setAgreements((prev) => ({ ...prev, [field]: value }));
    }

    const canSubmit =
        agreements.infoAccurate && agreements.agreeTerms && agreements.authorizeVerification;

    // ============================================================================
    // UPDATED: Auto-include draft data on submit if user didn't click "+ Add"
    // ============================================================================
    async function handleSubmitProfile(e: FormEvent) {
        e.preventDefault();
        if (!canSubmit) return;

        setError(null);
        setSubmitting(true);

        try {
            // Auto-include registration draft if filled
            let finalRegistrations = [...registrations];
            if (registrationDraft.number && registrationDraft.name) {
                finalRegistrations = [...finalRegistrations, { id: makeId(), ...registrationDraft }];
            }

            // Auto-include bank account draft if filled
            let finalBankAccounts = [...bankAccounts];
            if (bankDraft.accountHolderName && bankDraft.bankName && bankDraft.accountNumber) {
                finalBankAccounts = [...finalBankAccounts, { id: makeId(), ...bankDraft }];
            }

            // Auto-include location draft if filled
            let finalLocations = [...dispatchLocations];
            if (locationDraft.locationName && locationDraft.addressLine1 && locationDraft.city) {
                finalLocations = [...finalLocations, { id: makeId(), ...locationDraft }];
            }

            if (onComplete) {
                await onComplete({
                    businessInfo,
                    registrations: finalRegistrations,
                    bankAccounts: finalBankAccounts,
                    dispatchLocations: finalLocations,
                    selectedProducts,
                    selectedSubProducts,
                });
                setSubmitted(true);
            } else {
                setSubmitted(true);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to submit profile. Please try again.');
            console.error('Error submitting profile:', err);
        } finally {
            setSubmitting(false);
        }
    }

    /* ------------------------------------------------------------------ */
    /*  Render helpers                                                     */
    /* ------------------------------------------------------------------ */

    function renderStepIndicator() {
        return (
            <nav className="bp-sidebar" aria-label="Profile setup steps">
                {STEP_LABELS.map((label, idx) => {
                    const stepNum = idx + 1;
                    const isComplete = stepNum < furthestStep || (submitted && stepNum <= STEP_LABELS.length);
                    const isCurrent = stepNum === currentStep && !submitted;
                    const isClickable = stepNum <= furthestStep;

                    let circleClass = "bp-step-circle";
                    if (isComplete) circleClass += " bp-step-complete";
                    else if (isCurrent) circleClass += " bp-step-current";

                    let labelClass = "bp-step-label";
                    if (isComplete) labelClass += " bp-step-complete-label";
                    else if (isCurrent) labelClass += " bp-step-current-label";

                    return (
                        <button
                            type="button"
                            key={label}
                            className={`bp-step-item ${isClickable ? "bp-step-clickable" : ""}`}
                            onClick={() => isClickable && goToStep(stepNum)}
                            disabled={!isClickable}
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            <span className={circleClass} aria-hidden="true">
                                {isComplete ? <FaCheck /> : stepNum}
                            </span>
                            <span className={labelClass}>
                                {label}
                                {isComplete && <span className="sila-visually-hidden"> (completed)</span>}
                            </span>
                        </button>
                    );
                })}
            </nav>
        );
    }

    // ============================================================================
    // NEW: Company Information read-only section
    // ============================================================================
    function renderCompanyInfo() {
        if (!onboardingData) return null;

        return (
            <div className="bp-panel">
                <h2 className="bp-panel-title">Company Information</h2>
                <div className="bp-divider" />
                <div className="bp-company-info-grid">
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">Organization Name</span>
                        <span className="bp-company-info-value">{onboardingData.organizationName || '—'}</span>
                    </div>
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">Email</span>
                        <span className="bp-company-info-value">{onboardingData.email || '—'}</span>
                    </div>
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">Phone</span>
                        <span className="bp-company-info-value">{onboardingData.phone || '—'}</span>
                    </div>
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">Country</span>
                        <span className="bp-company-info-value">{onboardingData.country || '—'}</span>
                    </div>
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">City</span>
                        <span className="bp-company-info-value">{onboardingData.city || '—'}</span>
                    </div>
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">State</span>
                        <span className="bp-company-info-value">{onboardingData.state || '—'}</span>
                    </div>
                    <div className="bp-company-info-item">
                        <span className="bp-company-info-label">PIN / ZIP Code</span>
                        <span className="bp-company-info-value">{onboardingData.pinCode || '—'}</span>
                    </div>
                    <div className="bp-company-info-item bp-company-info-item-full">
                        <span className="bp-company-info-label">Address</span>
                        <span className="bp-company-info-value">
                            {onboardingData.addressLine1 ? (
                                <>
                                    {onboardingData.addressLine1}
                                    {onboardingData.addressLine2 && <><br />{onboardingData.addressLine2}</>}
                                    <br />
                                    {onboardingData.city}{onboardingData.city && onboardingData.state ? ', ' : ''}{onboardingData.state} {onboardingData.pinCode}
                                    <br />
                                    {onboardingData.country}
                                </>
                            ) : '—'}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    function renderStep1() {
        return (
            <>
                <div className="bp-panel">
                    <h2 className="bp-panel-title">Step 1: Business Information</h2>
                    <div className="bp-divider" />
                    <div className="bp-form-grid">
                        <div className="bp-field">
                            <label htmlFor="industry">
                                Industry<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="industry"
                                value={businessInfo.industry}
                                onFocus={handleIndustryFocus}
                                onClick={handleIndustryFocus}
                                onChange={(e) => updateBusinessInfo("industry", e.target.value)}
                            >
                                <option value="">{loadingIndustries ? "Loading..." : "Select Industry"}</option>
                                {industries.length > 0 &&
                                    industries.map((i) => (
                                        <option key={i.key} value={i.key}>
                                            {i.key}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="bp-field">
                            <label htmlFor="businessType">
                                Business Type<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="businessType"
                                value={businessInfo.businessType}
                                onFocus={handleBusinessTypeFocus}
                                onClick={handleBusinessTypeFocus}
                                onChange={(e) => updateBusinessInfo("businessType", e.target.value)}
                            >
                                <option value="">{loadingBusinessTypes ? "Loading..." : "Select Business Type"}</option>
                                {businessTypes.length > 0 &&
                                    businessTypes.map((t) => (
                                        <option key={t.key} value={t.key}>
                                            {t.key}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        <div className="bp-field">
                            <label htmlFor="employeeCount">Employee Count</label>
                            <input
                                id="employeeCount"
                                type="number"
                                min={0}
                                value={businessInfo.employeeCount}
                                onChange={(e) => updateBusinessInfo("employeeCount", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="annualTurnover">Annual Turnover</label>
                            <input
                                id="annualTurnover"
                                type="number"
                                min={0}
                                value={businessInfo.annualTurnover}
                                onChange={(e) => updateBusinessInfo("annualTurnover", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="currency">Currency</label>
                            <select
                                id="currency"
                                value={businessInfo.currency}
                                onChange={(e) => updateBusinessInfo("currency", e.target.value)}
                            >
                                {CURRENCIES.map((c) => (
                                    <option key={c} value={c}>
                                        {c}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bp-field">
                            <label htmlFor="yearEstablished">Year Established</label>
                            <select
                                id="yearEstablished"
                                value={businessInfo.yearEstablished}
                                onChange={(e) => updateBusinessInfo("yearEstablished", e.target.value)}
                            >
                                <option value="">Select Year</option>
                                {YEARS.map((y) => (
                                    <option key={y} value={y}>
                                        {y}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bp-field bp-field-wide">
                            <label htmlFor="website">Website</label>
                            <input
                                id="website"
                                type="url"
                                placeholder="https://"
                                value={businessInfo.website}
                                onChange={(e) => updateBusinessInfo("website", e.target.value)}
                            />
                        </div>

                        <div className="bp-field bp-field-wide">
                            <label htmlFor="companyDescription">Company Description</label>
                            <textarea
                                id="companyDescription"
                                rows={4}
                                placeholder="Tell buyers about your company, products, services and capabilities..."
                                value={businessInfo.companyDescription}
                                onChange={(e) => updateBusinessInfo("companyDescription", e.target.value)}
                            />
                        </div>
                    </div>
                </div>
                {renderCompanyInfo()}
                <div className="bp-actions bp-actions-right bp-actions-standalone">
                    <button type="button" className="bp-btn bp-btn-primary" onClick={handleNext}>
                        Next
                    </button>
                </div>
            </>
        );
    }

    // ============================================================================
    // NEW: Step 2 - Product & Service Categories (from teammate)
    // ============================================================================
    function renderStep2() {
        return (
            <div className="bp-panel">
                <h2 className="bp-panel-title">Step 2: Product &amp; Service Categories</h2>
                <div className="bp-divider" />

                <div className="bp-category-section">

                    <div className="bp-field">
                        <label htmlFor="bp-product-trigger">
                            Select Product (Segment &amp; Family)<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <ProductDropdown
                            segments={segments}
                            onSelect={handleSelectProduct}
                            loading={loadingSegments}
                        />
                    </div>

                    <div className="bp-category-section-subtitle">
                        Selected Products ({selectedProducts.length}) - <em>Click a tag to select it for sub-products</em>
                    </div>

                    <div className="bp-category-tags">
                        {selectedProducts.length === 0 ? (
                            <span className="custom-dropdown-item-empty">No products selected yet.</span>
                        ) : (
                            selectedProducts.map((p) => {
                                const isActive = activeProduct?.family === p.family;
                                return (
                                    <span
                                        key={p.family}
                                        className={`bp-category-tag ${isActive ? 'bp-category-tag-active' : ''}`}
                                        onClick={() => setActiveProduct(p)}
                                        onKeyDown={(e) => {
                                            if (e.target !== e.currentTarget) return;
                                            if (e.key === "Enter" || e.key === " ") {
                                                e.preventDefault();
                                                setActiveProduct(p);
                                            }
                                        }}
                                        role="button"
                                        tabIndex={0}
                                        aria-pressed={isActive}
                                    >
                                        {p.title} ({p.family})
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveProduct(p.family);
                                            }}
                                            aria-label={`Remove ${p.title}`}
                                        >
                                            <FaTimes aria-hidden="true" />
                                        </button>
                                    </span>
                                );
                            })
                        )}
                    </div>

                    <div className="bp-selector-divider" />

                    <div className="bp-field">
                        <label htmlFor="bp-subproduct-trigger">
                            Select Sub-Product (Class &amp; Commodity)
                            {activeProduct && <span className="bp-label-context"> - for {activeProduct.title}</span>}
                            <span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <SubProductDropdown
                            classes={classes}
                            onSelect={handleSelectSubProduct}
                            disabled={!activeProduct}
                            loading={loadingClasses}
                        />
                    </div>

                    <div className="bp-category-section-subtitle">
                        Selected Sub-Products ({selectedSubProducts.length})
                    </div>

                    <div className="bp-category-tags">
                        {selectedSubProducts.length === 0 ? (
                            <span className="custom-dropdown-item-empty">No sub-products selected yet.</span>
                        ) : (
                            selectedSubProducts.map((p) => (
                                <span
                                    key={p.commodity}
                                    className="bp-category-tag bp-category-tag-active-sub"
                                >
                                    {p.title} ({p.commodity})
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveSubProduct(p.commodity)}
                                        aria-label={`Remove ${p.title}`}
                                    >
                                        <FaTimes aria-hidden="true" />
                                    </button>
                                </span>
                            ))
                        )}
                    </div>
                </div>

                <div className="bp-actions bp-actions-right bp-actions-footer">
                    <button type="button" className="bp-btn bp-btn-secondary" onClick={handleBack}>
                        Back
                    </button>
                    <button type="button" className="bp-btn bp-btn-primary" onClick={handleNext}>
                        Next
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================================
    // Step 3: Registrations (was step 2)
    // ============================================================================
    function renderStep3() {
        return (
            <div className="bp-panel">
                <h2 className="bp-panel-title">Step 3: Registrations &amp; Certifications</h2>
                <div className="bp-divider" />
                <div className="bp-form-grid">
                    <div className="bp-field">
                        <label htmlFor="regType">Registration Type</label>
                        <select
                            id="regType"
                            value={registrationDraft.type}
                            onFocus={handleDocumentTypeFocus}
                            onClick={handleDocumentTypeFocus}
                            onChange={(e) => updateRegistrationDraft("type", e.target.value)}
                        >
                            <option value="">{loadingDocumentTypes ? "Loading..." : "Select Registration Type"}</option>
                            {documentTypes.length > 0 &&
                                documentTypes.map((t) => (
                                    <option key={t.key} value={t.key}>
                                        {t.key}
                                    </option>
                                ))}
                        </select>
                    </div>

                    <div className="bp-field">
                        <label htmlFor="regNumber">Registration Number</label>
                        <input
                            id="regNumber"
                            type="text"
                            value={registrationDraft.number}
                            onChange={(e) => updateRegistrationDraft("number", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="regName">Registration Name</label>
                        <input
                            id="regName"
                            type="text"
                            value={registrationDraft.name}
                            onChange={(e) => updateRegistrationDraft("name", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="regExpiry">Expiry Date</label>
                        <input
                            id="regExpiry"
                            type="date"
                            value={registrationDraft.expiryDate}
                            onChange={(e) => updateRegistrationDraft("expiryDate", e.target.value)}
                        />
                    </div>

                    <div className="bp-field bp-field-wide">
                        <label htmlFor="regUpload">Upload Certificate</label>
                        <label className="bp-dropzone" htmlFor="regUpload">
                            <FaCloudUploadAlt className="bp-dropzone-icon" aria-hidden="true" />
                            {registrationDraft.attachmentName || "Click to select file or drag and drop certificate here"}
                        </label>
                        <input
                            id="regUpload"
                            type="file"
                            className="bp-hidden-file-input"
                            onChange={handleRegistrationFile}
                        />
                    </div>
                </div>

                <div className="bp-actions bp-actions-right">
                    <button type="button" className="bp-btn bp-btn-primary" onClick={addRegistration}>
                        + Add Registration
                    </button>
                </div>

                <div className="bp-table-wrap">
                <table className="bp-table">
                    <thead>
                        <tr>
                            <th>Type</th>
                            <th>Number</th>
                            <th>Name</th>
                            <th>Expiry Date</th>
                            <th>Attachments</th>
                            <th className="bp-col-action">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {registrations.length === 0 ? (
                            <tr>
                                <td className="bp-empty-row" colSpan={6}>
                                    No registrations added yet.
                                </td>
                            </tr>
                        ) : (
                            registrations.map((r) => (
                                <tr key={r.id}>
                                    <td>{r.type}</td>
                                    <td><span className="sila-ref">{r.number}</span></td>
                                    <td>{r.name}</td>
                                    <td>{r.expiryDate}</td>
                                    <td>
                                        {r.attachmentName ? (
                                            <span className="bp-pill" title={r.attachmentName}>
                                                <FaPaperclip className="bp-pill-icon" aria-hidden="true" />
                                                {r.attachmentName.length > 10
                                                    ? `${r.attachmentName.slice(0, 8)}...`
                                                    : r.attachmentName}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="bp-col-action">
                                        <button
                                            type="button"
                                            className="bp-icon-btn"
                                            aria-label={`Remove ${r.name}`}
                                            onClick={() => removeRegistration(r.id)}
                                        >
                                            <FaTrashAlt aria-hidden="true" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>

                <div className="bp-actions bp-actions-right bp-actions-footer">
                    <button type="button" className="bp-btn bp-btn-secondary" onClick={handleBack}>
                        Back
                    </button>
                    <button type="button" className="bp-btn bp-btn-primary" onClick={handleNext}>
                        Next
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================================
    // Step 4: Bank Accounts (was step 3)
    // ============================================================================
    function renderStep4() {
        return (
            <div className="bp-panel">
                <h2 className="bp-panel-title">Step 4: Bank Account Information</h2>
                <div className="bp-divider" />
                <div className="bp-form-grid">
                    <div className="bp-field">
                        <label htmlFor="acctHolder">
                            Account Holder Name<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="acctHolder"
                            type="text"
                            value={bankDraft.accountHolderName}
                            onChange={(e) => updateBankDraft("accountHolderName", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="bankName">
                            Bank Name<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="bankName"
                            type="text"
                            value={bankDraft.bankName}
                            onChange={(e) => updateBankDraft("bankName", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="branchName">
                            Branch Name<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="branchName"
                            type="text"
                            value={bankDraft.branchName}
                            onChange={(e) => updateBankDraft("branchName", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="acctNumber">
                            Account Number<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="acctNumber"
                            type="text"
                            value={bankDraft.accountNumber}
                            onChange={(e) => updateBankDraft("accountNumber", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="ifsc">
                            IFSC Code<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <input
                            id="ifsc"
                            type="text"
                            value={bankDraft.ifscCode}
                            onChange={(e) => updateBankDraft("ifscCode", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="swift">SWIFT Code</label>
                        <input
                            id="swift"
                            type="text"
                            value={bankDraft.swiftCode}
                            onChange={(e) => updateBankDraft("swiftCode", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="iban">IBAN</label>
                        <input
                            id="iban"
                            type="text"
                            value={bankDraft.iban}
                            onChange={(e) => updateBankDraft("iban", e.target.value)}
                        />
                    </div>

                    <div className="bp-field">
                        <label htmlFor="bankCurrency">
                            Currency<span className="bp-required sila-required" aria-hidden="true">*</span>
                        </label>
                        <select
                            id="bankCurrency"
                            value={bankDraft.currency}
                            onChange={(e) => updateBankDraft("currency", e.target.value)}
                        >
                            {CURRENCIES.map((c) => (
                                <option key={c} value={c}>
                                    {c}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="bp-actions bp-actions-between">
                    <label className="bp-checkbox-label">
                        <input
                            type="checkbox"
                            checked={bankDraft.isPrimary}
                            onChange={(e) => updateBankDraft("isPrimary", e.target.checked)}
                        />
                        Primary Bank Account
                    </label>
                    <button type="button" className="bp-btn bp-btn-primary" onClick={addBankAccount}>
                        + Add Account
                    </button>
                </div>

                <div className="bp-table-wrap">
                <table className="bp-table">
                    <thead>
                        <tr>
                            <th>Bank Name</th>
                            <th>Account Holder Name</th>
                            <th>Account Number</th>
                            <th>Currency</th>
                            <th className="bp-col-action">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bankAccounts.length === 0 ? (
                            <tr>
                                <td className="bp-empty-row" colSpan={5}>
                                    No bank accounts added yet.
                                </td>
                            </tr>
                        ) : (
                            bankAccounts.map((b) => (
                                <tr key={b.id}>
                                    <td>
                                        {b.bankName}
                                        {b.isPrimary && <span className="bp-tag">Primary</span>}
                                    </td>
                                    <td>{b.accountHolderName}</td>
                                    <td><span className="sila-ref">{maskAccountNumber(b.accountNumber)}</span></td>
                                    <td>{b.currency}</td>
                                    <td className="bp-col-action">
                                        <button
                                            type="button"
                                            className="bp-icon-btn"
                                            aria-label={`Remove ${b.bankName} account`}
                                            onClick={() => removeBankAccount(b.id)}
                                        >
                                            <FaTrashAlt aria-hidden="true" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                </div>

                <div className="bp-actions bp-actions-right bp-actions-footer">
                    <button type="button" className="bp-btn bp-btn-secondary" onClick={handleBack}>
                        Back
                    </button>
                    <button type="button" className="bp-btn bp-btn-primary" onClick={handleNext}>
                        Next
                    </button>
                </div>
            </div>
        );
    }

    // ============================================================================
    // Step 5: Dispatch Locations (was step 4)
    // ============================================================================
    function renderStep5() {
        return (
            <div className="bp-panel">
                <h2 className="bp-panel-title">Step 5: Dispatch Locations</h2>
                <div className="bp-divider" />

                <form onSubmit={handleSubmitProfile}>
                    <div className="bp-form-grid">
                        <div className="bp-field">
                            <label htmlFor="locName">
                                Location Name<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="locName"
                                type="text"
                                value={locationDraft.locationName}
                                onChange={(e) => updateLocationDraft("locationName", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="contactPerson">Contact Person</label>
                            <input
                                id="contactPerson"
                                type="text"
                                value={locationDraft.contactPerson}
                                onChange={(e) => updateLocationDraft("contactPerson", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="country">
                                Country<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="country"
                                value={locationDraft.country}
                                onChange={(e) => {
                                    updateLocationDraft("country", e.target.value);
                                    updateLocationDraft("state", "");
                                    updateLocationDraft("city", "");
                                }}
                            >
                                <option value="">Select Country</option>
                                {Country.getAllCountries().map((c) => (
                                    <option key={c.isoCode} value={c.isoCode}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bp-field">
                            <label htmlFor="state">
                                State<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="state"
                                value={locationDraft.state}
                                onChange={(e) => {
                                    updateLocationDraft("state", e.target.value);
                                    updateLocationDraft("city", "");
                                }}
                                disabled={!locationDraft.country}
                            >
                                <option value="">Select State</option>
                                {locationDraft.country && State.getStatesOfCountry(locationDraft.country).map((s) => (
                                    <option key={s.isoCode} value={s.isoCode}>
                                        {s.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bp-field">
                            <label htmlFor="addr1">
                                Address Line 1<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="addr1"
                                type="text"
                                value={locationDraft.addressLine1}
                                onChange={(e) => updateLocationDraft("addressLine1", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="addr2">Address Line 2</label>
                            <input
                                id="addr2"
                                type="text"
                                value={locationDraft.addressLine2}
                                onChange={(e) => updateLocationDraft("addressLine2", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="city">
                                City<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <select
                                id="city"
                                value={locationDraft.city}
                                onChange={(e) => updateLocationDraft("city", e.target.value)}
                                disabled={!locationDraft.state}
                            >
                                <option value="">Select City</option>
                                {locationDraft.state && City.getCitiesOfState(locationDraft.country, locationDraft.state).map((c) => (
                                    <option key={c.name} value={c.name}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="bp-field">
                            <label htmlFor="pinZip">
                                PIN / ZIP Code<span className="bp-required sila-required" aria-hidden="true">*</span>
                            </label>
                            <input
                                id="pinZip"
                                type="text"
                                value={locationDraft.pinZip}
                                onChange={(e) => updateLocationDraft("pinZip", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="contactEmail">Contact Email ID</label>
                            <input
                                id="contactEmail"
                                type="email"
                                value={locationDraft.contactEmail}
                                onChange={(e) => updateLocationDraft("contactEmail", e.target.value)}
                            />
                        </div>

                        <div className="bp-field">
                            <label htmlFor="contactPhone">Contact Phone Number</label>
                            <input
                                id="contactPhone"
                                type="tel"
                                value={locationDraft.contactPhone}
                                onChange={(e) => updateLocationDraft("contactPhone", e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bp-actions bp-actions-between">
                        <label className="bp-checkbox-label">
                            <input
                                type="checkbox"
                                checked={locationDraft.isDefault}
                                onChange={(e) => updateLocationDraft("isDefault", e.target.checked)}
                            />
                            Default Dispatch Location
                        </label>
                        <button
                            type="button"
                            className="bp-btn bp-btn-primary"
                            onClick={addLocation}
                        >
                            + Add Location
                        </button>
                    </div>

                    <div className="bp-table-wrap">
                    <table className="bp-table">
                        <thead>
                            <tr>
                                <th>Location Name</th>
                                <th>City</th>
                                <th>Contact Person</th>
                                <th>State</th>
                                <th>Phone Number</th>
                                <th className="bp-col-action">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {dispatchLocations.length === 0 ? (
                                <tr>
                                    <td className="bp-empty-row" colSpan={6}>
                                        No dispatch locations added yet.
                                    </td>
                                </tr>
                            ) : (
                                dispatchLocations.map((l) => (
                                    <tr
                                        key={l.id}
                                        className={l.isDefault ? 'bp-table-row-default' : ''}
                                    >
                                        <td>
                                            {l.locationName}
                                            {l.isDefault && (
                                                <span
                                                    className="bp-default-dot"
                                                    title="Default Location"
                                                    role="img"
                                                    aria-label="Default Location"
                                                />
                                            )}
                                        </td>
                                        <td>{l.city}</td>
                                        <td>{l.contactPerson}</td>
                                        <td>{State.getStateByCodeAndCountry(l.state, l.country)?.name || l.state}</td>
                                        <td>{l.contactPhone}</td>
                                        <td className="bp-col-action">
                                            <button
                                                type="button"
                                                className="bp-icon-btn"
                                                aria-label={`Remove ${l.locationName}`}
                                                onClick={() => removeLocation(l.id)}
                                            >
                                                <FaTrashAlt aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>

                    <div className="bp-agreements">
                        <label className="bp-checkbox-label">
                            <input
                                type="checkbox"
                                checked={agreements.infoAccurate}
                                onChange={(e) => updateAgreement("infoAccurate", e.target.checked)}
                            />
                            I certify that the information provided is true and accurate.
                        </label>
                        <label className="bp-checkbox-label">
                            <input
                                type="checkbox"
                                checked={agreements.agreeTerms}
                                onChange={(e) => updateAgreement("agreeTerms", e.target.checked)}
                            />
                            I agree to the <a href="#terms">Terms &amp; Conditions.</a>
                        </label>
                        <label className="bp-checkbox-label">
                            <input
                                type="checkbox"
                                checked={agreements.authorizeVerification}
                                onChange={(e) => updateAgreement("authorizeVerification", e.target.checked)}
                            />
                            I authorize CAS to verify the submitted documents.
                        </label>
                    </div>

                    {error && (
                        <div className="sila-alert sila-alert--danger bp-error" role="alert">
                            {error}
                        </div>
                    )}

                    <div className="bp-actions bp-actions-right bp-actions-footer">
                        <button type="button" className="bp-btn bp-btn-secondary" onClick={handleBack} disabled={submitting}>
                            Back
                        </button>
                        <button type="submit" className="bp-btn bp-btn-primary" disabled={!canSubmit || submitting}>
                            {submitting ? 'Submitting...' : 'Submit Profile'}
                        </button>
                    </div>
                </form>
            </div>
        );
    }

    function renderCurrentStep() {
        switch (currentStep) {
            case 1:
                return renderStep1();
            case 2:
                return renderStep2();
            case 3:
                return renderStep3();
            case 4:
                return renderStep4();
            case 5:
                return renderStep5();
            default:
                return null;
        }
    }

    if (submitted) {
        return (
            <div className="bp-page">
                <header className="bp-header">
                    <div className="bp-logo">
                        V<span className="bp-logo-accent">◎</span>SX
                        <div className="bp-logo-tagline">Vendor Sourcing &amp; Onboarding Suite</div>
                    </div>
                </header>
                <main className="bp-main bp-main-centered">
                    <div className="bp-success-card">
                        <div className="bp-success-icon" aria-hidden="true">
                            <FaCheck />
                        </div>
                        <h2>Profile submitted</h2>
                        <p>Your buyer profile has been submitted for verification. We'll notify you once it's reviewed.</p>
                        <button
                            type="button"
                            className="bp-btn bp-btn-primary"
                            onClick={() => navigate('/dashboard')}
                        >
                            Go to Dashboard
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="bp-page">
            <header className="bp-header">
                <div className="bp-logo">
                    V<span className="bp-logo-accent">◎</span>SX
                    <div className="bp-logo-tagline">Vendor Sourcing &amp; Onboarding Suite</div>
                </div>
            </header>
            <main className="bp-main">
                <aside className="bp-sidebar-wrap">{renderStepIndicator()}</aside>
                <section className="bp-content">{renderCurrentStep()}</section>
            </main>
        </div>
    );
}