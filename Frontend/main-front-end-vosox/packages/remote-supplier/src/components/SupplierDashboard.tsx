import React, { useState, useEffect } from "react";
import "./SupplierDashboard.css";
import Catalog from "./Catalog.tsx";
import { CompanyProfile, EmptyState, Loader, PageHeader, Pagination, SupplierAnalytics, useAsyncData, useRouteNav, type RouteNavPaths } from '@vosox/shared-ui';
// import Invitations from "./Invitations.tsx";
import {
  logoutSupplier,
  fetchRFQMasterData,
  getSupplierProfile,
  type RFQMasterDataItem,
  fetchSupplierDashboardAnalytics,
} from "../api/supplierApi";
import { useLocation } from "react-router-dom";
import Header from "./Header.tsx";
import { useAuth } from '../../../host-app/src/AuthContext.tsx';
import EAuctionWidget from "./EAuctionWidget.tsx";
import SupplierRfqQuotationSummary from "./SupplierRfqQuotationSummary";
import { usePaginatedRfqs, RFQ_PAGE_SIZE } from "../hooks/usePaginatedRfqs";
import { useRfqDetailLoader } from "../hooks/useRfqDetailLoader";
import MatchProfileModal from "./SupplierDashboard/MatchProfileModal";
import RecentSourcingCard from "./SupplierDashboard/RecentSourcingCard";
import RecentPurchaseOrdersCard from "./SupplierDashboard/RecentPurchaseOrdersCard";
import MatchmakerGrid, { type MatchCard } from "./SupplierDashboard/MatchmakerGrid";
import { formatShortDate, onActivateKey } from "./SupplierDashboard/utils";

const NavIconHome = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    <path d="M9 22V12h6v10" />
  </svg>
);

const NavIconFile = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const NavIconCatalog = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
  </svg>
);

/** Each section's URL (/dashboard, /rfqs …); see useRouteNav. */
const SUPPLIER_NAV_PATHS: RouteNavPaths = {
  dashboard: 'dashboard',
  rfqs: 'rfqs',
  catalogList: 'catalog',
  invitations: 'invitations',
  companyProfile: 'company-profile',
};

const navItems: { key: string; icon: React.ReactNode; label: string; badge?: number }[] = [
  { key: "dashboard", icon: <NavIconHome />, label: "Dashboard" },
  { key: "rfqs", icon: <NavIconFile />, label: "RFQs" },
  { key: "catalogList", icon: <NavIconCatalog />, label: "Catalog" },
];

const VERIFICATION_TOKEN_COOKIE = "vsx_verification_token";

const deleteCookie = (name: string) => {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
};

