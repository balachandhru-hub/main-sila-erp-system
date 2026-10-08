import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllBuyers, getAllSuppliers, logoutPlatformUser } from '../api/platformApi';
import type { BuyerDto, SupplierDto, BusinessProfileDto, PlatformEntityType, PlatformRecordDto } from '../dto/platformDto';
import {
  FaUser,
  FaBuilding,
  FaEnvelope,
  FaPhone,
  FaGlobe,
  FaMapMarkerAlt,
  FaSearch,
  FaSignOutAlt,
  FaCog,
  FaThLarge,
  FaList,
  FaExternalLinkAlt,
  FaTimes,
  FaExclamationCircle,
} from 'react-icons/fa';
import { AppShell, PageHeader, EmptyState, StatusBadge } from '@vosox/shared-ui';
import type { AppNavItem, AppUserMenuItem } from '@vosox/shared-ui';
import { PlatformUserDetailView } from './PlatformUserDetailView';
import './PlatformUserDashboard.css';

const PAGE_SIZE = 8;

export const PlatformUserDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [buyers, setBuyers] = useState<BuyerDto[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierDto[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [sectionLoading, setSectionLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PlatformEntityType>('buyers');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loggingOut, setLoggingOut] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const [buyerIndex, setBuyerIndex] = useState<number>(0);
  const [supplierIndex, setSupplierIndex] = useState<number>(0);
  const [buyersHasMore, setBuyersHasMore] = useState<boolean>(true);
  const [suppliersHasMore, setSuppliersHasMore] = useState<boolean>(true);
  const [loadingMore, setLoadingMore] = useState<boolean>(false);

  const [selectedDetail, setSelectedDetail] = useState<{ type: PlatformEntityType; record: PlatformRecordDto } | null>(
    null
  );

  const loadBuyers = useCallback(async (index: number = 0) => {
    setSectionLoading(true);
    try {
      const data = await getAllBuyers({ index, limit: PAGE_SIZE });
      const resolved = Array.isArray(data) ? data : (data as any)?.buyers || (data as any)?.data || [];
      setBuyers(resolved);
      setBuyerIndex(0);
      setBuyersHasMore(resolved.length === PAGE_SIZE);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch buyers:', err);
      setError(err.message || 'Failed to load buyers.');
    } finally {
      setSectionLoading(false);
    }
  }, []);

  const loadSuppliers = useCallback(async (index: number = 0) => {
    setSectionLoading(true);
    try {
      const data = await getAllSuppliers({ index, limit: PAGE_SIZE });
      const resolved = Array.isArray(data) ? data : (data as any)?.suppliers || (data as any)?.data || [];
      setSuppliers(resolved);
      setSupplierIndex(0);
      setSuppliersHasMore(resolved.length === PAGE_SIZE);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch suppliers:', err);
      setError(err.message || 'Failed to load suppliers.');
    } finally {
      setSectionLoading(false);
    }
  }, []);

  // Initial load: fetch both lists' first page
  useEffect(() => {
    (async () => {
      setLoading(true);
      const [buyersResult, suppliersResult] = await Promise.allSettled([
        getAllBuyers({ index: 0, limit: PAGE_SIZE }),
        getAllSuppliers({ index: 0, limit: PAGE_SIZE }),
      ]);

      const errors: string[] = [];

      if (buyersResult.status === 'fulfilled') {
        const resolved = Array.isArray(buyersResult.value)
          ? buyersResult.value
          : (buyersResult.value as any)?.buyers || (buyersResult.value as any)?.data || [];
        setBuyers(resolved);
        setBuyersHasMore(resolved.length === PAGE_SIZE);
      } else {
        console.error('Failed to fetch buyers:', buyersResult.reason);
        errors.push(buyersResult.reason?.message || 'Failed to load buyers.');
      }

      if (suppliersResult.status === 'fulfilled') {
        const resolved = Array.isArray(suppliersResult.value)
          ? suppliersResult.value
          : (suppliersResult.value as any)?.suppliers || (suppliersResult.value as any)?.data || [];
        setSuppliers(resolved);
        setSuppliersHasMore(resolved.length === PAGE_SIZE);
      } else {
        console.error('Failed to fetch suppliers:', suppliersResult.reason);
        errors.push(suppliersResult.reason?.message || 'Failed to load suppliers.');
      }

      if (errors.length > 0) setError(errors.join(' '));
      setLoading(false);
    })();
  }, []);

  // Infinite Scroll fetch function
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || sectionLoading) return;

    if (activeTab === 'buyers') {
      if (!buyersHasMore) return;
      setLoadingMore(true);
      const nextIndex = buyerIndex + 1;
      try {
        const data = await getAllBuyers({ index: nextIndex, limit: PAGE_SIZE });
        const resolved = Array.isArray(data) ? data : (data as any)?.buyers || (data as any)?.data || [];
        if (resolved.length > 0) {
          setBuyers((prev) => {
            const existingIds = new Set(prev.map((item) => item.organizationId || (item as any).id));
            const newItems = resolved.filter((item: any) => !existingIds.has(item.organizationId || item.id));
            return [...prev, ...newItems];
          });
          setBuyerIndex(nextIndex);
        }
        setBuyersHasMore(resolved.length === PAGE_SIZE);
      } catch (err: any) {
        console.error('Failed to load more buyers:', err);
      } finally {
        setLoadingMore(false);
      }
    } else {
      if (!suppliersHasMore) return;
      setLoadingMore(true);
      const nextIndex = supplierIndex + 1;
      try {
        const data = await getAllSuppliers({ index: nextIndex, limit: PAGE_SIZE });
        const resolved = Array.isArray(data) ? data : (data as any)?.suppliers || (data as any)?.data || [];
        if (resolved.length > 0) {
          setSuppliers((prev) => {
            const existingIds = new Set(prev.map((item) => item.organizationId || (item as any).id));
            const newItems = resolved.filter((item: any) => !existingIds.has(item.organizationId || item.id));
            return [...prev, ...newItems];
          });
          setSupplierIndex(nextIndex);
        }
        setSuppliersHasMore(resolved.length === PAGE_SIZE);
      } catch (err: any) {
        console.error('Failed to load more suppliers:', err);
      } finally {
        setLoadingMore(false);
      }
    }
  }, [activeTab, buyerIndex, supplierIndex, buyersHasMore, suppliersHasMore, loadingMore, loading, sectionLoading]);

  // Window scroll event listener for Infinite Scroll
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300) {
        loadMore();
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [loadMore]);

  const handleSettingsClick = () => {
    navigate('../settings');
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logoutPlatformUser();
    } catch (err) {
      console.error('Logout request failed:', err);
    } finally {
      sessionStorage.clear();
      window.dispatchEvent(new CustomEvent('session:expired'));
      setLoggingOut(false);
    }
  };

  const getCompanyInitials = (name: string) => {
    if (!name || name === 'Unnamed Business') return 'UB';
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const getRecordProfile = (item: PlatformRecordDto) => {
    const profile = item.businessProfile || ({} as BusinessProfileDto);
    const raw = item as any;

    const organizationName = profile.organizationName || raw.organizationName || raw.name || 'Unnamed Business';
    const email = profile.email || raw.email || 'No email provided';
    const phone = profile.phone || raw.phone || 'No phone number';
    const country = profile.country || raw.country || '';
    const city = profile.city || raw.city || '';
    const state = profile.state || raw.state || '';
    const industry = profile.industry || raw.industry || '';
    const businessType = profile.businessType || raw.businessType || '';
    const website = profile.website || raw.website || '';
    const description = profile.description || raw.description || '';
    const orgId = item.organizationId || raw.organizationId || item.id || raw.id || '';

    const locationParts = [city, state, country].filter(Boolean);
    const location = locationParts.join(', ') || 'No address specified';
    const initials = getCompanyInitials(organizationName);

    return {
      orgId,
      organizationName,
      email,
      phone,
      country,
      city,
      state,
      location,
      industry,
      businessType,
      website,
      description,
      initials,
    };
  };

  const filterList = (list: PlatformRecordDto[]) => {
    return list.filter((item) => {
      const rec = getRecordProfile(item);
      const query = searchQuery.toLowerCase();

      return (
        rec.organizationName.toLowerCase().includes(query) ||
        rec.email.toLowerCase().includes(query) ||
        rec.industry.toLowerCase().includes(query) ||
        rec.businessType.toLowerCase().includes(query) ||
        rec.country.toLowerCase().includes(query) ||
        rec.city.toLowerCase().includes(query) ||
        rec.orgId.toLowerCase().includes(query)
      );
    });
  };

  const filteredList = activeTab === 'buyers' ? filterList(buyers) : filterList(suppliers);

  const selectTab = (tab: PlatformEntityType) => {
    setActiveTab(tab);
    setSelectedDetail(null);
  };

  const navItems: AppNavItem[] = [
    { key: 'buyers', label: 'Buyers', icon: <FaUser /> },
    { key: 'suppliers', label: 'Suppliers', icon: <FaBuilding /> },
  ];

  const userMenuItems: AppUserMenuItem[] = [
    { key: 'settings', label: 'Settings & Preferences', icon: <FaCog />, onSelect: handleSettingsClick },
    {
      key: 'logout',
      label: loggingOut ? 'Logging out...' : 'Log Out',
      icon: <FaSignOutAlt />,
      onSelect: handleLogout,
      tone: 'danger',
      dividerBefore: true,
    },
  ];

  return (
    <AppShell



      onLogoClick={() => selectTab('buyers')}
      navItems={navItems}
      activeNav={activeTab}
      onNavClick={(key) => selectTab(key as PlatformEntityType)}
      userFallbackName="Platform Administrator"
      userFallbackEmail="admin@sila-platform.com"
      userMenuItems={userMenuItems}
    >
      {!selectedDetail ? (
        <>
          <PageHeader
            title="Platform Administrator Dashboard"
            description={`Monitor & manage registered ${activeTab === 'buyers' ? 'buyers' : 'suppliers'} on SILA Platform`}
          />
          <div className="plat-main-content">

            {/* CONTROLS BAR: SEARCH, TABS & VIEW TOGGLE */}
            <div className="plat-controls-card">
              <div className="plat-search-bar">
                <FaSearch className="plat-search-lens" aria-hidden="true" />
                <input
                  type="search"
                  placeholder={`Search ${activeTab} by name, email, industry, or location...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="plat-search-field sila-input"
                  aria-label={`Search ${activeTab}`}
                />
                {searchQuery && (
                  <button
                    type="button"
                    className="plat-search-clear"
                    onClick={() => setSearchQuery('')}
                    aria-label="Clear search"
                    title="Clear search"
                  >
                    <FaTimes aria-hidden="true" />
                  </button>
                )}
              </div>

              <div className="plat-controls-right">
                {/* Entity Type Toggle Tabs */}
                <div className="plat-segmented-tabs" role="tablist" aria-label="Organisation type">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'buyers'}
                    className={`plat-seg-tab ${activeTab === 'buyers' ? 'active-buyer-tab' : ''}`}
                    onClick={() => setActiveTab('buyers')}
                  >
                    <FaUser className="plat-seg-icon" aria-hidden="true" /> Buyers
                    <span className="plat-seg-count">{buyers.length}</span>
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={activeTab === 'suppliers'}
                    className={`plat-seg-tab ${activeTab === 'suppliers' ? 'active-supplier-tab' : ''}`}
                    onClick={() => setActiveTab('suppliers')}
                  >
                    <FaBuilding className="plat-seg-icon" aria-hidden="true" /> Suppliers
                    <span className="plat-seg-count">{suppliers.length}</span>
                  </button>
                </div>

                {/* Grid / Table View Mode Switcher */}
                <div className="plat-view-switcher" role="group" aria-label="View mode">
                  <button
                    type="button"
                    className={`plat-view-btn ${viewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setViewMode('grid')}
                    title="Grid Card View"
                    aria-label="Grid Card View"
                    aria-pressed={viewMode === 'grid'}
                  >
                    <FaThLarge aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className={`plat-view-btn ${viewMode === 'table' ? 'active' : ''}`}
                    onClick={() => setViewMode('table')}
                    title="Table View"
                    aria-label="Table View"
                    aria-pressed={viewMode === 'table'}
                  >
                    <FaList aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>

            {/* ERROR BANNER */}
            {error && (
              <div className="plat-error-alert sila-alert sila-alert--danger" role="alert">
                <FaExclamationCircle className="plat-error-icon" aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* CONTENT SECTION */}
            {loading ? (
              <div className="plat-loading-wrapper" role="status" aria-live="polite">
                <span className="sila-spinner sila-spinner--lg plat-spinner" aria-hidden="true"></span>
                <span className="plat-loading-text">Loading platform registry data...</span>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="plat-empty-card">
                <EmptyState
                  icon={activeTab === 'buyers' ? <FaUser aria-hidden="true" /> : <FaBuilding aria-hidden="true" />}
                  title={`No ${activeTab} found`}
                  description={
                    searchQuery
                      ? `No matching ${activeTab} found for "${searchQuery}".`
                      : `There are currently no registered ${activeTab} on this page.`
                  }
                />
              </div>
            ) : viewMode === 'grid' ? (
              /* GRID CARD VIEW */
              <div
                className={`plat-grid-container ${sectionLoading ? 'plat-grid-loading' : ''}`}
                aria-busy={sectionLoading}
              >
                {filteredList.map((item) => {
                  const rec = getRecordProfile(item);
                  const openDetail = () => setSelectedDetail({ type: activeTab, record: item });

                  return (
                    <div
                      key={rec.orgId || Math.random()}
                      className={`plat-v2-card ${activeTab}`}
                      onClick={openDetail}
                      onKeyDown={(e) => {
                        if (e.target !== e.currentTarget) return;
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          openDetail();
                        }
                      }}
                      role="button"
                      tabIndex={0}
                      aria-label={`View details for ${rec.organizationName}`}
                    >
                      <div className="plat-v2-card-header">
                        <div className={`plat-v2-avatar ${activeTab}-avatar`} aria-hidden="true">{rec.initials}</div>
                        <div className="plat-v2-header-meta">
                          <div className="plat-v2-title-row">
                            <h3 className="plat-v2-card-title" title={rec.organizationName}>{rec.organizationName}</h3>
                            <StatusBadge status="Active" size="sm" className="plat-v2-status-chip" />
                          </div>
                          <div className="plat-v2-badge-group">
                            {rec.businessType && <span className="plat-v2-pill plat-v2-pill-type">{rec.businessType}</span>}
                            {rec.industry && <span className="plat-v2-pill plat-v2-pill-industry">{rec.industry}</span>}
                          </div>
                        </div>
                      </div>

                      {rec.description && (
                        <p className="plat-v2-desc" title={rec.description}>
                          {rec.description}
                        </p>
                      )}

                      <div className="plat-v2-contact-grid">
                        <div className="plat-v2-contact-item">
                          <FaEnvelope className="plat-v2-contact-icon" aria-hidden="true" />
                          <span className="plat-v2-contact-val" title={rec.email}>
                            {rec.email}
                          </span>
                        </div>
                        <div className="plat-v2-contact-item">
                          <FaPhone className="plat-v2-contact-icon" aria-hidden="true" />
                          <span className="plat-v2-contact-val">{rec.phone}</span>
                        </div>
                        <div className="plat-v2-contact-item">
                          <FaMapMarkerAlt className="plat-v2-contact-icon" aria-hidden="true" />
                          <span className="plat-v2-contact-val" title={rec.location}>
                            {rec.location}
                          </span>
                        </div>
                        {rec.website && (
                          <div className="plat-v2-contact-item">
                            <FaGlobe className="plat-v2-contact-icon" aria-hidden="true" />
                            <a
                              href={rec.website.startsWith('http://') || rec.website.startsWith('https://')? 
                                    rec.website : `https://${rec.website.replace(/^https?:?\/\//, '')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="plat-v2-link"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="plat-v2-link-text">{rec.website}</span>
                              <FaExternalLinkAlt className="plat-v2-link-icon" aria-hidden="true" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* TABLE VIEW */
              <div
                className={`plat-table-container sila-table-wrap ${sectionLoading ? 'plat-grid-loading' : ''}`}
                aria-busy={sectionLoading}
              >
                <table className="plat-data-table sila-table">
                  <thead>
                    <tr>
                      <th scope="col">Organization</th>
                      <th scope="col">Business Type</th>
                      <th scope="col">Industry</th>
                      <th scope="col">Contact Info</th>
                      <th scope="col">Location</th>
                      <th scope="col" className="sila-cell-actions">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredList.map((item) => {
                      const rec = getRecordProfile(item);

                      return (
                        <tr key={rec.orgId || Math.random()}>
                          <td>
                            <div className="plat-tbl-org">
                              <div className={`plat-tbl-avatar ${activeTab}-avatar`} aria-hidden="true">{rec.initials}</div>
                              <div className="plat-tbl-org-text">
                                <div className="plat-tbl-org-name">{rec.organizationName}</div>
                                <div className="plat-tbl-org-id">
                                  ID: <span className="sila-ref">#{rec.orgId}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="plat-v2-pill plat-v2-pill-type">{rec.businessType || 'N/A'}</span>
                          </td>
                          <td>
                            <span className="plat-v2-pill plat-v2-pill-industry">{rec.industry || 'N/A'}</span>
                          </td>
                          <td>
                            <div className="plat-tbl-contact">
                              <div>{rec.email}</div>
                              <div className="plat-tbl-phone">{rec.phone}</div>
                            </div>
                          </td>
                          <td className="plat-tbl-location">{rec.location || 'N/A'}</td>
                          <td className="sila-cell-actions">
                            <button
                              type="button"
                              className="plat-v2-action-btn sila-btn sila-btn--secondary sila-btn--sm"
                              onClick={() => setSelectedDetail({ type: activeTab, record: item })}
                              aria-label={`View details for ${rec.organizationName}`}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* INFINITE SCROLL LOADING INDICATOR */}
            {loadingMore && (
              <div className="plat-loading-more" role="status" aria-live="polite">
                <span className="sila-spinner plat-spinner" aria-hidden="true"></span>
                <span className="plat-loading-more-text">Loading more {activeTab}...</span>
              </div>
            )}
          </div>
        </>
      ) : (
        <PlatformUserDetailView
          type={selectedDetail.type}
          record={selectedDetail.record}
          onBack={() => setSelectedDetail(null)}
          onStatusUpdated={() => {
            if (activeTab === 'buyers') loadBuyers(buyerIndex);
            else loadSuppliers(supplierIndex);
          }}
          onSettingsClick={handleSettingsClick}
        />
      )}
    </AppShell>
  );
};

export default PlatformUserDashboard;