import React, { useState, useEffect } from "react";
import "./SupplierAdminDash.css";
import "../../../remote-supplier/src/components/SupplierDashboard.css"
import Header from "./Header";
import UserAdmin from "../UserAdmin";
import CompanyProfile from "./CompanyProfile/CompanyProfile";
import Catalog from "../../../remote-supplier/src/components/Catalog";
import IntegrationHub from "../../../remote-buyer/src/components/integration/IntegrationHub";
import Invitations from "../../../remote-supplier/src/components/Invitations";
import SupplierRfqQuotationSummary from "../../../remote-supplier/src/components/SupplierRfqQuotationSummary";
import { useNetworkAdminAuthStore } from "../store/useAuthStore";
import {
  fetchRFQMasterData,
  getSupplierProfile,
  type RFQMasterDataItem,
  fetchSupplierDashboardAnalytics,
} from "../../../remote-supplier/src/api/supplierApi";
import { logoutPlatformUser } from "../api/platformApi";
import { SupplierAnalytics, isErrorResponse, useAsyncData, useRouteNav, type RouteNavPaths } from "@vosox/shared-ui";
import EAuctionWidget from "../../../remote-supplier/src/components/EAuctionWidget.tsx";
import { useAdminPaginatedRfqs, RFQ_PAGE_SIZE } from "../hooks/useAdminPaginatedRfqs";
import { useAdminRfqDetailLoader } from "../hooks/useAdminRfqDetailLoader";
import MatchProfileModal from "./SupplierAdminDash/MatchProfileModal";
import RecentSourcingCard from "./SupplierAdminDash/RecentSourcingCard";
import RecentPurchaseOrdersCard from "./SupplierAdminDash/RecentPurchaseOrdersCard";
import MatchmakerGrid, { type MatchCard } from "./SupplierAdminDash/MatchmakerGrid";
import { IconChevronLeft, IconChevronRight } from "./SupplierAdminDash/icons";

const IconMail = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const NavIconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
);

const NavIconUsers = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const NavIconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const NavIconCatalog = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

/** Each section's URL (/dashboard, /rfqs …); see useRouteNav. */
const SUPPLIER_ADMIN_NAV_PATHS: RouteNavPaths = {
  dashboard: "dashboard",
  userList: "users",
  rfqs: "rfqs",
  catalogList: "catalog",
  invitations: "invitations",
  companyProfile: "company-profile",
  integrations: "integrations",
  workflowConfiguration: "workflow-configuration",
};

const headerNavItems: { key: string; icon: React.ReactNode; label: string; badge?: number }[] = [
  { key: "dashboard", icon: <NavIconHome />, label: "Dashboard" },
  { key: "userList", icon: <NavIconUsers />, label: "User List" },
  { key: "rfqs", icon: <NavIconFile />, label: "RFQs" },
  { key: "catalogList", icon: <NavIconCatalog />, label: "Catalog" },
  { key: "invitations", icon: <IconMail />, label: "Invitations" },
  { key: "integrations", icon: <NavIconCatalog />, label: "Integration" },
  { key: "workflowConfiguration", icon: <NavIconFile />, label: "Workflow & Configuration" },
];

const VERIFICATION_TOKEN_COOKIE = "vsx_verification_token";

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

