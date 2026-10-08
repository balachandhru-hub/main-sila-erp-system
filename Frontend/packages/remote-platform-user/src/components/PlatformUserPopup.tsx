import React, { useEffect, useState } from 'react';
import {
  downloadBuyerAsset,
  downloadSupplierAsset,
  updateBuyerStatus,
  updateSupplierStatus,
  updateBuyerInternalStatus,
  updateSupplierInternalStatus,
} from '../api/platformApi';
import type {
  BusinessProfileDto,
  RegistrationDto,
  BankAccountDto,
  DispatchLocationDto,
  CategoryDto,
  PlatformEntityType,
  PlatformRecordDto,
} from '../dto/platformDto';
import {
  FaTimes,
  FaBuilding,
  FaMapMarkerAlt,
  FaFileAlt,
  FaUniversity,
  FaWarehouse,
  FaCheckCircle,
  FaEye,
  FaDownload,
  FaSpinner,
} from 'react-icons/fa';
import { StatusBadge } from '@vosox/shared-ui';
import './PlatformUserPopup.css';

interface PlatformUserPopupProps {
  type: PlatformEntityType;
  record: PlatformRecordDto;
  onClose: () => void;
  onStatusUpdated?: () => void;
}

const formatCurrency = (amount?: number, currency?: string) => {
  if (amount === undefined || amount === null || amount === 0) return 'Not specified';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency || 'INR',
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount} ${currency || ''}`.trim();
  }
};

const formatDate = (dateStr?: string | null) => {
  if (!dateStr) return 'Not specified';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' });
};

const initialsOf = (name?: string) => {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
};

const base64ToBlob = (base64: string, contentType: string): Blob => {
  // Remove data URI prefix if present (e.g., "data:application/pdf;base64,")
  let cleanBase64 = base64;
  if (base64.includes(',')) {
    cleanBase64 = base64.split(',')[1];
  }
  
  try {
    const byteCharacters = atob(cleanBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    
    // Map content type (handle both "pdf" and "application/pdf" formats)
    let mimeType = contentType || 'application/pdf';
    if (mimeType === 'pdf') {
      mimeType = 'application/pdf';
    }
    
    return new Blob([byteArray], { type: mimeType });
  } catch (error) {
    console.error('Error converting base64 to blob:', error);
    throw new Error('Failed to process file data');
  }
};

const DetailRow: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="pup-detail-row">
    <span className="pup-detail-row-label">{label}</span>
    <span className="pup-detail-row-value">{value || value === 0 ? value : 'Not specified'}</span>
  </div>
);

interface AttachmentEntry {
  key: string;
  assetId: string;
  fileName: string;
  registrationName?: string;
  registrationType?: string;
}

export const PlatformUserPopup: React.FC<PlatformUserPopupProps> = ({ type, record, onClose, onStatusUpdated }) => {
  const raw = record as any;
  const profile: BusinessProfileDto = {
    organizationName: record.businessProfile?.organizationName || raw.organizationName || raw.name || 'Unnamed Business',
    email: record.businessProfile?.email || raw.email,
    phone: record.businessProfile?.phone || raw.phone,
    country: record.businessProfile?.country || raw.country,
    city: record.businessProfile?.city || raw.city,
    state: record.businessProfile?.state || raw.state,
    industry: record.businessProfile?.industry || raw.industry,
    businessType: record.businessProfile?.businessType || raw.businessType,
    yearEstablished: record.businessProfile?.yearEstablished || raw.yearEstablished,
    website: record.businessProfile?.website || raw.website,
    description: record.businessProfile?.description || raw.description,
    status: record.businessProfile?.status || raw.status || 'ACTIVE',
    isActive: record.isActive ?? record.businessProfile?.isActive ?? true,
    ...record.businessProfile,
  };
  const registrations: RegistrationDto[] = record.registrations || raw.registrations || [];
  const bankAccounts: BankAccountDto[] = record.bankAccounts || raw.bankAccounts || [];
  const dispatchLocations: DispatchLocationDto[] = record.dispatchLocations || raw.dispatchLocations || [];
  const categories: CategoryDto[] = record.categories || raw.buyerCategories || raw.supplierCategories || [];

  const [actionState, setActionState] = useState<Record<string, 'view' | 'download' | null>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  const [statusLoading, setStatusLoading] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<boolean>(false);
  const [rejectComments, setRejectComments] = useState<string>('');

  const [internalStatus, setInternalStatus] = useState<boolean>(
    record.isActive ?? profile.isActive ?? true
  );
  const [internalStatusLoading, setInternalStatusLoading] = useState<boolean>(false);

  const handleToggleInternalStatus = async () => {
    if (internalStatusLoading) return;
    const nextStatus = !internalStatus;
    setInternalStatusLoading(true);
    setStatusError(null);
    try {
      if (type === 'buyers') {
        await updateBuyerInternalStatus(record.organizationId, nextStatus);
      } else {
        await updateSupplierInternalStatus(record.organizationId, nextStatus);
      }
      setInternalStatus(nextStatus);
      record.isActive = nextStatus;
      if (record.businessProfile) record.businessProfile.isActive = nextStatus;
      onStatusUpdated?.();
    } catch (err: any) {
      console.error('Failed to update internal status:', err);
      setStatusError(err.message || 'Failed to update account active status.');
    } finally {
      setInternalStatusLoading(false);
    }
  };

  const handleApprove = async () => {
    if (statusLoading) return;
    setStatusError(null);
    setStatusLoading(true);
    try {
      if (type === 'buyers') {
        await updateBuyerStatus(record.id, 'APPROVED');
      } else {
        await updateSupplierStatus(record.id, 'APPROVED');
      }
      onStatusUpdated?.();
    } catch (err: any) {
      console.error('Failed to approve:', err);
      setStatusError(err.message || 'Failed to approve registration.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleReject = async () => {
    if (statusLoading) return;
    if (!rejectComments.trim()) {
      setStatusError('Comments are required for rejection.');
      return;
    }
    setStatusError(null);
    setStatusLoading(true);
    try {
      if (type === 'buyers') {
        await updateBuyerStatus(record.id, 'REJECTED', rejectComments);
      } else {
        await updateSupplierStatus(record.id, 'REJECTED', rejectComments);
      }
      setShowRejectModal(false);
      onStatusUpdated?.();
    } catch (err: any) {
      console.error('Failed to reject:', err);
      setStatusError(err.message || 'Failed to reject registration.');
    } finally {
      setStatusLoading(false);
    }
  };

  const name = profile.organizationName || 'Unnamed Business';
  const accentClass = type === 'buyers' ? 'pup-accent-buyer' : 'pup-accent-supplier';
  const currentStatus = (profile.status || '').toUpperCase();
  const isFinalized = currentStatus === 'APPROVED' || currentStatus === 'REJECTED';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const attachments: AttachmentEntry[] = registrations
    .filter((reg) => reg.asset?.id)
    .map((reg, idx) => ({
      key: `${reg.asset!.id}-${idx}`,
      assetId: reg.asset!.id as string,
      fileName: reg.asset?.fileName || reg.asset?.assetName || 'Document',
      registrationName: reg.registrationName,
      registrationType: reg.registrationType,
    }));

  const fetchAsset = async (assetId: string) => {
    return type === 'buyers' ? downloadBuyerAsset(assetId) : downloadSupplierAsset(assetId);
  };

  const handleView = async (entry: AttachmentEntry) => {
    setActionError(null);
    setActionState((prev) => ({ ...prev, [entry.key]: 'view' }));
    try {
      const data = await fetchAsset(entry.assetId);
      
      // Handle the response - fileBytes might be base64 or raw data
      const fileBytes = typeof data === 'string' ? data : data.fileBytes;
      let contentType = data.contentType || 'application/pdf';
      
      // Map content type
      if (contentType === 'pdf') {
        contentType = 'application/pdf';
      }
      
      if (!fileBytes) {
        throw new Error('No file data received from server');
      }
      
      const blob = base64ToBlob(fileBytes, contentType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      
      // Clean up the URL after 60 seconds
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      console.error('Failed to view document:', err);
      setActionError(err.message || 'Failed to open document. Please try again.');
    } finally {
      setActionState((prev) => ({ ...prev, [entry.key]: null }));
    }
  };

  const handleDownload = async (entry: AttachmentEntry) => {
    setActionError(null);
    setActionState((prev) => ({ ...prev, [entry.key]: 'download' }));
    try {
      const data = await fetchAsset(entry.assetId);
      
      // Handle the response - fileBytes might be base64 or raw data
      const fileBytes = typeof data === 'string' ? data : data.fileBytes;
      let contentType = data.contentType || 'application/pdf';
      const fileName = data.fileName || entry.fileName || 'document.pdf';
      
      // Map content type
      if (contentType === 'pdf') {
        contentType = 'application/pdf';
      }
      
      if (!fileBytes) {
        throw new Error('No file data received from server');
      }
      
      const blob = base64ToBlob(fileBytes, contentType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download document:', err);
      setActionError(err.message || 'Failed to download document. Please try again.');
    } finally {
      setActionState((prev) => ({ ...prev, [entry.key]: null }));
    }
  };

  return (
    <div className="pup-overlay" onClick={onClose}>
      <div
        className="pup-panel"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pup-title"
      >
        <button type="button" className="pup-close" onClick={onClose} aria-label="Close details" title="Close">
          <FaTimes aria-hidden="true" />
        </button>

        {/* Header */}
        <div className={`pup-header ${accentClass}`}>
          <div className="pup-avatar" aria-hidden="true">{initialsOf(name)}</div>
          <div className="pup-header-info">
            <h2 className="pup-title" id="pup-title">{name}</h2>
            <div className="pup-header-badges">
              <span className="pup-badge pup-badge-role">
                {type === 'buyers' ? 'Registered Buyer' : 'Registered Supplier'}
              </span>
              {profile.businessType && <span className="pup-badge">{profile.businessType}</span>}
              {profile.industry && <span className="pup-badge">{profile.industry}</span>}
              {profile.status && (
                <StatusBadge
                  status={profile.status}
                  label={profile.status === 'PENDING_VERIFICATION' ? 'PENDING' : profile.status.replace('_', ' ')}
                  className={`pup-badge pup-badge-status-${profile.status.toLowerCase()}`}
                />
              )}
            </div>
          </div>
          <div className="pup-header-toggle-wrapper">
            <span className="pup-toggle-label">
              Status:{' '}
              <strong className={internalStatus ? 'pup-toggle-state pup-toggle-state-on' : 'pup-toggle-state pup-toggle-state-off'}>
                {internalStatus ? 'ON' : 'OFF'}
              </strong>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={internalStatus}
              aria-label="Account active status"
              className={`pup-switch ${internalStatus ? 'pup-switch-on' : 'pup-switch-off'} ${internalStatusLoading ? 'pup-switch-loading' : ''}`}
              onClick={handleToggleInternalStatus}
              disabled={internalStatusLoading}
              title={internalStatus ? 'Click to turn OFF (deactivate)' : 'Click to turn ON (activate)'}
            >
              <span className="pup-switch-thumb">
                {internalStatusLoading && <FaSpinner className="pup-spin pup-spin-xs" aria-hidden="true" />}
              </span>
              <span className="pup-switch-text" aria-hidden="true">{internalStatus ? 'ON' : 'OFF'}</span>
            </button>
          </div>
        </div>

        <div className="pup-body">
          {currentStatus === 'REJECTED' && profile.comments && (
            <div className="pup-rejection-comments-box">
              <strong>Rejection Reason:</strong> {profile.comments}
            </div>
          )}
          {profile.description && <p className="pup-description">{profile.description}</p>}

          {/* Company Overview */}
          <section className="pup-section">
            <h3 className="pup-section-title">
              <FaBuilding className="pup-section-icon" aria-hidden="true" />
              Company Overview
            </h3>
            <div className="pup-grid">
              <DetailRow label="Industry" value={profile.industry} />
              <DetailRow label="Business Type" value={profile.businessType} />
              <DetailRow
                label="Employees"
                value={profile.employeeCount ? profile.employeeCount.toLocaleString('en-IN') : undefined}
              />
              <DetailRow label="Annual Turnover" value={formatCurrency(profile.annualTurnover, profile.currency)} />
              <DetailRow label="Year Established" value={profile.yearEstablished || undefined} />
              <DetailRow
                label="Website"
                value={
                  profile.website ? (
                    <a
                      href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="pup-link"
                    >
                      {profile.website}
                    </a>
                  ) : undefined
                }
              />
            </div>
          </section>

          {/* Product & Service Categories */}
          {categories.length > 0 && (
            <section className="pup-section">
              <h3 className="pup-section-title">
                <FaFileAlt className="pup-section-icon" aria-hidden="true" />
                Product &amp; Service Categories
                <span className="pup-count-badge">{categories.length}</span>
              </h3>
              <div className="pup-subcards">
                {categories.map((cat, idx) => (
                  <div className="pup-subcard" key={idx}>
                    <div className="pup-grid">
                      <DetailRow label="Segment" value={cat.segmentTitle || cat.segment} />
                      <DetailRow label="Family" value={cat.familyTitle || cat.family} />
                      {cat.classTitle && <DetailRow label="Class" value={cat.classTitle} />}
                      {cat.commodityTitle && <DetailRow label="Commodity" value={cat.commodityTitle} />}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Contact & Address */}
          <section className="pup-section">
            <h3 className="pup-section-title">
              <FaMapMarkerAlt className="pup-section-icon" aria-hidden="true" />
              Contact &amp; Registered Address
            </h3>
            <div className="pup-grid">
              <DetailRow label="Email" value={profile.email} />
              <DetailRow label="Phone" value={profile.phone} />
              <DetailRow
                label="Address"
                value={[profile.addressLine1, profile.addressLine2].filter(Boolean).join(', ') || undefined}
              />
              <DetailRow label="City / State" value={[profile.city, profile.state].filter(Boolean).join(', ') || undefined} />
              <DetailRow label="Country" value={profile.country} />
              <DetailRow label="PIN / ZIP Code" value={profile.pinCode} />
            </div>
          </section>

          {/* Registrations */}
          <section className="pup-section">
            <h3 className="pup-section-title">
              <FaFileAlt className="pup-section-icon" aria-hidden="true" />
              Registrations &amp; Compliance
              <span className="pup-count-badge">{registrations.length}</span>
            </h3>
            {registrations.length === 0 ? (
              <p className="pup-empty-note">No registration documents on file.</p>
            ) : (
              <div className="pup-subcards">
                {registrations.map((reg, idx) => {
                  const attachmentKey = `${reg.asset?.id}-${idx}`;
                  const attachment = attachments.find((a) => a.key === attachmentKey);
                  return (
                    <div className="pup-subcard" key={idx}>
                      <div className="pup-grid">
                        <DetailRow label="Registration Name" value={reg.registrationName} />
                        <DetailRow label="Registration Type" value={reg.registrationType} />
                        <DetailRow label="Registration Number" value={reg.registrationNumber} />
                        <DetailRow label="Expiry Date" value={formatDate(reg.expiryDate)} />
                        <DetailRow label="Document File" value={reg.asset?.fileName} />
                      </div>
                      {attachment && (
                        <div className="pup-attachment-actions pup-attachment-actions-inline">
                          <button
                            type="button"
                            className="pup-attachment-btn"
                            onClick={() => handleView(attachment)}
                            disabled={actionState[attachment.key] !== undefined && actionState[attachment.key] !== null}
                          >
                            {actionState[attachment.key] === 'view' ? <FaSpinner className="pup-spin" aria-hidden="true" /> : <FaEye aria-hidden="true" />}
                            View
                          </button>
                          <button
                            type="button"
                            className="pup-attachment-btn pup-attachment-btn-primary"
                            onClick={() => handleDownload(attachment)}
                            disabled={actionState[attachment.key] !== undefined && actionState[attachment.key] !== null}
                          >
                            {actionState[attachment.key] === 'download' ? (
                              <FaSpinner className="pup-spin" aria-hidden="true" />
                            ) : (
                              <FaDownload aria-hidden="true" />
                            )}
                            Download
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            {actionError && <div className="pup-action-error" role="alert">{actionError}</div>}
          </section>

          {/* Bank Accounts */}
          <section className="pup-section">
            <h3 className="pup-section-title">
              <FaUniversity className="pup-section-icon" aria-hidden="true" />
              Bank Accounts
              <span className="pup-count-badge">{bankAccounts.length}</span>
            </h3>
            {bankAccounts.length === 0 ? (
              <p className="pup-empty-note">No bank accounts on file.</p>
            ) : (
              <div className="pup-subcards">
                {bankAccounts.map((acct, idx) => (
                  <div className="pup-subcard" key={idx}>
                    <div className="pup-subcard-top">
                      <span className="pup-subcard-title">{acct.bankName || 'Bank Account'}</span>
                      <div className="pup-subcard-tags">
                        {acct.isPrimary && <span className="pup-badge pup-badge-primary">Primary</span>}
                        {acct.isVerified !== undefined && (
                          <span className={`pup-badge ${acct.isVerified ? 'pup-badge-verified' : 'pup-badge-unverified'}`}>
                            <FaCheckCircle className="pup-badge-icon" aria-hidden="true" />
                            {acct.isVerified ? 'Verified' : 'Unverified'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="pup-grid">
                      <DetailRow label="Account Holder" value={acct.accountHolderName} />
                      <DetailRow label="Branch" value={acct.branchName} />
                      <DetailRow label="Account Number" value={acct.accountNumber} />
                      <DetailRow label="IFSC Code" value={acct.ifscCode} />
                      <DetailRow label="SWIFT Code" value={acct.swiftCode} />
                      {acct.iban && <DetailRow label="IBAN" value={acct.iban} />}
                      <DetailRow label="Currency" value={acct.currency} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dispatch / Delivery Locations */}
          <section className="pup-section">
            <h3 className="pup-section-title">
              <FaWarehouse className="pup-section-icon" aria-hidden="true" />
              {type === 'buyers' ? 'Delivery Locations' : 'Dispatch Locations'}
              <span className="pup-count-badge">{dispatchLocations.length}</span>
            </h3>
            {dispatchLocations.length === 0 ? (
              <p className="pup-empty-note">No locations on file.</p>
            ) : (
              <div className="pup-subcards">
                {dispatchLocations.map((loc, idx) => (
                  <div className="pup-subcard" key={idx}>
                    <div className="pup-subcard-top">
                      <span className="pup-subcard-title">{loc.locationName || 'Location'}</span>
                      {loc.isDefault && <span className="pup-badge pup-badge-primary">Default</span>}
                    </div>
                    <div className="pup-grid">
                      <DetailRow
                        label="Address"
                        value={[loc.addressLine1, loc.addressLine2].filter(Boolean).join(', ') || undefined}
                      />
                      <DetailRow label="City / State" value={[loc.city, loc.state].filter(Boolean).join(', ') || undefined} />
                      <DetailRow label="Country" value={loc.country} />
                      <DetailRow label="PIN / ZIP Code" value={loc.pinCode} />
                      <DetailRow label="Contact Person" value={loc.contactPerson} />
                      <DetailRow label="Contact Phone" value={loc.contactPhone} />
                      {loc.contactEmail && <DetailRow label="Contact Email" value={loc.contactEmail} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Admin Approval Actions */}
          <section className="pup-section pup-section-last pup-admin-actions-section">
            <h3 className="pup-section-title">
              <FaCheckCircle className="pup-section-icon" aria-hidden="true" />
              Platform Administrator Actions
            </h3>
            {statusError && <div className="pup-action-error" role="alert">{statusError}</div>}
            {isFinalized ? (
              <div className="pup-admin-status-display">
                Registration has been finalized. Status: 
                <StatusBadge
                  status={currentStatus}
                  label={currentStatus.replace('_', ' ')}
                  className={`pup-badge pup-badge-status-${currentStatus.toLowerCase()} pup-badge-inline`}
                />
              </div>
            ) : (
              <div className="pup-admin-actions">
                <button
                  type="button"
                  className="pup-btn-approve"
                  onClick={handleApprove}
                  disabled={statusLoading}
                >
                  {statusLoading ? <FaSpinner className="pup-spin" aria-hidden="true" /> : <FaCheckCircle aria-hidden="true" />}
                  Approve Registration
                </button>
                <button
                  type="button"
                  className="pup-btn-reject"
                  onClick={() => {
                    setStatusError(null);
                    setShowRejectModal(true);
                  }}
                  disabled={statusLoading}
                >
                  <FaTimes aria-hidden="true" />
                  Reject Registration
                </button>
              </div>
            )}
          </section>
        </div>
      </div>

      {/* Rejection Comments Modal */}
      {showRejectModal && (
        <div className="pup-reject-overlay" onClick={() => setShowRejectModal(false)}>
          <div
            className="pup-reject-panel"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pup-reject-title"
            aria-describedby="pup-reject-subtitle"
          >
            <button
              type="button"
              className="pup-close"
              onClick={() => setShowRejectModal(false)}
              aria-label="Close comment panel"
              title="Close"
            >
              <FaTimes aria-hidden="true" />
            </button>
            <h4 className="pup-reject-title" id="pup-reject-title">Rejection Comments</h4>
            <p className="pup-reject-subtitle" id="pup-reject-subtitle">Please enter comments detailing the reason for rejecting this registration.</p>
            <label htmlFor="pup-reject-textarea" className="pup-reject-label">
              Comments<span className="pup-required" aria-hidden="true">*</span>
            </label>
            <textarea
              id="pup-reject-textarea"
              aria-required="true"
              className="pup-reject-textarea"
              placeholder="Enter rejection comments here..."
              value={rejectComments}
              onChange={(e) => setRejectComments(e.target.value)}
              rows={4}
            />
            <div className="pup-reject-actions">
              <button
                type="button"
                className="pup-reject-btn pup-reject-btn-cancel"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectComments('');
                }}
                disabled={statusLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pup-reject-btn pup-reject-btn-submit"
                onClick={handleReject}
                disabled={statusLoading || !rejectComments.trim()}
              >
                {statusLoading ? <FaSpinner className="pup-spin" aria-hidden="true" /> : 'Submit Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformUserPopup;