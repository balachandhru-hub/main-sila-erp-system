import React, { useEffect, useState } from 'react';
import {
  FaArrowLeft,
  FaBuilding,
  FaEnvelope,
  FaPhone,
  FaMapMarkerAlt,
  FaFileContract,
  FaUniversity,
  FaTruck,
  FaThLarge,
  FaInfoCircle,
  FaChevronUp,
  FaChevronDown,
  FaCheck,
  FaTimes,
  FaFilePdf,
  FaEye,
  FaEyeSlash,
  FaUsers,
  FaMoneyBillWave,
  FaCalendarAlt,
  FaIndustry,
  FaBriefcase,
  FaTags,
  FaUserCircle,
  FaChevronRight,
} from 'react-icons/fa';
import type {
  CompanyProfileData,
  CategoryDto,
  RegistrationDto,
  BankAccountDto,
  DispatchLocationDto,
} from './CompanyProfile.types';
import { EmptyState } from '../EmptyState';
import { Loader } from '../Loader';
import { StatusBadge, type StatusTone } from '../StatusBadge';
import './CompanyProfile.css';

interface CompanyProfileProps {
  mode?: 'admin-review' | 'network-admin';
  showHeader?: boolean;
  entityLabel: 'Buyer' | 'Supplier';
  fetchProfile: () => Promise<CompanyProfileData | null>;
  onBack?: () => void;
  onVerify?: () => void;
  onReject?: () => void;
  isStatusLoading?: boolean;
  statusError?: string | null;
  onViewDocument?: (assetId: string, fileName?: string) => void;
}

const formatCurrency = (amount?: number, currency?: string) => {
  if (amount === undefined || amount === null) return '-';
  const symbol = currency === 'INR' ? '₹' : currency ? `${currency} ` : '';
  return `${symbol}${amount.toLocaleString('en-IN')}`;
};