const SupplierDashboard: React.FC = () => {

  const [activeNav, setActiveNav] = useRouteNav(SUPPLIER_NAV_PATHS, "dashboard");
  const [selectedProfile, setSelectedProfile] = useState<MatchCard | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [catalogViewContainer, setCatalogViewContainer] = useState<HTMLDivElement | null>(null);

  const { auth } = useAuth();
  const [supplierId, setSupplierId] = useState<string | null>(auth?.supplierId ?? null);

  useEffect(() => {
    if (auth?.supplierId) {
      setSupplierId(auth.supplierId);
    }
  }, [auth?.supplierId]);
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
  } = useRfqDetailLoader(supplierId);

  useEffect(() => {
    const loadSupplierProfile = async () => {
      if (!supplierId) {
        try {
          const profile = await getSupplierProfile();
          if (profile && 'id' in profile && profile.id) {
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
        if (Array.isArray(data)) {
          setRfqs(data);
          setVisibleRfqCount(Math.min(RFQ_INITIAL_VISIBLE, data.length));
        }
      } catch (err: any) {

        setRfqsError(err.message || "Failed to load sourcing opportunities.");
      } finally {
        setLoadingRfqs(false);
      }
    };
    loadRfqs();
  }, [supplierId]);

  const location = useLocation();

  useEffect(() => {
    const intendedView = (location.state as { view?: string })?.view;
    if (intendedView === "companyProfile") {
      setActiveNav("companyProfile");
    }
  }, [location.state]);

  const [rfqPageView, setRfqPageView] = useState<"dashboard" | "allRfqs" | "rfqDetail">("dashboard");
  const [previousRfqPageView, setPreviousRfqPageView] = useState<"dashboard" | "allRfqs">("dashboard");

  const {
    allRfqsList,
    loadingAllRfqs,
    allRfqsError,
    allRfqsPage,
    setAllRfqsPage,
    hasNextRfqPage,
    fetchAllRfqsPage,
    handleNextRfqPage,
    handlePreviousRfqPage,
  } = usePaginatedRfqs(supplierId, rfqs);

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

    if (loadingAllRfqs) return;

    setAllRfqsPage(1);
    await fetchAllRfqsPage(1);
  };

  const handleBackToDashboard = () => {
    setRfqPageView("dashboard");
    setActiveNav("dashboard");
    setSelectedRfqId(null);
    setSelectedRfq(null);
    setRfqDetailError(null);
  };

  // The RFQ list has its own URL (/rfqs). When the URL changes by itself (Back/Forward,
  // reload, a shared link), bring the RFQ view in line with it.
  useEffect(() => {
    if (activeNav === "rfqs") {
      if (rfqPageView === "dashboard") {
        setRfqPageView("allRfqs");
      }
      if (supplierId) {
        fetchAllRfqsPage(allRfqsPage > 0 ? allRfqsPage : 1, supplierId);
      }
    } else if (activeNav !== "rfqs" && rfqPageView === "allRfqs") {
      setRfqPageView("dashboard");
    }
  }, [activeNav, supplierId]);

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
  };

  const handleRetryRfqDetail = () => {
    if (selectedRfqId) loadRfqDetail(selectedRfqId);
  };

  const refreshRfqsList = async () => {
    if (!supplierId) return;
    const listData = await fetchRFQMasterData({ supplierId, index: 0, limit: 10 });
    if (Array.isArray(listData)) {
      setRfqs(listData);
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutSupplier();
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
    <Header navItems={navItems} activeNav={activeNav} onNavClick={handleNavClick} onLogout={handleLogout}>
        {/* Catalog renders the catalog page (portalled into catalogViewContainer) and its modals.
            Its own nav widget stays hidden, as before: "Catalog" is already a sidebar entry. */}
        <div hidden>
          <Catalog
            onShowCatalogList={() => setActiveNav("catalogList")}
            fullViewContainer={activeNav === "catalogList" ? catalogViewContainer : null}
          />
        </div>

        <div className="pud-main">
          <div className="pud-content">
            {activeNav === "catalogList" ? (
              <div ref={setCatalogViewContainer} />
            ) : rfqPageView === "allRfqs" ? (
              <>
                <PageHeader
                  className="pud-page-header"
                  title="All RFQs"
                  description="Sourcing opportunities matched to your industry categories."
                  onBack={handleBackToDashboard}
                  backLabel="Back to Dashboard"
                />

                <section className="sila-card pud-allrfqs-card">
                  {loadingAllRfqs ? (
                    <Loader size={24} message="Loading all sourcing opportunities..." />
                  ) : allRfqsError && allRfqsList.length === 0 ? (
                    <EmptyState variant="error" title="Couldn't load RFQs" description={allRfqsError} />
                  ) : allRfqsList.length === 0 ? (
                    <EmptyState title="No RFQs found." />
                  ) : (
                    <>
                      <div className="sila-table-wrap">
                        <table className="sila-table pud-allrfqs-table">
                          <thead>
                            <tr>
                              <th className="pud-col-index" scope="col">S.No</th>
                              <th scope="col">RFQ Number</th>
                              <th scope="col">Title</th>
                              <th scope="col">Organization</th>
                              <th scope="col">Delivery Location</th>
                              <th scope="col">Closing Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {allRfqsList.map((rfq: any, idx: number) => (
                              <tr
                                key={rfq.rfqId || idx}
                                className="sila-row-clickable"
                                tabIndex={0}
                                onClick={() => handleViewRfqDetailsFullPage(rfq.rfqId)}
                                onKeyDown={(e) => onActivateKey(e, () => handleViewRfqDetailsFullPage(rfq.rfqId))}
                              >
                                <td className="sila-cell-muted pud-col-index">
                                  {(allRfqsPage - 1) * RFQ_PAGE_SIZE + idx + 1}
                                </td>
                                <td><span className="sila-ref">{rfq.rfqNumber}</span></td>
                                <td className="sila-cell-strong pud-allrfqs-title">{rfq.title}</td>
                                <td>{rfq.organizationName}</td>
                                <td>{rfq.deliveryLocation}</td>
                                <td className="pud-allrfqs-date">{formatShortDate(rfq.endDate) ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <Pagination
                        page={allRfqsPage}
                        hasNext={hasNextRfqPage}
                        onPrevious={handlePreviousRfqPage}
                        onNext={handleNextRfqPage}
                        disabled={loadingAllRfqs}
                      />
                    </>
                  )}
                </section>
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
                />
              </div>
            ) : activeNav === "companyProfile" ? (
              <CompanyProfile
                mode="network-admin"
                entityLabel="Supplier"
                fetchProfile={async () => {
                  const profile = await getSupplierProfile();
                  if (profile && 'id' in profile) {
                    return profile as any;
                  }
                  return null;
                }}
              />) : (
              // ) : activeNav === "invitations" ? (
              //   <Invitations />
              // ) : (
              <>
                <PageHeader
                  className="pud-page-header"
                  title="Supplier Operations Command"
                  description="Real-time procurement tracking, bid submittals, and transaction monitoring."
                />

                <SupplierAnalytics
                  state={analytics}
                  onViewRfqs={() => handleNavClick("rfqs")}
                  onOpenRfq={handleViewRfqDetailsFullPage}
                />

                <div className="pud-panels">
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
              </>
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

export default SupplierDashboard;