const SupplierAdminDash: React.FC = () => {
  const [activeNav, setActiveNav] = useRouteNav(SUPPLIER_ADMIN_NAV_PATHS, "dashboard");
  const [catalogViewContainer, setCatalogViewContainer] = useState<HTMLDivElement | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<MatchCard | null>(null);

  /* ---------------------------------- RFQ management (ported from SupplierDashboard) ---------------------------------- */

  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const personDetail = useNetworkAdminAuthStore((state) => state.personDetail);
  const [supplierId, setSupplierId] = useState<string | null>(currentUser?.supplierId || null);

  useEffect(() => {
    if (currentUser?.supplierId) {
      setSupplierId(currentUser.supplierId);
    }
  }, [currentUser?.supplierId]);

  const [rfqs, setRfqs] = useState<RFQMasterDataItem[]>([]);
  const analytics = useAsyncData(fetchSupplierDashboardAnalytics);
  const [loadingRfqs, setLoadingRfqs] = useState(true);
  const [rfqsError, setRfqsError] = useState<string | null>(null);
  const [visibleRfqCount, setVisibleRfqCount] = useState(3);
  const RFQ_INITIAL_VISIBLE = 3;

  const {
    ownQuotation,
    setOwnQuotation,
    selectedRfqId,
    setSelectedRfqId,
    selectedRfq,
    setSelectedRfq,
    loadingRfqDetail,
    rfqDetailError,
    setRfqDetailError,
    loadRfqDetail,
    clearRfqDetail,
  } = useAdminRfqDetailLoader(supplierId);

  useEffect(() => {
    if (!supplierId) {
      setRfqsError("Supplier ID not found in session.");
      setLoadingRfqs(false);
    }
  }, [supplierId]);

  useEffect(() => {
    const loadSupplierProfile = async () => {
      if (!supplierId) {
        try {
          const profile = await getSupplierProfile();

          if (isErrorResponse(profile)) {
            setRfqsError("Supplier profile not found. Please complete onboarding.");
            setLoadingRfqs(false);
            return;
          }

          if (profile && profile.id) {
            setSupplierId(profile.id);
          } else {
            setRfqsError("Supplier profile not found. Please complete onboarding.");
            setLoadingRfqs(false);
          }
        } catch (err: any) {
          setRfqsError("Failed to load supplier profile details.");
          setLoadingRfqs(false);
        }
      }
    };
    loadSupplierProfile();
  }, [supplierId]);

  useEffect(() => {
    const loadRfqs = async () => {
      if (!supplierId) return;

      setLoadingRfqs(true);
      setRfqsError(null);

      try {
        const initialLimit = RFQ_INITIAL_VISIBLE;
        const data = await fetchRFQMasterData({
          supplierId,
          index: 0,
          limit: initialLimit,
        });

        // ✅ ADD ERROR CHECK HERE
        if (isErrorResponse(data)) {
          setRfqsError(data.description || data.message || "Failed to load sourcing opportunities.");
          setRfqs([]);
          setLoadingRfqs(false);
          return;
        }

        setRfqs(data);
        setVisibleRfqCount(Math.min(RFQ_INITIAL_VISIBLE, data.length));
      } catch (err: any) {
        setRfqsError(err.message || "Failed to load sourcing opportunities.");
      } finally {
        setLoadingRfqs(false);
      }
    };
    loadRfqs();
  }, [supplierId]);

  const [rfqPageView, setRfqPageView] = useState<"dashboard" | "allRfqs" | "rfqDetail">("dashboard");
  const [previousRfqPageView, setPreviousRfqPageView] = useState<"dashboard" | "allRfqs">("dashboard");

  const {
    allRfqsList,
    loadingAllRfqs,
    allRfqsError,
    allRfqsLoaded,
    allRfqsPage,
    allRfqsHasMore,
    loadAllRfqsPage,
    handleAllRfqsNextPage,
    handleAllRfqsPrevPage,
  } = useAdminPaginatedRfqs(supplierId, rfqs);

  useEffect(() => {
    const handlePopState = () => {
      if (rfqPageView === "rfqDetail") {
        const targetView = previousRfqPageView || "allRfqs";
        setRfqPageView(targetView);
        if (targetView === "dashboard") {
          setActiveNav("dashboard");
        } else {
          setActiveNav("rfqs");
        }
        clearRfqDetail();
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [rfqPageView, previousRfqPageView]);

  const handleOpenAllRfqs = async () => {
    setActiveNav("rfqs");
    setRfqPageView("allRfqs");
    if (allRfqsLoaded || loadingAllRfqs) return;
    await loadAllRfqsPage(1);
  };

  // const handleBackToDashboard = () => {
  //   setRfqPageView("dashboard");
  //   setActiveNav("dashboard");
  //   setSelectedRfqId(null);
  //   setSelectedRfq(null);
  //   setRfqDetailError(null);
  // };

  // The RFQ list has its own URL (/rfqs). When the URL changes by itself (Back/Forward,
  // reload, a shared link), bring the RFQ view in line with it.
  useEffect(() => {
    if (activeNav === "rfqs" && rfqPageView === "dashboard") {
      handleOpenAllRfqs();
    } else if (activeNav !== "rfqs" && rfqPageView === "allRfqs") {
      setRfqPageView("dashboard");
    }
  }, [activeNav]);

  const handleNavClick = (key: string) => {
    if (key === "rfqs") {
      handleOpenAllRfqs();
      return;
    }
    setActiveNav(key);
    setRfqPageView("dashboard");
    setSelectedRfqId(null);
    setSelectedRfq(null);
    setRfqDetailError(null);
  };

  const handleViewRfqDetailsFullPage = (rfqId: string) => {
    if (rfqPageView === "dashboard" || rfqPageView === "allRfqs") {
      setPreviousRfqPageView(rfqPageView);
    }
    window.history.pushState({ rfqPageView: "rfqDetail" }, "");
    setRfqPageView("rfqDetail");
    loadRfqDetail(rfqId);
  };

  const closeRfqDetail = () => {
    const targetView = previousRfqPageView || "allRfqs";
    setRfqPageView(targetView);
    if (targetView === "dashboard") {
      setActiveNav("dashboard");
    } else {
      setActiveNav("rfqs");
    }
    clearRfqDetail();
    if (targetView === "allRfqs" && !allRfqsLoaded && !loadingAllRfqs) {
      loadAllRfqsPage(1);
    }
  };


  const handleRetryRfqDetail = () => {
    if (selectedRfqId) loadRfqDetail(selectedRfqId);
  };

  const refreshRfqsList = async () => {
    if (!supplierId) return;
    const listData = await fetchRFQMasterData({
      supplierId,
      index: 0,
      limit: 10,
    });
    if (!isErrorResponse(listData)) {
      setRfqs(listData);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutPlatformUser();
    } catch {
      // The session is cleared locally below even when the server call fails.
    } finally {
      sessionStorage.clear();
      deleteCookie(VERIFICATION_TOKEN_COOKIE);
      window.dispatchEvent(new CustomEvent("session:expired"));
      setLoggingOut(false);
    }
  };

  return (
    <Header navItems={headerNavItems} activeNav={activeNav} onNavClick={handleNavClick} onLogout={handleLogout}>
        {/* Catalog renders the catalog page (portalled into catalogViewContainer) and its modals.
            Its own nav widget stays hidden, as before: "Catalog" is already a sidebar entry. */}
        <div hidden>
          <Catalog
            isAdmin={true}
            onShowCatalogList={() => setActiveNav("catalogList")}
            fullViewContainer={activeNav === "catalogList" ? catalogViewContainer : null}
          />
        </div>

        <div className="sad-main">
          <div className="sad-content">
            {activeNav === "catalogList" ? (
              <div ref={setCatalogViewContainer} className="sad-catalog-view" />
            )
              : activeNav === "userList" ? (
                <UserAdmin />
              ) : activeNav === "integrations" ? (
                <IntegrationHub variant="integration" side="supplier" />
              ) : activeNav === "workflowConfiguration" ? (
                <IntegrationHub variant="workflow" side="supplier" />
              ) : activeNav === "companyProfile" ? (
                <CompanyProfile mode="network-admin" showHeader={false} />
              ) : activeNav === "invitations" ? (
                <Invitations isAdmin adminRole="supplier" />
              ) : rfqPageView === "allRfqs" ? (
                <>
                  <div className="sad-border">
                    <div className="sad-table-header">
                      <h1 className="pud-title sad-title">All RFQs</h1>
                      <span className="pud-subtitle sad-subtitle">
                        Sourcing opportunities matched to your industry categories.
                      </span>
                    </div>

                    {loadingAllRfqs ? (
                      <div className="sad-state-box">
                        <div className="sad-state-inner">
                          <div className="pud-spinner" aria-hidden="true" />
                          <span>Loading all sourcing opportunities...</span>
                        </div>
                      </div>
                    ) : allRfqsError && allRfqsList.length === 0 ? (
                      <div className="sad-state-message sad-state-error" role="alert">{allRfqsError}</div>
                    ) : allRfqsList.length === 0 ? (
                      <div className="sad-state-message">
                        No RFQs found.
                      </div>
                    ) : (
                      <>
                        <div className="pud-rfq-table-container">
                          <table className="pud-rfq-items-table pud-allrfqs-table">
                            <thead className="ua-table">
                              <tr>
                                <th className="sad-col-sno">S.No</th>
                                <th>RFQ Number</th>
                                <th>Title</th>
                                <th>Organization</th>
                                <th>Delivery Location</th>
                                <th>Closing Date</th>
                                {/* <th>Action</th> */}
                              </tr>
                            </thead>
                            <tbody className="ua-table-body">
                              {allRfqsList.map((rfq: any, idx: number) => (
                                <tr
                                  key={rfq.rfqId || idx}
                                  className="sad-row-clickable"
                                  tabIndex={0}
                                  onClick={() => handleViewRfqDetailsFullPage(rfq.rfqId)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleViewRfqDetailsFullPage(rfq.rfqId);
                                  }}
                                >
                                  <td className="sad-cell-sno">{(allRfqsPage - 1) * RFQ_PAGE_SIZE + idx + 1}</td>
                                  <td><span className="pud-code-badge sila-ref">{rfq.rfqNumber}</span></td>
                                  <td className="sad-cell-strong">{rfq.title}</td>
                                  <td>{rfq.organizationName}</td>
                                  <td>{rfq.deliveryLocation}</td>
                                  <td>
                                    {rfq.endDate
                                      ? new Date(rfq.endDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                      : "—"}
                                  </td>
                                  {/* <td>
                                  <button
                                    className="pud-btn pud-btn-outline"
                                    onClick={() => handleViewRfqDetailsFullPage(rfq.rfqId)}
                                  >
                                    View RFQ Details
                                  </button>
                                </td> */}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="pud-pagination pud-allrfqs-pagination">
                          <button
                            type="button"
                            className={`pud-page-btn${allRfqsPage === 1 || loadingAllRfqs ? " pud-page-btn-disabled" : ""}`}
                            onClick={handleAllRfqsPrevPage}
                            disabled={allRfqsPage <= 1 || loadingAllRfqs}
                            aria-label="Previous RFQ page"
                          >
                            <IconChevronLeft />
                          </button>

                          <span className="pud-page-number">Page {allRfqsPage}</span>

                          <button
                            type="button"
                            className={`pud-page-btn${!allRfqsHasMore || loadingAllRfqs ? " pud-page-btn-disabled" : ""}`}
                            onClick={handleAllRfqsNextPage}
                            disabled={!allRfqsHasMore || loadingAllRfqs}
                            aria-label="Next RFQ page"
                          >
                            <IconChevronRight />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              ) : rfqPageView === "rfqDetail" ? (
                <div className="pud-rfq-fullpage-view">
                  <SupplierRfqQuotationSummary
                    selectedRfq={selectedRfq}
                    selectedRfqId={selectedRfqId}
                    ownQuotation={ownQuotation}
                    loadingRfqDetail={loadingRfqDetail}
                    rfqDetailError={rfqDetailError}
                    supplierId={supplierId}
                    onClose={closeRfqDetail}
                    onRetry={handleRetryRfqDetail}
                    setSelectedRfq={setSelectedRfq}
                    setOwnQuotation={setOwnQuotation}
                    onRfqsRefresh={refreshRfqsList}
                    personDetail={personDetail}
                  />
                </div>
              ) : (
                <div className="sad-dashboard">
                  <div className="sad-page-header">
                    <h1 className="sad-title">Supplier Admin Command Center</h1>
                    <p className="sad-subtitle">Manage suppliers, track sourcing activities, and oversee operations.</p>
                  </div>
                  {/*
                  <div className="sad-status-banner">
                    <span className="sad-status-dot" />
                    <div>
                      <div className="sad-status-title">Active Supplier Administration Portal (100%)</div>
                      <div className="sad-status-subtext">
                        You have administrative access to manage supplier operations and user accounts.
                      </div>
                    </div>
                  </div> */}

                  <SupplierAnalytics
                    state={analytics}
                    onViewRfqs={() => handleNavClick("rfqs")}
                    onOpenRfq={handleViewRfqDetailsFullPage}
                  />

                  <div className="sad-panels">
                    <RecentSourcingCard
                      rfqs={rfqs}
                      visibleRfqCount={visibleRfqCount}
                      loading={loadingRfqs}
                      error={rfqsError}
                      onViewAll={handleOpenAllRfqs}
                      onOpenRfq={handleViewRfqDetailsFullPage}
                    />

                    <RecentPurchaseOrdersCard />
                  </div>

                  <MatchmakerGrid onSelectProfile={setSelectedProfile} />
                </div>
              )}
          </div>
        </div>

        {selectedProfile && (
          <MatchProfileModal profile={selectedProfile} onClose={() => setSelectedProfile(null)} />
        )}

      <EAuctionWidget supplierId={supplierId} />
    </Header>
  );
};

export default SupplierAdminDash;
