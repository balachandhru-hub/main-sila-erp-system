import React, { useState, useEffect, useMemo } from "react";
import "./BuyerAdminDash.css";
import Header from "./Header";
import UserAdmin from "../UserAdmin";
import Invitations from "../../../remote-supplier/src/components/Invitations";
import Product from "../../../remote-buyer/src/components/Product";
import CompanyProfile from "./CompanyProfile/CompanyProfile";
import { useNetworkAdminAuthStore } from "../store/useAuthStore";
import {
  getBuyerProfile,
  fetchBuyerRFQs,
  fetchBuyerRFQById,
  fetchBuyerVerificationTemplates,
  fetchBuyerVerificationTemplateById,
  updateRfqStatus,
  type VerificationTemplate,
  fetchBuyerDashboardAnalytics,
  getAllDepartments,
  getAllCostCenters,
  getAllItemMasters,
  createRFQ,
  getVerifiedSuppliers,
  getUnspscSegments,
  getUnspscFamilies,
  createBuyerChatApi,
} from "../../../remote-buyer/src/api/Buyerapi";
import { getCountries, getUnits, getCurrencies, fetchReferenceList } from "../../../remote-buyer/src/api/masterdataApi";
import { createItemMaster, getMasterApprovalFlows, checkItemMasterSimilarity, uploadItemMasterFile } from "../api/itemmasterapi";
import { getOrganizationUsersForRfq } from "../api/networkAdminApi";
import { logoutPlatformUser } from "../api/platformApi";
import { BuyerAnalytics, ChatPanel, CreateRFQ, toastService, useAsyncData, useRouteNav, type ChatCounterpartyRef, type CreateRFQApi, type RouteNavPaths } from "@vosox/shared-ui";
import UserTemplate from "./UserTemplate";
import ContractTemplate from "./ContractTemplate";
import ApprovalManagement from "./ApprovalManagement/ApprovalManagement";
import { ToastContainer } from "@vosox/shared-ui";
import AdminQsAns from "../../../remote-buyer/src/components/Qsans";
// import QuotationSummaryTable from "../../../remote-buyer/src/components/QuotationSummaryTable";
import QuotationComparisonCard from "./QuotationComparisonCard";
import ItemMasterCatalog from "../../../remote-buyer/src/components/ItemMasterCatalog";
import IntegrationHub from "../../../remote-buyer/src/components/integration/IntegrationHub";
import RecentPurchaseOrderList from "../../../remote-buyer/src/components/dashboard/RecentPurchaseOrderList";
import Models from "../../../remote-buyer/src/components/Models";
import WishlistSection from "../../../remote-buyer/src/components/wishlist/WishlistSection";
import WeeklyBucketSection from "../../../remote-buyer/src/components/weeklyBucket/WeeklyBucketSection";
import CartSection from "../../../remote-buyer/src/components/cart/CartSection";
import OutletManagement from "../../../remote-buyer/src/components/outlet/OutletManagement";
import SilaMeWorkspace from "../../../remote-buyer/src/components/silaMe/SilaMeWorkspace";
import { SILA_ME_MODEL_KEY, SILA_ME_NAV_PATHS, buildSilaMeNavItem, isSilaMeNav } from "../../../remote-buyer/src/components/silaMe/silaMeNav";
import { useSilaMeAddon } from "../../../remote-buyer/src/components/silaMe/useSilaMeAddon";
import { PURCHASING_NAV_PATHS, buildBuyerNavItems } from "../../../remote-buyer/src/components/dashboard/navConfig";
import NeedsAttentionPanel from "../../../remote-buyer/src/components/dashboard/attention/NeedsAttentionPanel";
import PurchasingDashboard from "../../../remote-buyer/src/components/purchasing/PurchasingDashboard";
import PurchaseOrderList from "../../../remote-buyer/src/components/purchasing/PurchaseOrderList";
import DocumentsSection from "../../../remote-buyer/src/components/documents/DocumentsSection";
import type { PendingMaterialApproval } from "./Material/materialApi";
import MaterialTable from "./Material/MaterialTable";
import MaterialApprovalDetail from "./Material/MaterialApprovalDetail";
import type { ContractRecord } from "./Contract/contractApi";
import { fetchContracts } from "./Contract/contractApi";
import ContractTable from "./Contract/ContractTable";
import ContractDetail from "./Contract/ContractDetail";
import BidComparisonAwardView from "./BidComparisonAwardView";

interface MatchCard {
  location: string;
  initials: string;
  name: string;
  seeking: string;
  description: string;
  representative: string;
  actionLabel: string;
  actionVariant: "message" | "interest";
  website: string;
  repTitle: string;
  repEmail: string;
  revenue: string;
  employees: string;
  categoryNote: string;
  destinationNote: string;
}

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </svg>
);

const NavIconBuilding = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </svg>
);

const IconCalendar = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

const IconPin = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// const IconDownload = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
//     <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
//     <polyline points="7 10 12 15 17 10" />
//     <line x1="12" y1="15" x2="12" y2="3" />
//   </svg>
// );

const IconMessageSquare = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const IconSend = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m22 2-7 20-4-9-9-4Z" />
    <path d="M22 2 11 13" />
  </svg>
);

// const IconBidCompare = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
//     <line x1="12" y1="20" x2="12" y2="10" />
//     <line x1="18" y1="20" x2="18" y2="4" />
//     <line x1="6" y1="20" x2="6" y2="16" />
//   </svg>
// );

// const IconFreezeLock = () => (
//   <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
//     <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
//     <path d="M7 11V7a5 5 0 0 1 10 0v4" />
//   </svg>
// );

const IconSparkles = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
    <path d="M5 3v4M3 5h4M19 3v4M17 5h4M5 19v4M3 21h4M19 19v4M17 21h4" />
  </svg>
);

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const IconGlobe = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10Z" />
  </svg>
);

const IconShieldCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2 4 5v6c0 5 3.5 8.5 8 11 4.5-2.5 8-6 8-11V5Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);

const IconCheckCircle = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

/** Each section's URL (/dashboard, /rfqs …); see useRouteNav. */
const BUYER_ADMIN_NAV_PATHS: RouteNavPaths = {
  dashboard: "dashboard",
  invitations: "invitations",
  activeRFQs: "rfqs",
  allRfqs: "rfqs",
  createRFQ: "create-rfq",
  product: "product-catalog",
  userList: "users",
  template: "templates",
  contractTemplate: "contract-templates",
  approvalManagement: "approval-management",
  material: "material-approvals",
  contract: "contract-approvals",
  materialService: "material-service",
  companyProfile: "company-profile",
  wishlist: "wishlist",
  weeklyBucket: "weekly-bucket",
  weeklyBucketApprovals: "weekly-bucket-approvals",
  apiConfiguration: "integration",
  workflowConfiguration: "workflow-configuration",
  models: "models",
  cart: "cart",
  outlets: "outlets",
  ...PURCHASING_NAV_PATHS,
  ...SILA_ME_NAV_PATHS,
};