const formatDate = (dateString?: string | null) => {
  if (!dateString) return '-';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const statusClassMap: Record<string, string> = {
  PENDING_VERIFICATION: 'cp-status-pending',
  PENDING: 'cp-status-pending',
  VERIFIED: 'cp-status-verified',
  APPROVED: 'cp-status-verified',
  REJECTED: 'cp-status-rejected',
};

const statusLabelMap: Record<string, string> = {
  PENDING_VERIFICATION: 'Pending Verification',
  PENDING: 'Pending Verification',
  VERIFIED: 'Verified',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

/* Badge tone for each status class above (unknown statuses fall back to "pending"). */
const statusToneMap: Record<string, StatusTone> = {
  'cp-status-pending': 'warning',
  'cp-status-verified': 'success',
  'cp-status-rejected': 'danger',
};

const YesNoBadge: React.FC<{ value?: boolean }> = ({ value }) => (
  <span className={`sila-badge sila-badge--sm cp-status-pill ${value ? 'sila-badge--success' : 'sila-badge--neutral'}`}>
    {value ? 'Yes' : 'No'}
  </span>
);

const SectionHeader: React.FC<{
  icon: React.ReactNode;
  title: string;
  isOpen: boolean;
  onToggle: () => void;
  extra?: React.ReactNode;
}> = ({ icon, title, isOpen, onToggle, extra }) => (
  <button type="button" className="cp-card-title" onClick={onToggle} aria-expanded={isOpen}>
    <span className="cp-card-icon" aria-hidden="true">{icon}</span>
    <span className="cp-card-title-text">{title}</span>
    {extra}
    <span className="cp-card-chevron" aria-hidden="true">{isOpen ? <FaChevronUp /> : <FaChevronDown />}</span>
  </button>
);

const MaskedAccountNumber: React.FC<{ accountNumber?: string }> = ({ accountNumber }) => {
  const [revealed, setRevealed] = useState(false);
  if (!accountNumber) return <span className="cp-field-value">-</span>;
  const masked =
    accountNumber.length >= 4
      ? '********' + accountNumber.slice(-4)
      : accountNumber;
  return (
    <span className="cp-field-value cp-field-masked">
      <span className="cp-field-mono">{revealed ? accountNumber : masked}</span>
      <button
        type="button"
        className="cp-icon-toggle"
        onClick={() => setRevealed((v) => !v)}
        aria-label={revealed ? 'Hide account number' : 'Show account number'}
        aria-pressed={revealed}
        title={revealed ? 'Hide' : 'Show'}
      >
        {revealed ? <FaEyeSlash aria-hidden="true" /> : <FaEye aria-hidden="true" />}
      </button>
    </span>
  );
};

const CompanyProfile: React.FC<CompanyProfileProps> = ({
  mode = 'admin-review',
  showHeader = true,
  entityLabel,
  fetchProfile,
  onBack,
  onVerify,
  onReject,
  isStatusLoading = false,
  statusError = null,
  onViewDocument,
}) => {
  const [profile, setProfile] = useState<CompanyProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [openSections, setOpenSections] = useState({
    profile: true,
    registrations: true,
    bank: true,
    dispatch: true,
    categories: true,
  });

  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchProfile();
        if (!cancelled) setProfile(data);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load company profile');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchProfile]);

  if (isLoading) {
    return (
      <div className="cp-loading-container">
        <Loader message="Loading company profile..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="cp-error-container">
        <EmptyState variant="error" icon={<FaInfoCircle className="cp-error-icon" aria-hidden="true" />} title={error} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="cp-empty-container">
        <EmptyState icon={<FaBuilding className="cp-empty-icon" aria-hidden="true" />} title="No company profile found." />
      </div>
    );
  }

  const bp = profile.businessProfile || {};
  const registrations: RegistrationDto[] = profile.registrations || [];
  const bankAccounts: BankAccountDto[] = profile.bankAccounts || [];
  const dispatchLocations: DispatchLocationDto[] = profile.dispatchLocations || [];
  const categories: CategoryDto[] =
    (profile as any).categories ||
    (profile as any).buyerCategories ||
    (profile as any).supplierCategories ||
    [];

  const statusKey = bp.status || '';
  const statusUpper = statusKey.toUpperCase();
  const isPending = statusUpper === 'PENDING_VERIFICATION' || statusUpper === 'PENDING' || statusUpper === '' || statusUpper === 'PENDING_REVIEW';
  const statusClass = statusClassMap[statusKey] || statusClassMap[statusUpper] || 'cp-status-pending';
  const statusLabel = statusLabelMap[statusKey] || statusLabelMap[statusUpper] || statusKey || '-';
  const statusTone = statusToneMap[statusClass] || 'warning';

  const statusBadge = (
    <StatusBadge status={statusKey || 'PENDING'} label={statusLabel} tone={statusTone} dot />
  );

  return (
    <div className="cp-page">
      {showHeader && (
        <div className="sila-page-header cp-page-header">
          <div className="sila-page-header-main cp-page-header-left">
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                title="Back to Dashboard"
                aria-label="Back to Dashboard"
                className="sila-btn sila-btn--secondary sila-btn--icon sila-btn--sm sila-page-back cp-back-btn"
              >
                <FaArrowLeft className="cp-back-btn-icon" aria-hidden="true" />
              </button>
            )}
            <div>
              <h1 className="sila-page-title cp-page-title">Company Details</h1>
              <p className="sila-page-description cp-page-subtitle">View and manage {entityLabel.toLowerCase()} information</p>
            </div>
          </div>
        </div>
      )}

      {statusError && (
        <div className="sila-alert sila-alert--danger cp-status-error-banner" role="alert">
          <FaInfoCircle className="cp-alert-icon" aria-hidden="true" />
          <span>{statusError}</span>
        </div>
      )}

      <div className="cp-container">
        <div className="cp-header-card">
          {onBack && !showHeader && (
            <div className="cp-back-btn-wrapper">
              <button
                type="button"
                onClick={onBack}
                title="Back to Dashboard"
                className="sila-btn sila-btn--ghost sila-btn--sm cp-back-btn cp-back-btn-sm"
              >
                <FaArrowLeft className="cp-back-btn-icon" aria-hidden="true" /> Back
              </button>
            </div>
          )}
          <div className="cp-header-top">
            <div className="cp-header-left">
              <div className="cp-org-icon" aria-hidden="true">
                <FaBuilding />
              </div>
              <div className="cp-org-info">
                <h2 className="cp-org-name">{bp.organizationName || '-'}</h2>
                <div className="cp-org-contact">
                  {bp.email && (
                    <span className="cp-contact-item">
                      <FaEnvelope aria-hidden="true" />
                      {bp.email}
                    </span>
                  )}
                  {bp.phone && (
                    <span className="cp-contact-item">
                      <FaPhone aria-hidden="true" />
                      +91 {bp.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {mode === 'admin-review' && isPending && (
              <div className="cp-header-actions">
                {onVerify && (
                  <button
                    type="button"
                    className="sila-btn sila-btn--success cp-btn-verify"
                    title="Verify this company"
                    onClick={onVerify}
                    disabled={isStatusLoading}
                  >
                    <FaCheck aria-hidden="true" />
                    Verify
                  </button>
                )}
                {onReject && (
                  <button
                    type="button"
                    className="sila-btn sila-btn--secondary cp-btn-reject-action"
                    title="Reject this company"
                    onClick={onReject}
                    disabled={isStatusLoading}
                  >
                    <FaTimes aria-hidden="true" />
                    Reject
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="cp-org-badges">
            {statusBadge}
            {bp.businessType && <span className="sila-badge sila-badge--neutral">{bp.businessType}</span>}
            {bp.industry && <span className="sila-badge sila-badge--neutral">{bp.industry}</span>}
          </div>
        </div>

        <div className="cp-body">
          <div className="cp-main-col">
            <section className="cp-card">
              <SectionHeader
                icon={<FaBuilding />}
                title="1. Business Profile"
                isOpen={openSections.profile}
                onToggle={() => toggleSection('profile')}
              />
              {openSections.profile && (
                <div className="cp-section-box">
                  <div className="cp-grid cp-grid-profile">
                    <div className="cp-grid-column">
                      <div className="cp-field">
                        <span className="cp-field-label">Organization Name</span>
                        <span className="cp-field-value">{bp.organizationName || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Email</span>
                        <span className="cp-field-value cp-field-link">{bp.email || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Phone</span>
                        <span className="cp-field-value">{bp.phone ? `+91 ${bp.phone}` : '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Website</span>
                        {bp.website ? (
                          <a
                            href={bp.website}
                            target="_blank"
                            rel="noreferrer"
                            className="cp-field-value cp-field-link"
                          >
                            {bp.website}
                          </a>
                        ) : (
                          <span className="cp-field-value">-</span>
                        )}
                      </div>
                    </div>

                    <div className="cp-grid-column cp-address-box">
                      <div className="cp-field">
                        <span className="cp-field-label">Industry</span>
                        <span className="cp-field-value">{bp.industry || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Business Type</span>
                        <span className="cp-field-value">{bp.businessType || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Employee Count</span>
                        <span className="cp-field-value">{bp.employeeCount ?? '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Annual Turnover</span>
                        <span className="cp-field-value">{formatCurrency(bp.annualTurnover, bp.currency)}</span>
                      </div>
                    </div>

                    <div className="cp-grid-column cp-address-box">
                      <div className="cp-field">
                        <span className="cp-field-label">Year Established</span>
                        <span className="cp-field-value">{bp.yearEstablished ?? '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Currency</span>
                        <span className="cp-field-value">{bp.currency || '-'}</span>
                      </div>
                      <div className="cp-field">
                        <span className="cp-field-label">Description</span>
                        <span className="cp-field-value">{bp.description || '-'}</span>
                      </div>
                    </div>

                    <div className="cp-grid-column cp-address-box">
                      <span className="cp-field-label cp-field-label-icon">
                        <FaMapMarkerAlt aria-hidden="true" />
                        Address
                      </span>
                      <span className="cp-field-value">
                        {bp.addressLine1 || '-'}
                        <br />
                        {bp.city || '-'}, {bp.state || '-'}
                        <br />
                        {bp.pinCode || '-'}, {bp.country || '-'}
                      </span>
                      <div className="cp-sub-grid">
                        <div className="cp-field">
                          <span className="cp-field-label">Country</span>
                          <span className="cp-field-value">{bp.country || '-'}</span>
                        </div>
                        <div className="cp-field">
                          <span className="cp-field-label">State</span>
                          <span className="cp-field-value">{bp.state || '-'}</span>
                        </div>
                        <div className="cp-field">
                          <span className="cp-field-label">City</span>
                          <span className="cp-field-value">{bp.city || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <section className="cp-card">
              <SectionHeader
                icon={<FaFileContract />}
                title="2. Business Registrations"
                isOpen={openSections.registrations}
                onToggle={() => toggleSection('registrations')}
              />
              {openSections.registrations && (
                <div className="cp-section-box">
                  {registrations.length === 0 ? (
                    <p className="cp-empty-inline">No registrations added</p>
                  ) : (
                    <div className="sila-table-wrap cp-table-wrapper">
                      <table className="sila-table cp-table">
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Number</th>
                            <th>Name</th>
                            <th>Expiry Date</th>
                            <th>Document</th>
                          </tr>
                        </thead>
                        <tbody>
                          {registrations.map((reg, idx) => (
                            <tr key={idx}>
                              <td className="sila-cell-strong">{reg.registrationType || '-'}</td>
                              <td><span className="sila-ref">{reg.registrationNumber || '-'}</span></td>
                              <td>{reg.registrationName || '-'}</td>
                              <td className="cp-cell-nowrap">{formatDate(reg.expiryDate)}</td>
                              <td>
                                {reg.asset?.fileName || (reg.asset as any)?.id ? (
                                  <div className="sila-file cp-doc-link-wrapper">
                                    <span className="sila-file-icon cp-doc-file-icon" aria-hidden="true">
                                      <FaFilePdf className="cp-pdf-icon" />
                                    </span>
                                    <span className="sila-file-name cp-doc-link" title={reg.asset?.fileName}>
                                      {reg.asset?.fileName || 'Document'}
                                    </span>
                                    <button
                                      type="button"
                                      className={`sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm cp-doc-actions ${onViewDocument ? 'cp-doc-actions-clickable' : 'cp-doc-actions-default'}`}
                                      onClick={() => {
                                        const assetId = reg.asset?.id || (reg.asset as any)?.id;
                                        if (assetId && onViewDocument) {
                                          onViewDocument(assetId, reg.asset?.fileName);
                                        }
                                      }}
                                      title="View Document"
                                      aria-label={`View document ${reg.asset?.fileName || ''}`.trim()}
                                    >
                                      <FaEye className="cp-eye-icon" aria-hidden="true" />
                                    </button>
                                  </div>
                                ) : (
                                  <span className="sila-cell-muted">-</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="cp-card">
              <div className="cp-card-header-flex">
                <SectionHeader
                  icon={<FaUniversity />}
                  title="3. Bank Accounts"
                  isOpen={openSections.bank}
                  onToggle={() => toggleSection('bank')}
                  extra={
                    bankAccounts.some((a) => a.isPrimary) ? (
                      <span className="sila-badge sila-badge--sm sila-badge--success cp-pill">
                        <FaCheck aria-hidden="true" /> Primary Account
                      </span>
                    ) : undefined
                  }
                />
              </div>
              {openSections.bank && (
                <div className="cp-section-box">
                  {bankAccounts.length === 0 ? (
                    <p className="cp-empty-inline">No bank accounts added</p>
                  ) : (
                    bankAccounts.map((acc, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <div className="cp-divider" />}
                        <div className="cp-grid cp-grid-3">
                          <div className="cp-field">
                            <span className="cp-field-label">Account Holder Name</span>
                            <span className="cp-field-value">{acc.accountHolderName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Account Number</span>
                            <MaskedAccountNumber accountNumber={acc.accountNumber} />
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Currency</span>
                            <span className="cp-field-value">{acc.currency || '-'}</span>
                          </div>

                          <div className="cp-field">
                            <span className="cp-field-label">Bank Name</span>
                            <span className="cp-field-value">{acc.bankName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">IFSC Code</span>
                            <span className="cp-field-value cp-field-mono">{acc.ifscCode || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Primary Account</span>
                            <YesNoBadge value={acc.isPrimary} />
                          </div>

                          <div className="cp-field">
                            <span className="cp-field-label">Branch Name</span>
                            <span className="cp-field-value">{acc.branchName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">SWIFT Code</span>
                            <span className="cp-field-value cp-field-mono">{acc.swiftCode || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Verified</span>
                            <YesNoBadge value={acc.isVerified} />
                          </div>
                        </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="cp-card">
              <SectionHeader
                icon={<FaTruck />}
                title="4. Dispatch Locations"
                isOpen={openSections.dispatch}
                onToggle={() => toggleSection('dispatch')}
              />
              {openSections.dispatch && (
                <div className="cp-section-box">
                  {dispatchLocations.length === 0 ? (
                    <p className="cp-empty-inline">No dispatch locations added</p>
                  ) : (
                    dispatchLocations.map((loc, idx) => (
                      <React.Fragment key={idx}>
                        {idx > 0 && <div className="cp-divider" />}
                        <div className="cp-grid cp-grid-3">
                          <div className="cp-field">
                            <span className="cp-field-label">Location Name</span>
                            <span className="cp-field-value">{loc.locationName || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Address</span>
                            <span className="cp-field-value">
                              {loc.addressLine1 || '-'}
                              <br />
                              {loc.city && <>{loc.city}, </>}
                              {loc.state && <>{loc.state} - </>}
                              {loc.country}
                            </span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Default Location</span>
                            <YesNoBadge value={loc.isDefault} />
                          </div>

                          <div className="cp-field">
                            <span className="cp-field-label">Contact Person</span>
                            <span className="cp-field-value">{loc.contactPerson || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Contact Email</span>
                            <span className="cp-field-value">{loc.contactEmail || '-'}</span>
                          </div>
                          <div className="cp-field">
                            <span className="cp-field-label">Contact Phone</span>
                            <span className="cp-field-value">
                              {loc.contactPhone ? `+91 ${loc.contactPhone}` : '-'}
                            </span>
                          </div>
                          <div className="cp-field"></div>
                          <div className="cp-field"></div>
                        </div>
                      </React.Fragment>
                    ))
                  )}
                </div>
              )}
            </section>

            <section className="cp-card">
              <SectionHeader
                icon={<FaThLarge />}
                title="5. Product Categories"
                isOpen={openSections.categories}
                onToggle={() => toggleSection('categories')}
              />
              {openSections.categories && (
                <div className="cp-section-box">
                  {categories.length === 0 ? (
                    <p className="cp-empty-inline">No categories added</p>
                  ) : (
                    categories.map((cat, idx) => (
                      <div className="cp-category-chain" key={idx}>
                        <div className="cp-category-step">
                          <span className="cp-category-label cp-category-label-segment">Segment</span>
                          <span className="cp-field-value cp-field-mono">{cat.segment ?? '-'}</span>
                          <span className="cp-category-sub">{cat.segmentTitle || '-'}</span>
                        </div>
                        <span className="cp-category-arrow" aria-hidden="true"><FaChevronRight /></span>
                        <div className="cp-category-step">
                          <span className="cp-category-label cp-category-label-family">Family</span>
                          <span className="cp-field-value cp-field-mono">{cat.family ?? '-'}</span>
                          <span className="cp-category-sub">{cat.familyTitle || '-'}</span>
                        </div>
                        <span className="cp-category-arrow" aria-hidden="true"><FaChevronRight /></span>
                        <div className="cp-category-step">
                          <span className="cp-category-label cp-category-label-class">Class</span>
                          <span className="cp-field-value cp-field-mono">{cat.class ?? '-'}</span>
                          <span className="cp-category-sub">{cat.classTitle || '-'}</span>
                        </div>
                        <span className="cp-category-arrow" aria-hidden="true"><FaChevronRight /></span>
                        <div className="cp-category-step">
                          <span className="cp-category-label cp-category-label-commodity">Commodity</span>
                          <span className="cp-field-value cp-field-mono">{cat.commodity ?? '-'}</span>
                          <span className="cp-category-sub">{cat.commodityTitle || '-'}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="cp-side-col">
            <div className="cp-card cp-summary-card">
              <div className="cp-card-title cp-card-title-static">
                <span className="cp-card-icon" aria-hidden="true">
                  <FaInfoCircle />
                </span>
                <h2 className="cp-card-title-text">{entityLabel} Summary</h2>
              </div>

              <div className="cp-summary-content">
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaBuilding className="cp-summary-icon" aria-hidden="true" /> Organization Name
                  </span>
                  <span className="cp-summary-value">{bp.organizationName || '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaInfoCircle className="cp-summary-icon" aria-hidden="true" /> Status
                  </span>
                  <StatusBadge status={statusKey || 'PENDING'} label={statusLabel} tone={statusTone} size="sm" />
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaIndustry className="cp-summary-icon" aria-hidden="true" /> Industry
                  </span>
                  <span className="cp-summary-value">{bp.industry || '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaBriefcase className="cp-summary-icon" aria-hidden="true" /> Business Type
                  </span>
                  <span className="cp-summary-value">{bp.businessType || '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaUsers className="cp-summary-icon" aria-hidden="true" /> Employees
                  </span>
                  <span className="cp-summary-value cp-field-num">{bp.employeeCount ?? '-'}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaMoneyBillWave className="cp-summary-icon" aria-hidden="true" /> Annual Turnover
                  </span>
                  <span className="cp-summary-value cp-field-num">{formatCurrency(bp.annualTurnover, bp.currency)}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaCalendarAlt className="cp-summary-icon" aria-hidden="true" /> Year Established
                  </span>
                  <span className="cp-summary-value cp-field-num">{bp.yearEstablished ?? '-'}</span>
                </div>

                <div className="cp-divider" />

                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaFileContract className="cp-summary-icon" aria-hidden="true" /> Registrations
                  </span>
                  <span className="cp-summary-value cp-field-num">{registrations.length}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaUniversity className="cp-summary-icon" aria-hidden="true" /> Bank Accounts
                  </span>
                  <span className="cp-summary-value cp-field-num">{bankAccounts.length}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaMapMarkerAlt className="cp-summary-icon" aria-hidden="true" /> Dispatch Locations
                  </span>
                  <span className="cp-summary-value cp-field-num">{dispatchLocations.length}</span>
                </div>
                <div className="cp-summary-row">
                  <span className="cp-summary-label">
                    <FaTags className="cp-summary-icon" aria-hidden="true" /> Product Categories
                  </span>
                  <span className="cp-summary-value cp-field-num">{categories.length}</span>
                </div>

                <div className="cp-divider" />

                <div className="cp-summary-row cp-summary-row-stacked">
                  <span className="cp-summary-label">
                    <FaUserCircle className="cp-summary-icon" aria-hidden="true" /> Created By
                  </span>
                  <span className="cp-summary-value cp-summary-value-link">{bp.email || '-'}</span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default CompanyProfile;