const matchCards: MatchCard[] = [
  {
    location: "Vietnam",
    initials: "PT",
    name: "Precision Tech Manufacturing",
    seeking: "IT Hardware & Accessories",
    description: "Precision Tech is an ISO-certified electronics manufacturer with capacity to fulfill large recurring orders of workstations, peripherals, and monitor systems on short lead times.",
    representative: "Minh Nguyen",
    actionLabel: "Message",
    actionVariant: "message",
    website: "www.precisiontech.vn",
    repTitle: "Head of Sales",
    repEmail: "minh.nguyen@precisiontech.vn",
    revenue: "$18.3M USD",
    employees: "210 Employees",
    categoryNote: "Matches your active sourcing categories",
    destinationNote: "Matches your preferred delivery regions",
  },
  {
    location: "European Union",
    initials: "NF",
    name: "Nordvik Furnishings",
    seeking: "Office Furniture",
    description: "Nordvik designs and manufactures durable, design-forward office furniture and has fulfilled multi-site rollouts for hospitality and corporate clients across Europe.",
    representative: "Freya Larsen",
    actionLabel: "Send Interest",
    actionVariant: "interest",
    website: "www.nordvikfurnishings.eu",
    repTitle: "Key Accounts Manager",
    repEmail: "freya.larsen@nordvikfurnishings.eu",
    revenue: "$27.4M USD",
    employees: "410 Employees",
    categoryNote: "Matches your active sourcing categories",
    destinationNote: "Matches your preferred delivery regions",
  },
  {
    location: "North America",
    initials: "EW",
    name: "Everline Stationery Works",
    seeking: "Stationery",
    description: "Everline supplies FSC certified eco-friendly writing materials, premium notebooks, and recycled paper goods to corporate and administrative buyers.",
    representative: "Daniel Foster",
    actionLabel: "Send Interest",
    actionVariant: "interest",
    website: "www.everlinestationery.com",
    repTitle: "Sourcing Partner Lead",
    repEmail: "daniel.foster@everlinestationery.com",
    revenue: "$6.1M USD",
    employees: "78 Employees",
    categoryNote: "Matches your active sourcing categories",
    destinationNote: "Matches your preferred delivery regions",
  },
  {
    location: "United Kingdom",
    initials: "BR",
    name: "Brightside Roasters & Supply",
    seeking: "Breakroom Supplies",
    description: "Brightside supplies premium organic coffee, snacks, and breakroom essentials in bulk, with distribution coverage across all major UK metro areas.",
    representative: "Olivia Bennett",
    actionLabel: "Send Interest",
    actionVariant: "interest",
    website: "www.brightsideroasters.co.uk",
    repTitle: "Partnerships Director",
    repEmail: "olivia.bennett@brightsideroasters.co.uk",
    revenue: "$9.8M USD",
    employees: "112 Employees",
    categoryNote: "Matches your active sourcing categories",
    destinationNote: "Matches your preferred delivery regions",
  },
];


const BuyerAdminDash: React.FC = () => {
  const [activeNav, setActiveNav] = useRouteNav(BUYER_ADMIN_NAV_PATHS, "dashboard");

  // The SILA ME (hospitality) add-on menu, for organizations that have the add-on.
  const hasSilaMe = useSilaMeAddon();
  // The administrator's menu: every buyer-side screen, grouped as Sourcing, Purchasing, Approvals and Settings.
  const headerNavItems = useMemo(
    () => buildBuyerNavItems({
      isAdmin: true,
      rfqListKey: "activeRFQs",
      silaMeItem: hasSilaMe ? buildSilaMeNavItem("admin") : null,
    }),
    [hasSilaMe],
  );

  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<MatchCard | null>(null);

  const [loadingRfqs, setLoadingRfqs] = useState(false);
  const [rfqsError, setRfqsError] = useState<string | null>(null);
  const [rfqs, setRfqs] = useState<any[]>([]);
  const analytics = useAsyncData(fetchBuyerDashboardAnalytics);
  const [visibleRfqCount, setVisibleRfqCount] = useState(3);
  const RFQ_INITIAL_VISIBLE = 3;

  const [templates, setTemplates] = useState<VerificationTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const [buyerId, setBuyerId] = useState<string | null>(currentUser?.buyerId || null);
  const buyerProfile = useNetworkAdminAuthStore((state) => state.personDetail);
  const isLoadingBuyerProfile = useNetworkAdminAuthStore((state) => state.personDetailLoading);

  useEffect(() => {
    if (currentUser?.buyerId) {
      setBuyerId(currentUser.buyerId);
    }
  }, [currentUser?.buyerId]);


  // STATE FOR QUOTATION COMPARISON
  const [selectedQuotationsRfq, setSelectedQuotationsRfq] = useState<any | null>(null);

  useEffect(() => {
    const loadBuyerProfile = async () => {
      if (!buyerId) {
        try {
          const profile = await getBuyerProfile();
          if (profile?.id) {
            setBuyerId(profile.id);
          } else {
            setRfqsError("Buyer profile not found. Please complete onboarding.");
          }
        } catch (err: any) {
          setRfqsError("Failed to load buyer profile details.");
        }
      }
    };
    loadBuyerProfile();
  }, [buyerId]);

  const loadRfqs = async () => {
    if (!buyerId) {
      setRfqs([]);
      setVisibleRfqCount(0);
      return;
    }

    setLoadingRfqs(true);
    setRfqsError(null);

    try {
      const data = await fetchBuyerRFQs({
        buyerId,
        index: 0,
        limit: RFQ_INITIAL_VISIBLE,
      });

      const finalData = data.length > 0 ? data : [];

      setRfqs(finalData);
      setVisibleRfqCount(
        Math.min(RFQ_INITIAL_VISIBLE, finalData.length)
      );
    } catch (err: any) {

      setRfqsError(
        err?.message || "Failed to load sourcing opportunities."
      );

      setRfqs([]);
      setVisibleRfqCount(0);
    } finally {
      setLoadingRfqs(false);
    }
  };

  useEffect(() => {
    loadRfqs();
  }, [buyerId]);

  const refreshRfqs = async () => {
    await loadRfqs();
    await loadAllRfqsPage(1);
  }

  useEffect(() => {
    const loadTemplates = async () => {
      setLoadingTemplates(true);
      setTemplatesError(null);
      try {
        const data = await fetchBuyerVerificationTemplates();

        if ('statusCode' in data) {
          setTemplatesError(data.message || 'Failed to load templates');
          setTemplates([]);
        } else {
          setTemplates(Array.isArray(data) ? data : []);
        }
      } catch (err: any) {
        setTemplatesError(err.message || "Failed to load verification templates.");
        setTemplates([]);
      } finally {
        setLoadingTemplates(false);
      }
    };

    if (activeNav === "template") {
      loadTemplates();
    }
  }, [activeNav]);

  const currentUserId = currentUser?.userId || currentUser?.id || null;

  const [selectedMaterial, setSelectedMaterial] = useState<PendingMaterialApproval | null>(null);

  useEffect(() => {
    if (activeNav !== "material") return;
    setSelectedMaterial(null);
  }, [activeNav]);

  // MaterialTable reloads its own data when it remounts after the detail view closes.
  const handleMaterialApprovalSubmitted = () => setSelectedMaterial(null);

  const CONTRACT_PAGE_SIZE = 10;
  const [contractRecords, setContractRecords] = useState<ContractRecord[]>([]);
  const [loadingContract, setLoadingContract] = useState(false);
  const [contractError, setContractError] = useState<string | null>(null);
  const [contractPage, setContractPage] = useState(1);
  const [selectedContract, setSelectedContract] = useState<ContractRecord | null>(null);

  useEffect(() => {
    if (activeNav !== "contract") return;
    setSelectedContract(null);
    setContractPage(1);
  }, [activeNav]);

  useEffect(() => {
    if (activeNav !== "contract") return;
    setLoadingContract(true);
    setContractError(null);
    fetchContracts((contractPage - 1) * CONTRACT_PAGE_SIZE, CONTRACT_PAGE_SIZE)
      .then(setContractRecords)
      .catch((err: any) => {
        setContractError(err.message || "Failed to load contracts.");
        setContractRecords([]);
      })
      .finally(() => setLoadingContract(false));
  }, [activeNav, contractPage]);

  const [rfqPageView, setRfqPageView] = useState<"dashboard" | "allRfqs" | "rfqDetail" | "qsAns" | "quotationComparison">("dashboard");
  const [previousRfqPageView, setPreviousRfqPageView] = useState<"dashboard" | "allRfqs">("dashboard");

  const [allRfqsList, setAllRfqsList] = useState<any[]>([]);
  const [loadingAllRfqs, setLoadingAllRfqs] = useState(false);
  const [allRfqsError, setAllRfqsError] = useState<string | null>(null);
  const [allRfqsLoaded, setAllRfqsLoaded] = useState(false);
  const [allRfqsPage, setAllRfqsPage] = useState(1);
  const [allRfqsHasMore, setAllRfqsHasMore] = useState(true);
  const RFQ_PAGE_SIZE = 10;

  const [fullPageRfq, setFullPageRfq] = useState<any | null>(null);
  const [fullPageRfqId, setFullPageRfqId] = useState<string | null>(null);
  const [loadingFullPageRfq, setLoadingFullPageRfq] = useState(false);
  const [fullPageRfqError, setFullPageRfqError] = useState<string | null>(null);
  const [freezingBid, setFreezingBid] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  useEffect(() => {
    const handlePopState = () => {
      if (rfqPageView === "rfqDetail" || rfqPageView === "qsAns" || rfqPageView === "quotationComparison") {
        setRfqPageView(previousRfqPageView || "allRfqs");
        if ((previousRfqPageView || "allRfqs") === "dashboard") {
          setActiveNav("dashboard");
        }
        setFullPageRfq(null);
        setFullPageRfqId(null);
        setFullPageRfqError(null);
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [rfqPageView, previousRfqPageView]);
  // Known supplier org names from quotation data, used to give the chat a
  // real supplier name instead of an individual invited user's name.
  const chatSupplierNames = useMemo(() => {
    const map: Record<string, string> = {};
    const quotations = Array.isArray(fullPageRfq?.supplierQuotation) ? fullPageRfq.supplierQuotation : [];
    for (const quote of quotations) {
      if (quote?.supplierId && quote?.supplierName) {
        map[quote.supplierId] = quote.supplierName;
      }
    }
    return map;
  }, [fullPageRfq]);

  // The ONLY source of which suppliers appear in the RFQ chat and their display names.
  const chatCounterparties = useMemo<ChatCounterpartyRef[]>(() => {
    const internal: ChatCounterpartyRef[] = (fullPageRfq?.supplierIds || [])
      .filter((s: any) => !!s?.supplierId)
      .map((s: any) => ({
        id: s.supplierId,
        name: s.supplierName || chatSupplierNames[s.supplierId] || "Supplier",
        isExternal: false,
      }));
    const external: ChatCounterpartyRef[] = (fullPageRfq?.externalSupplierIds || [])
      .filter((s: any) => !!s?.externalSupplierId)
      .map((s: any) => ({
        id: s.externalSupplierId,
        name: s.externalSupplierName || "External Supplier",
        isExternal: true,
      }));
    return [...internal, ...external];
  }, [fullPageRfq, chatSupplierNames]);

  const handleOpenAllRfqs = async () => {
    setActiveNav("activeRFQs");
    setRfqPageView("allRfqs");
    if (allRfqsLoaded || loadingAllRfqs) return;

    // load page 1 when opening
    await loadAllRfqsPage(1);
  };

  const getRfqPageRange = (page: number) => {
    const index = (page - 1) * RFQ_PAGE_SIZE;
    const limit = RFQ_PAGE_SIZE;
    return { index, limit };
  };

  const loadAllRfqsPage = async (page: number) => {
    if (!buyerId) {
      setAllRfqsList(rfqs.length > 0 ? rfqs : []);
      setAllRfqsHasMore(false);
      setAllRfqsLoaded(true);
      return;
    }

    setLoadingAllRfqs(true);
    setAllRfqsError(null);

    try {
      const { index, limit } = getRfqPageRange(page);

      const data = await fetchBuyerRFQs({ buyerId, index, limit });

      setAllRfqsList(data.length > 0 ? data : []);
      setAllRfqsPage(page);
      setAllRfqsHasMore(data.length === RFQ_PAGE_SIZE);
    } catch (err: any) {
      setAllRfqsError(err.message || "Failed to load the full RFQ list.");
      setAllRfqsList(rfqs.length > 0 ? rfqs : []);
      setAllRfqsHasMore(false);
    } finally {
      setLoadingAllRfqs(false);
      setAllRfqsLoaded(true);
    }
  };

  const handleAllRfqsNextPage = () => {
    if (loadingAllRfqs || !allRfqsHasMore) return;
    loadAllRfqsPage(allRfqsPage + 1);
  };

  const handleAllRfqsPrevPage = () => {
    if (loadingAllRfqs || allRfqsPage <= 1) return;
    loadAllRfqsPage(allRfqsPage - 1);
  };

  // The RFQ list has its own URL (/rfqs). When the URL changes by itself (Back/Forward,
  // reload, a shared link), bring the RFQ view in line with it.
  useEffect(() => {
    if (activeNav === "activeRFQs" && rfqPageView === "dashboard") {
      handleOpenAllRfqs();
    } else if (activeNav !== "activeRFQs" && rfqPageView === "allRfqs") {
      setRfqPageView("dashboard");
    }
  }, [activeNav]);

  const handleNavClick = (key: string) => {
    if (key === "activeRFQs") {
      handleOpenAllRfqs();
      return;
    }
    setActiveNav(key);
    setRfqPageView("dashboard");
  };



  // const handleBackToDashboard = () => {
  //   setRfqPageView("dashboard");
  //   setActiveNav("dashboard");
  // };

  const handleViewRfqDetailsFullPage = async (rfqId: string) => {
    if (rfqPageView === "dashboard" || rfqPageView === "allRfqs") {
      setPreviousRfqPageView(rfqPageView);
    }
    window.history.pushState({ rfqPageView: "rfqDetail" }, "");
    setRfqPageView("rfqDetail");
    setFullPageRfqId(rfqId);
    setLoadingFullPageRfq(true);
    setFullPageRfqError(null);

    try {
      const details = await fetchBuyerRFQById(rfqId);
      setFullPageRfq({ ...details, rfqId });
    } catch (err: any) {
      setFullPageRfqError(err.message || "Failed to fetch details.");
      const found =
        allRfqsList.find((r) => r.rfqId === rfqId) ||
        rfqs.find((r) => r.rfqId === rfqId) ||
        null;
      setFullPageRfq(found);
    } finally {
      setLoadingFullPageRfq(false);
    }
  };

  const handleBackToAllRfqs = () => {
    const targetView = previousRfqPageView || "allRfqs";
    setRfqPageView(targetView);
    if (targetView === "dashboard") {
      setActiveNav("dashboard");
    }
    setFullPageRfq(null);
    setFullPageRfqId(null);
    setFullPageRfqError(null);
  };

  const handleFreezeBid = async () => {
    if (!fullPageRfqId || freezingBid || fullPageRfq?.status === "Freezing") return;
    setFreezingBid(true);
    try {
      await updateRfqStatus({ rfqId: fullPageRfqId, status: "Freezing" });
      const updated = await fetchBuyerRFQById(fullPageRfqId);
      setFullPageRfq({ ...updated, rfqId: fullPageRfqId });
      toastService.success("Bid frozen. Suppliers can no longer submit quotations for this RFQ.");
    } catch (err: any) {
      toastService.error(err?.message || "Failed to freeze the bid.");
    } finally {
      setFreezingBid(false);
    }
  };

  // HANDLER FOR QUOTATION COMPARISON - FULL PAGE VIEW
  // const handleOpenQuotationComparison = (rfq: any) => {
  //   setSelectedQuotationsRfq(rfq);
  //   setRfqPageView("quotationComparison");
  // };

  const handleBackFromQuotationComparison = () => {
    setRfqPageView("rfqDetail");
    setSelectedQuotationsRfq(null);
  };

  const handleOpenQsAns = () => {
    setRfqPageView("qsAns");
  };

  const handleBackToRfqDetail = () => {
    setRfqPageView("rfqDetail");
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutPlatformUser();
    } catch {
      // The session is cleared locally below even when the server call fails.
    } finally {
      useNetworkAdminAuthStore.getState().logout();
      sessionStorage.clear();
      window.dispatchEvent(new CustomEvent("session:expired"));
      setLoggingOut(false);
    }
  };

  // const handleDocumentAction = async (doc: any, action: 'preview' | 'download') => {
  //   const assetId = doc.id || doc.assetId;
  //   if (!assetId) {
  //     alert("Document asset ID is missing.");
  //     return;
  //   }

  //   try {
  //     const data = await fetchBuyerAsset(assetId);
  //     if ('statusCode' in data && data.statusCode) {
  //       throw new Error(data.message || 'Failed to fetch document.');
  //     }

  //     const fileBytes = (data as any).fileBytes;
  //     const fileName = (data as any).fileName || doc.fileName || doc.assetName || "document";
  //     const rawType = ((data as any).contentType || (data as any).fileType || doc.fileType || "pdf").toLowerCase();

  //     let mimeType = "application/pdf";
  //     if (rawType.includes("pdf")) mimeType = "application/pdf";
  //     else if (rawType.includes("png")) mimeType = "image/png";
  //     else if (rawType.includes("jpg") || rawType.includes("jpeg")) mimeType = "image/jpeg";
  //     else if (rawType.includes("txt")) mimeType = "text/plain";
  //     else if (rawType.includes("doc")) mimeType = "application/msword";

  //     let url = (data as any).url || (data as any).fileUrl;
  //     let createdBlobUrl = "";

  //     if (fileBytes) {
  //       const cleanBase64 = fileBytes.replace(/^data:.*?;base64,/, '');
  //       const byteCharacters = atob(cleanBase64);
  //       const byteNumbers = new Array(byteCharacters.length);
  //       for (let i = 0; i < byteCharacters.length; i++) {
  //         byteNumbers[i] = byteCharacters.charCodeAt(i);
  //       }
  //       const byteArray = new Uint8Array(byteNumbers);
  //       const blob = new Blob([byteArray], { type: mimeType });
  //       createdBlobUrl = URL.createObjectURL(blob);
  //       url = createdBlobUrl;
  //     }

  //     if (!url) {
  //       throw new Error("Document content not available.");
  //     }

  //     if (action === 'preview') {
  //       window.open(url, '_blank');
  //     } else {
  //       const a = document.createElement('a');
  //       a.href = url;
  //       a.download = fileName;
  //       document.body.appendChild(a);
  //       a.click();
  //       document.body.removeChild(a);
  //     }
  //   } catch (err: any) {
  //     alert(err?.message || "Could not access document.");
  //   }
  // };

  // const renderQuoteStatusBadges = (quote: any) => (
  //   <>
  //     {quote.isLead && (
  //       <span
  //         className="bad-status-badge"
  //         style={{
  //           background: '#fef3c7',
  //           color: '#b45309',
  //           border: '1px solid #fde68a',
  //           padding: '3px 8px',
  //           borderRadius: '6px',
  //           fontSize: '11px',
  //           fontWeight: 600
  //         }}
  //       >
  //         Leading
  //       </span>
  //     )}
  //     <span
  //       className="bad-status-badge"
  //       style={{
  //         background: quote.status === 'SUBMITTED' ? '#dcfce7' : '#f1f5f9',
  //         color: quote.status === 'SUBMITTED' ? '#15803d' : '#475569',
  //         padding: '3px 8px',
  //         borderRadius: '6px',
  //         fontSize: '11px',
  //         fontWeight: 600
  //       }}
  //     >
  //       {quote.status || "RECEIVED"}
  //     </span>
  //   </>
  // );

  const createRfqApi: CreateRFQApi = {
    getBuyerProfile,
    getAllDepartments,
    getAllCostCenters,
    getAllItemMasters,
    createRFQ,
    getVerifiedSuppliers,
    getUnspscSegments,
    getUnspscFamilies,
    fetchBuyerVerificationTemplates,
    fetchBuyerVerificationTemplateById,
    getCountries,
    getUnits,
    getCurrencies,
    fetchReferenceList,
    itemMaster: { createItemMaster, getMasterApprovalFlows, checkItemMasterSimilarity },
    itemMasterUpload: { uploadItemMasterFile, getMasterApprovalFlows },
    supplierUsers: { getOrganizationUsersForRfq },
  };

  return (
    <Header navItems={headerNavItems} activeNav={activeNav} onNavClick={handleNavClick} onLogout={handleLogout}>
        <ToastContainer />
        <div className="bad-main">
          <div className="bad-content">
            {hasSilaMe && isSilaMeNav(activeNav) ? (
              <SilaMeWorkspace navKey={activeNav} role="admin" onNavigate={handleNavClick} />
            ) : activeNav === "purchasing" ? (
              <PurchasingDashboard
                currentUserId={currentUserId}
                hasSilaMe={hasSilaMe}
                bucketRole="reviewer"
                classPrefix="bad"
                onNavigate={handleNavClick}
              />
            ) : activeNav === "purchaseOrders" ? (
              <PurchaseOrderList />
            ) : activeNav === "documents" ? (
              <DocumentsSection hasSilaMe={hasSilaMe} onNavigate={handleNavClick} />
            ) : activeNav === "userList" ? (
              <UserAdmin />
            ) : activeNav === "invitations" ? (
              <Invitations isAdmin adminRole="buyer" />
            ) : activeNav === "companyProfile" ? (
              <CompanyProfile mode="network-admin" showHeader={false} />
            ) : activeNav === "template" ? (
              <div>
                {loadingTemplates ? (
                  <div className="bad-state-box bad-state-box-lg">
                    <div className="bad-state-inner">
                      <div className="bad-spinner" aria-hidden="true" />
                      <span>Loading verification templates...</span>
                    </div>
                  </div>
                ) : templatesError ? (
                  <div className="bad-state-message bad-state-error" role="alert">
                    <h3 className="bad-state-title">Error Loading Templates</h3>
                    <p>{templatesError}</p>
                  </div>
                ) : (
                  <UserTemplate templates={templates} />
                )}
              </div>
            ) : activeNav === "contractTemplate" ? (
              <ContractTemplate />
            ) : activeNav === "approvalManagement" ? (
              <ApprovalManagement />
            ) : activeNav === "models" ? (
              <Models onOpenModel={(model) => {
                if (!hasSilaMe || model.key !== SILA_ME_MODEL_KEY) return false;
                handleNavClick("silaDashboard");
                return true;
              }} />
            ) : activeNav === "workflowConfiguration" ? (
              <IntegrationHub variant="workflow" />
            ) : activeNav === "cart" ? (
              <CartSection onOpenWeeklyBucket={() => handleNavClick("weeklyBucket")} onBrowseCatalog={() => handleNavClick("product")} />
            ) : activeNav === "outlets" ? (
              <OutletManagement buyerId={buyerId || ""} />
            ) : activeNav === "apiConfiguration" ? (
              <IntegrationHub variant="integration" />
            ) : activeNav === "wishlist" ? (
              <WishlistSection onOpenCart={() => handleNavClick("cart")} />
            ) : activeNav === "weeklyBucket" ? (
              <WeeklyBucketSection
                buyerId={buyerId || ""}
                currentUserId={currentUserId}
                canReview
                canMapMaterial
                onOpenCart={() => handleNavClick("cart")}
              />
            ) : activeNav === "weeklyBucketApprovals" ? (
              <WeeklyBucketSection buyerId={buyerId || ""} currentUserId={currentUserId} canReview mode="approve" />
            ) : activeNav === "material" ? (
              selectedMaterial ? (
                <MaterialApprovalDetail
                  material={selectedMaterial}
                  currentUserId={currentUserId}
                  onBack={() => setSelectedMaterial(null)}
                  onApprovalSubmitted={handleMaterialApprovalSubmitted}
                />
              ) : (
                <MaterialTable onRowClick={setSelectedMaterial} />
              )
            ) : activeNav === "contract" ? (
              selectedContract ? (
                <ContractDetail
                  contract={selectedContract}
                  currentUserId={currentUserId}
                  onBack={() => setSelectedContract(null)}
                />
              ) : (
                <ContractTable
                  records={contractRecords}
                  loading={loadingContract}
                  error={contractError}
                  onRowClick={setSelectedContract}
                  page={contractPage}
                  onPreviousPage={() => setContractPage((p) => Math.max(1, p - 1))}
                  onNextPage={() => setContractPage((p) => p + 1)}
                  hasNextPage={contractRecords.length === CONTRACT_PAGE_SIZE}
                />
              )
            ) : activeNav === "materialService" ? (
              <ItemMasterCatalog buyerId={buyerId || ""} organizationId={buyerProfile?.organizationId || ""} />
            ) : activeNav === "createRFQ" ? (
              <CreateRFQ onNavClick={handleNavClick} onRfqCreated={refreshRfqs} api={createRfqApi} />
            ) : activeNav === "product" ? (
              <Product canAddToCart onOpenCart={() => handleNavClick("cart")} />
            ) : rfqPageView === "allRfqs" ? (
              <>
                <div className="bad-table">
                  <div className="bad-table-header">
                    <div>
                      <h1 className="bad-title">All RFQs</h1>
                      <p className="bad-subtitle">
                        RFQs posted across your organization, awaiting supplier quotations.
                      </p>
                    </div>
                  </div>

                  {loadingAllRfqs ? (
                    <div className="bad-state-box">
                      <div className="bad-state-inner">
                        <div className="bad-spinner" aria-hidden="true" />
                        <span>Loading all sourcing opportunities...</span>
                      </div>
                    </div>
                  ) : allRfqsError && allRfqsList.length === 0 ? (
                    <div className="bad-state-message bad-state-error" role="alert">{allRfqsError}</div>
                  ) : allRfqsList.length === 0 ? (
                    <div className="bad-state-message">
                      No RFQs found.
                    </div>
                  ) : (
                    <div>
                      <div className="bad-rfq-table-container">
                        <table className="bad-rfq-items-table bad-allrfqs-table">
                          <thead>
                            <tr>
                              <th className="bad-col-sno">S.No</th>
                              <th>RFQ Number</th>
                              <th>Title</th>
                              <th>Organization</th>
                              <th>Delivery Location</th>
                              <th>Closing Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allRfqsList.map((rfq: any, idx: number) => (
                              <tr key={rfq.rfqId || idx}
                                tabIndex={0}
                                onClick={() => handleViewRfqDetailsFullPage(rfq.rfqId)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") handleViewRfqDetailsFullPage(rfq.rfqId);
                                }}>
                                <td className="bad-cell-sno">{(allRfqsPage - 1) * RFQ_PAGE_SIZE + idx + 1}</td>
                                <td><span className="bad-code-badge sila-ref">{rfq.rfqNumber}</span></td>
                                <td className="bad-cell-strong">{rfq.title}</td>
                                <td>{rfq.organizationName}</td>
                                <td>{rfq.deliveryLocation}</td>
                                <td>
                                  {rfq.endDate
                                    ? new Date(rfq.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                    : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="badp-pagination badp-allrfqs-pagination">
                        <button
                          type="button"
                          className={`badp-page-btn${allRfqsPage === 1 || loadingAllRfqs ? " badp-page-btn-disabled" : ""}`}
                          onClick={handleAllRfqsPrevPage}
                          disabled={allRfqsPage <= 1 || loadingAllRfqs}
                          aria-label="Previous RFQ page"
                        >
                          <IconChevronLeft />
                        </button>

                        <span className="badp-page-number">Page {allRfqsPage}</span>

                        <button
                          type="button"
                          className={`badp-page-btn${!allRfqsHasMore || loadingAllRfqs ? " badp-page-btn-disabled" : ""}`}
                          onClick={handleAllRfqsNextPage}
                          disabled={!allRfqsHasMore || loadingAllRfqs}
                          aria-label="Next RFQ page"
                        >
                          <IconChevronRight />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : rfqPageView === "rfqDetail" ? (
              // <>
              //   <div className="bad-modal bad-rfq-fullpage">
              //     <div className="bad-modal-header">
              //       <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              //         <span className="bad-modal-badge">
              //           <IconFile /> RFQ Specification
              //         </span>
              //         {fullPageRfq && (
              //           <button
              //             type="button"
              //             className="bad-modal-badge"
              //             style={{ border: 'none', cursor: 'pointer', background: 'rgba(255,255,255,0.18)', color: '#ffffff' }}
              //             onClick={handleOpenQsAns}
              //           >
              //             <IconFile /> RFQ Question Answers
              //           </button>
              //         )}
              //       </div>
              //       <button className="bad-modal-close" onClick={handleBackToAllRfqs}>
              //         <IconClose />
              //       </button>
              //       <h2 className="bad-modal-name">
              //         {loadingFullPageRfq ? "Loading RFQ Details..." : fullPageRfq?.title || "RFQ Details"}
              //       </h2>
              //       {fullPageRfq && (
              //         <div className="bad-modal-meta">
              //           <span><IconCalendar /> Closes: {new Date(fullPageRfq.endDate).toLocaleDateString()}</span>
              //           <span><IconPin /> Delivery: {fullPageRfq.deliveryLocation}</span>
              //           <div className="bad-rfq-header-actions">
              //             {Array.isArray(fullPageRfq.supplierIds) && fullPageRfq.supplierIds.length > 0 && (
              //               <button
              //                 type="button"
              //                 className="bad-btn bad-btn-outline bad-btn-chat"
              //                 onClick={() => setIsChatOpen(true)}
              //                 title="Chat with invited suppliers"
              //               >
              //                 <IconMessageSquare /> Chat
              //               </button>
              //             )}
              //             <button
              //               className="bad-btn bad-btn-outline"
              //               onClick={() => handleOpenQuotationComparison(fullPageRfq)}
              //               title="View Supplier Quotations"
              //             >
              //               <IconBidCompare /> Bid Comparison
              //             </button>
              //             <button
              //               type="button"
              //               className="bad-btn bad-btn-freeze"
              //               onClick={handleFreezeBid}
              //               disabled={freezingBid || fullPageRfq.status === "Freezing"}
              //               title={fullPageRfq.status === "Freezing" ? "This RFQ's bid has already been frozen" : "Freeze the bid to stop accepting new quotations"}
              //             >
              //               <IconFreezeLock />
              //               {freezingBid ? "Freezing..." : fullPageRfq.status === "Freezing" ? "Bid Frozen" : "Freeze Bid"}
              //             </button>
              //           </div>
              //         </div>
              //       )}
              //     </div>

              //     <div className="bad-modal-body">
              //       {loadingFullPageRfq ? (
              //         <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
              //           <div style={{ color: '#64748b', fontSize: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              //             <div className="bad-spinner" style={{ width: '32px', height: '32px' }} />
              //             <span>Fetching RFQ specification details...</span>
              //           </div>
              //         </div>
              //       ) : fullPageRfqError && !fullPageRfq ? (
              //         <div style={{ padding: '24px', textAlign: 'center', color: '#ef4444' }}>
              //           {fullPageRfqError}
              //         </div>
              //       ) : fullPageRfq ? (
              //         <div className="bad-active-rfq-content-wrapper">
              //             <div>
              //               <div className="bad-modal-section-title">Description</div>
              //               <p className="bad-modal-desc" style={{ whiteSpace: 'pre-wrap', fontSize: '13.5px', color: '#334155', lineHeight: '1.6' }}>
              //                 {fullPageRfq.description || "No description provided."}
              //               </p>

              //               <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', background: '#f8fafc', padding: '14px 18px', borderRadius: '10px', border: '1px solid #e2e8f0', marginTop: '12px' }}>
              //                 <div>
              //                   <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Start Date</div>
              //                   <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, marginTop: '2px' }}>
              //                     {new Date(fullPageRfq.startDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              //                   </div>
              //                 </div>
              //                 <div>
              //                   <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>End Date</div>
              //                   <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, marginTop: '2px' }}>
              //                     {new Date(fullPageRfq.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
              //                   </div>
              //                 </div>
              //                 <div>
              //                   <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>Add Lot Option</div>
              //                   <div style={{ fontSize: '13px', color: '#1e293b', fontWeight: 600, marginTop: '2px' }}>
              //                     {fullPageRfq.addLotOption ? "Allowed" : "Not Allowed"}
              //                   </div>
              //                 </div>
              //               </div>
              //             </div>

              //             {/* Items table */}
              //             <QuotationSummaryTable rfq={fullPageRfq} />

              //             {/* Attached Documents */}
              //             {((fullPageRfq.technicalSpecificationDocuments && fullPageRfq.technicalSpecificationDocuments.length > 0) ||
              //               (fullPageRfq.termsConditionDocuments && fullPageRfq.termsConditionDocuments.length > 0)) && (
              //                 <div>
              //                   <div className="bad-modal-section-title" style={{ marginBottom: '10px' }}>Specifications & Terms Documents</div>
              //                   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
              //                     {fullPageRfq.technicalSpecificationDocuments?.map((doc: any, i: number) => (
              //                       <div key={`tech-${i}`} className="bad-rfq-doc-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
              //                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              //                           <div className="bad-rfq-doc-icon"><IconFile /></div>
              //                           <div style={{ overflow: 'hidden' }}>
              //                             <div className="bad-rfq-doc-name" title={doc.fileName}>{doc.fileName}</div>
              //                             <div className="bad-rfq-doc-type">Tech Spec Doc</div>
              //                           </div>
              //                         </div>
              //                         <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              //                           <button
              //                             type="button"
              //                             title="Preview document"
              //                             onClick={() => handleDocumentAction(doc, 'preview')}
              //                             style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '4px', display: 'inline-flex', borderRadius: '4px' }}
              //                           >
              //                             <IconEye />
              //                           </button>
              //                           <button
              //                             type="button"
              //                             title="Download document"
              //                             onClick={() => handleDocumentAction(doc, 'download')}
              //                             style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', display: 'inline-flex', borderRadius: '4px' }}
              //                           >
              //                             <IconDownload />
              //                           </button>
              //                         </div>
              //                       </div>
              //                     ))}
              //                     {fullPageRfq.termsConditionDocuments?.map((doc: any, i: number) => (
              //                       <div key={`terms-${i}`} className="bad-rfq-doc-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px' }}>
              //                         <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden', flex: 1 }}>
              //                           <div className="bad-rfq-doc-icon" style={{ background: '#fef3c7', color: '#d97706' }}><IconFile /></div>
              //                           <div style={{ overflow: 'hidden' }}>
              //                             <div className="bad-rfq-doc-name" title={doc.fileName}>{doc.fileName}</div>
              //                             <div className="bad-rfq-doc-type">Terms & Conditions</div>
              //                           </div>
              //                         </div>
              //                         <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '8px' }}>
              //                           <button
              //                             type="button"
              //                             title="Preview document"
              //                             onClick={() => handleDocumentAction(doc, 'preview')}
              //                             style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563eb', padding: '4px', display: 'inline-flex', borderRadius: '4px' }}
              //                           >
              //                             <IconEye />
              //                           </button>
              //                           <button
              //                             type="button"
              //                             title="Download document"
              //                             onClick={() => handleDocumentAction(doc, 'download')}
              //                             style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#475569', padding: '4px', display: 'inline-flex', borderRadius: '4px' }}
              //                           >
              //                             <IconDownload />
              //                           </button>
              //                         </div>
              //                       </div>
              //                     ))}
              //                   </div>
              //                 </div>
              //               )}

              //             {/* Supplier Quotations Received
              //             {fullPageRfq.addLotOption && (
              //             <div>
              //               <div className="bad-modal-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
              //                 <IconSparkles /> Supplier Quotations Received
              //               </div>
              //               {fullPageRfq.supplierQuotation &&
              //                 fullPageRfq.supplierQuotation.filter((q: any) => q.quotationId || q.totalPrice !== null).length > 0 ? (
              //                 <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '480px', overflowY: 'auto' }}>
              //                   {fullPageRfq.supplierQuotation
              //                     .filter((q: any) => q.quotationId || q.totalPrice !== null)
              //                     .map((quote: any, index: number) => (
              //                       <div
              //                         key={index}
              //                         style={{
              //                           background: '#ffffff',
              //                           border: '1px solid #cbd5e1',
              //                           borderRadius: '10px',
              //                           padding: '16px',
              //                           boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
              //                           transition: 'border-color 0.2s ease'
              //                         }}
              //                       >
              //                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              //                           <div style={{ display: 'flex', flexDirection: 'column' }}>
              //                             <span style={{ fontSize: '12px', fontWeight: 700, color: '#0f172a' }}>
              //                               Quote ID: {quote.quotationId ? `${quote.quotationId.substring(0, 8)}...` : `Quote #${index + 1}`}
              //                             </span>
              //                             <span style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              //                               Delivery: {quote.deliveryType || "Standard"}
              //                             </span>
              //                           </div>
              //                           <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              //                             {renderQuoteStatusBadges(quote)}
              //                           </div>
              //                         </div>

              //                         <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#f8fafc', padding: '10px', borderRadius: '8px', border: '1px solid #f1f5f9', marginBottom: '12px', fontSize: '12px' }}>
              //                           <div>
              //                             <span style={{ color: '#64748b' }}>Delivery Charge:</span>
              //                             <div style={{ fontWeight: 600, color: '#334155', marginTop: '2px' }}>${quote.deliveryCharge ?? 0}</div>
              //                           </div>
              //                           <div>
              //                             <span style={{ color: '#64748b' }}>Tax:</span>
              //                             <div style={{ fontWeight: 600, color: '#334155', marginTop: '2px' }}>${quote.tax ?? 0}</div>
              //                           </div>
              //                           <div>
              //                             <span style={{ color: '#64748b' }}>Discount:</span>
              //                             <div style={{ fontWeight: 600, color: '#dc2626', marginTop: '2px' }}>-${quote.discount ?? 0}</div>
              //                           </div>
              //                           <div>
              //                             <span style={{ color: '#64748b' }}>Total Quote:</span>
              //                             <div style={{ fontWeight: 700, color: '#16a34a', marginTop: '2px', fontSize: '13px' }}>${quote.totalPrice ?? 0}</div>
              //                           </div>
              //                         </div>
              //                       </div>
              //                     ))}
              //                 </div>
              //               ) : (
              //                 <div className="bad-rfq-no-quote-box" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px' }}>
              //                   <IconMail />
              //                   <div style={{ fontWeight: 600, color: '#475569', marginTop: '12px' }}>No Quotations Received Yet</div>
              //                   <div style={{ fontSize: '12px', color: '#64748b', marginTop: '6px', lineHeight: '1.5', maxWidth: '240px' }}>
              //                     When suppliers submit commercial bids, they will populate here in real-time.
              //                   </div>
              //                 </div>
              //               )}
              //             </div>
              //             )} */}

              //         </div>
              //       ) : null}
              //     </div>

              //     {fullPageRfq && (
              //       <div className="bad-modal-footer">
              //         <button
              //           className="bad-btn bad-btn-outline"
              //           onClick={handleBackToAllRfqs}
              //           style={{ marginRight: '10px' }}
              //         >
              //           Close
              //         </button>
              //         <button className="bad-btn bad-btn-message" style={{ background: '#2563eb', color: '#ffffff' }}>
              //           Evaluate Quotations
              //         </button>
              //       </div>
              //     )}
              //   </div>
              // </>
              <BidComparisonAwardView
                rfq={fullPageRfq}
                rfqId={fullPageRfqId || fullPageRfq?.rfqId || fullPageRfq?.id || fullPageRfq?._id}
                loading={loadingFullPageRfq}
                error={fullPageRfqError}
                freezingBid={freezingBid}
                onFreeze={handleFreezeBid}
                onBack={handleBackToAllRfqs}
                onQsAns={handleOpenQsAns}
                onChatClick={() => setIsChatOpen(true)}
                buyerProfile={buyerProfile}
                isLoadingBuyerProfile={isLoadingBuyerProfile}
              />
            ) : rfqPageView === "quotationComparison" ? (
              <>
                <div className="bad-modal bad-rfq-fullpage">
                  <div className="bad-modal-header">
                    <span className="bad-modal-badge">
                      <IconSparkles /> Bid Comparison
                    </span>
                    <button type="button" className="bad-modal-close" onClick={handleBackFromQuotationComparison} aria-label="Close bid comparison">
                      <IconClose />
                    </button>
                    <h2 className="bad-modal-name">
                      {selectedQuotationsRfq?.title || "RFQ Quotations"}
                    </h2>
                    {selectedQuotationsRfq && (
                      <div className="bad-modal-meta">
                        <span><IconFile /> {selectedQuotationsRfq.rfqNumber}</span>
                        <span><IconPin /> {selectedQuotationsRfq.deliveryLocation}</span>
                      </div>
                    )}
                  </div>

                  <div className="bad-modal-body bad-modal-body-scroll">
                    <QuotationComparisonCard
                      rfqId={selectedQuotationsRfq?.rfqId}
                      rfqTitle={selectedQuotationsRfq?.title}
                    />
                  </div>

                </div>
              </>
            ) : rfqPageView === "qsAns" ? (
              <AdminQsAns
                rfq={fullPageRfq}
                loading={loadingFullPageRfq}
                error={fullPageRfqError && !fullPageRfq ? fullPageRfqError : null}
                onBack={handleBackToRfqDetail}
              />
            ) : (
              <>
                <div className="bad-page-header">
                  <h1 className="bad-title">Buyer Admin Command Center</h1>
                  <p className="bad-subtitle">Manage buyers, track procurement activities, and oversee operations.</p>
                </div>

                <NeedsAttentionPanel
                  currentUserId={currentUserId}
                  hasSilaMe={hasSilaMe}
                  bucketRole="reviewer"
                  onNavigate={handleNavClick}
                />

                <BuyerAnalytics
                  state={analytics}
                  onViewRfqs={handleOpenAllRfqs}
                  onOpenRfq={handleViewRfqDetailsFullPage}
                />

                <div className="bad-panels">
                  <section className="bad-panel">
                    <div className="bad-panel-header">
                      <div>
                        <div className="bad-panel-title">Recent RFQs</div>
                        <div className="bad-panel-subtitle">RFQs posted across your organization, awaiting supplier quotations</div>
                      </div>
                      {!loadingRfqs && !rfqsError && rfqs.length > 0 && (
                        <a
                          className="bad-panel-link"
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleOpenAllRfqs();
                          }}
                        >
                          View All RFQs →
                        </a>
                      )}
                    </div>
                    {loadingRfqs ? (
                      <div className="bad-panel-list bad-panel-state">
                        <div className="bad-state-inner">
                          <div className="bad-spinner" aria-hidden="true" />
                          <span>Loading sourcing opportunities...</span>
                        </div>
                      </div>
                    ) : rfqsError ? (
                      <div className="bad-panel-list bad-panel-state">
                        <div className="bad-state-inner bad-state-error" role="alert">
                          {rfqsError}
                        </div>
                      </div>
                    ) : rfqs.length === 0 ? (
                      <div className="bad-panel-list bad-panel-state">
                        <div className="bad-state-inner">
                          No RFQs found.
                        </div>
                      </div>
                    ) : (
                      <div className="bad-panel-list">
                        {rfqs.slice(0, visibleRfqCount).map((rfq) => (
                          <div
                            className="bad-rfq-card-item"
                            key={rfq.rfqId}
                            onClick={() => handleViewRfqDetailsFullPage(rfq.rfqId)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleViewRfqDetailsFullPage(rfq.rfqId);
                            }}
                            role="button"
                            tabIndex={0}
                          >
                            <div className="bad-rfq-meta">
                              <span className="bad-code-badge sila-ref">{rfq.rfqNumber}</span>
                              <span className="bad-dot-sep" aria-hidden="true">•</span>
                              <span className="bad-company">{rfq.organizationName}</span>
                            </div>

                            <div className="bad-rfq-title bad-rfq-link-title">{rfq.title}</div>

                            <div className="bad-rfq-details">
                              <span>
                                <IconCalendar /> Closes: {rfq.endDate ? new Date(rfq.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Open'}
                              </span>
                              <span>
                                <IconPin /> Deliv: {rfq.deliveryLocation}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>

                  <section className="bad-panel">
                    <div className="bad-panel-header">
                      <div>
                        <h2 className="bad-panel-title">Recent Purchase Orders</h2>
                        <div className="bad-panel-subtitle">Orders created in your ERP</div>
                      </div>
                    </div>
                    <RecentPurchaseOrderList side="buyer" classPrefix="bad" />
                  </section>

                </div>

                <section className="bad-matchmaker">
                  <div className="bad-matchmaker-header">
                    <div className="bad-matchmaker-title-row">
                      <span className="bad-matchmaker-icon" aria-hidden="true"><IconSparkles /></span>
                      <div className="bad-matchmaker-title">Supplier Network Overview</div>
                    </div>
                    <div className="bad-matchmaker-subtitle">
                      Monitor connected suppliers and their engagement with your buyers.
                    </div>
                  </div>

                  <div className="bad-match-grid">
                    {matchCards.map((card) => (
                      <div className="bad-match-card" key={card.name}>
                        <span className="bad-match-location"><IconPin /> {card.location}</span>
                        <div className="bad-match-top">
                          <div className="bad-match-avatar" aria-hidden="true">{card.initials}</div>
                          <div>
                            <div className="bad-match-name">{card.name}</div>
                            <div className="bad-match-seeking"><NavIconBuilding /> Supplies: {card.seeking}</div>
                          </div>
                        </div>
                        <p className="bad-match-desc">{card.description}</p>
                        <div className="bad-match-rep-row">
                          <span className="bad-match-rep-label">Representative:</span>
                          <span className="bad-match-rep-name">{card.representative}</span>
                        </div>
                        <div className="bad-match-actions">
                          <button
                            type="button"
                            className="bad-btn bad-btn-outline bad-btn-flex"
                            onClick={() => setSelectedProfile(card)}
                          >
                            <IconEye /> Profile
                          </button>
                          {card.actionVariant === "message" ? (
                            <button type="button" className="bad-btn bad-btn-message bad-btn-flex">
                              <IconMessageSquare /> Message
                            </button>
                          ) : (
                            <button type="button" className="bad-btn bad-btn-interest bad-btn-flex">
                              <IconSend /> Send Interest
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bad-pagination">
                    <button type="button" className="bad-page-btn bad-page-btn-disabled" disabled aria-label="Previous page">
                      <IconChevronLeft />
                    </button>
                    <button type="button" className="bad-page-btn bad-page-btn-active" aria-label="Next page">
                      <IconChevronRight />
                    </button>
                  </div>
                </section>
              </>
            )}
          </div>
        </div>

        {selectedProfile && (
          <div className="bad-modal-overlay" onClick={() => setSelectedProfile(null)}>
            <div className="bad-modal" role="dialog" aria-modal="true" aria-label={selectedProfile.name} onClick={(e) => e.stopPropagation()}>
              <div className="bad-modal-header">
                <span className="bad-modal-badge">
                  <IconShieldCheck /> Verified Supplier Partner
                </span>
                <button type="button" className="bad-modal-close" onClick={() => setSelectedProfile(null)} aria-label="Close profile">
                  <IconClose />
                </button>
                <h2 className="bad-modal-name">{selectedProfile.name}</h2>
                <div className="bad-modal-meta">
                  <span><IconPin /> {selectedProfile.location}</span>
                  <span><IconGlobe /> {selectedProfile.website}</span>
                </div>
              </div>

              <div className="bad-modal-body">
                <div className="bad-modal-section-title">Organization Description</div>
                <p className="bad-modal-desc">{selectedProfile.description}</p>

                <div className="bad-modal-analytics">
                  <div className="bad-modal-analytics-title">
                    <IconSparkles /> Verified Match Analytics
                  </div>
                  <div className="bad-modal-analytics-grid">
                    <div className="bad-modal-analytics-item">
                      <span className="bad-modal-check"><IconCheckCircle /></span>
                      <div>
                        <div className="bad-modal-analytics-label">Supply Category</div>
                        <div className="bad-modal-analytics-value">{selectedProfile.seeking}</div>
                        <div className="bad-modal-analytics-note">{selectedProfile.categoryNote}</div>
                      </div>
                    </div>
                    <div className="bad-modal-analytics-item">
                      <span className="bad-modal-check"><IconCheckCircle /></span>
                      <div>
                        <div className="bad-modal-analytics-label">Service Region</div>
                        <div className="bad-modal-analytics-value">{selectedProfile.location}</div>
                        <div className="bad-modal-analytics-note">{selectedProfile.destinationNote}</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bad-modal-info-grid">
                  <div>
                    <div className="bad-modal-info-label">Company Representative</div>
                    <div className="bad-modal-info-value">
                      {selectedProfile.representative} ({selectedProfile.repTitle})
                    </div>
                    <a className="bad-modal-info-link" href={`mailto:${selectedProfile.repEmail}`}>
                      {selectedProfile.repEmail}
                    </a>
                  </div>
                  <div>
                    <div className="bad-modal-info-label">Scale of Operations</div>
                    <div className="bad-modal-info-value">Revenue: {selectedProfile.revenue}</div>
                    <div className="bad-modal-info-value">Scale: {selectedProfile.employees}</div>
                  </div>
                </div>
              </div>

              <div className="bad-modal-footer">
                {selectedProfile.actionVariant === "message" ? (
                  <button type="button" className="bad-btn bad-btn-message bad-modal-footer-btn">
                    <IconMessageSquare /> Message Supplier
                  </button>
                ) : (
                  <button type="button" className="bad-btn bad-btn-interest bad-modal-footer-btn">
                    <IconSend /> Send Interest
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {isChatOpen && fullPageRfqId && (
          <ChatPanel
            role="buyer"
            onClose={() => setIsChatOpen(false)}
            rfqId={fullPageRfqId}
            rfqNumber={fullPageRfq?.rfqNumber}
            rfqTitle={fullPageRfq?.title}
            counterparties={chatCounterparties}
            currentUserProfile={buyerProfile}
            isLoadingCurrentUserProfile={isLoadingBuyerProfile}
            api={createBuyerChatApi(fullPageRfqId)}
            hubParams={{ rfqId: fullPageRfqId }}
          />
        )}
    </Header>
  );
};

export default BuyerAdminDash;