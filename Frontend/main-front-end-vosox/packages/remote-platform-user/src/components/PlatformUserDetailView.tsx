import React, { useState, useCallback } from 'react';
import CompanyProfile from './CompanyProfile/CompanyProfile';
import type { CompanyProfileData } from '@vosox/shared-ui';
import {
  downloadBuyerAsset,
  downloadSupplierAsset,
  updateBuyerStatus,
  updateSupplierStatus,
  getSupplierProfileByOrgId,
  getBuyerProfileByOrgId,
} from '../api/platformApi';
import type {
  PlatformEntityType,
  PlatformRecordDto,
} from '../dto/platformDto';
import { FaSpinner } from 'react-icons/fa';
import './PlatformUserDetailView.css';

interface PlatformUserDetailViewProps {
  type: PlatformEntityType;
  record: PlatformRecordDto;
  onBack: () => void;
  onStatusUpdated?: () => void;
  onSettingsClick?: () => void;
}

const base64ToBlob = (base64: string, contentType: string): Blob => {
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

export const PlatformUserDetailView: React.FC<PlatformUserDetailViewProps> = ({
  type,
  record,
  onBack,
  onStatusUpdated,
  onSettingsClick,
}) => {
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectComments, setRejectComments] = useState('');
  const [currentProfile, setCurrentProfile] = useState<CompanyProfileData | null>(null);

  const rawObj = record as any;
  const targetOrgId = record.organizationId || rawObj.organizationId || record.id || rawObj.id || '';

  const fetchProfileData = useCallback(async (): Promise<CompanyProfileData | null> => {
    let fetched: any = null;
    try {
      if (targetOrgId) {
        fetched =
          type === 'buyers'
            ? await getBuyerProfileByOrgId(targetOrgId)
            : await getSupplierProfileByOrgId(targetOrgId);
      }
    } catch (err) {
      console.warn('API profile fetch error, fallback to record:', err);
    }

    const baseRecord = fetched || record;
    const raw = baseRecord as any;

    const data: CompanyProfileData = {
      id: baseRecord.id || raw.id || targetOrgId,
      organizationId: targetOrgId,
      isActive: baseRecord.isActive ?? raw.isActive ?? true,
      businessProfile: {
        organizationName: baseRecord.businessProfile?.organizationName || raw.organizationName || raw.name || 'Unnamed Business',
        email: baseRecord.businessProfile?.email || raw.email,
        phone: baseRecord.businessProfile?.phone || raw.phone,
        country: baseRecord.businessProfile?.country || raw.country,
        addressLine1: baseRecord.businessProfile?.addressLine1 || raw.addressLine1,
        addressLine2: baseRecord.businessProfile?.addressLine2 || raw.addressLine2,
        city: baseRecord.businessProfile?.city || raw.city,
        state: baseRecord.businessProfile?.state || raw.state,
        pinCode: baseRecord.businessProfile?.pinCode || raw.pinCode,
        industry: baseRecord.businessProfile?.industry || raw.industry,
        businessType: baseRecord.businessProfile?.businessType || raw.businessType,
        employeeCount: baseRecord.businessProfile?.employeeCount || raw.employeeCount,
        annualTurnover: baseRecord.businessProfile?.annualTurnover || raw.annualTurnover,
        currency: baseRecord.businessProfile?.currency || raw.currency,
        yearEstablished: baseRecord.businessProfile?.yearEstablished || raw.yearEstablished,
        website: baseRecord.businessProfile?.website || raw.website,
        description: baseRecord.businessProfile?.description || raw.description,
        status: baseRecord.businessProfile?.status || raw.status || 'PENDING_VERIFICATION',
        isActive: baseRecord.businessProfile?.isActive ?? raw.isActive ?? true,
      },
      categories: baseRecord.categories || raw.categories || raw.buyerCategories || raw.supplierCategories || [],
      registrations: baseRecord.registrations || raw.registrations || [],
      bankAccounts: baseRecord.bankAccounts || raw.bankAccounts || [],
      dispatchLocations: baseRecord.dispatchLocations || raw.dispatchLocations || [],
      models: baseRecord.models || raw.models || [], 
    };

    setCurrentProfile(data);
    return data;
  }, [record, targetOrgId, type]);

  const handleVerify = async () => {
    if (statusLoading) return;
    setStatusError(null);
    setStatusLoading(true);
    const targetEntityId = currentProfile?.id || record.id || rawObj.id || targetOrgId;
    try {
      if (type === 'buyers') {
        await updateBuyerStatus(targetEntityId, 'APPROVED');
      } else {
        await updateSupplierStatus(targetEntityId, 'APPROVED');
      }
      await fetchProfileData();
      onStatusUpdated?.();
    } catch (err: any) {
      console.error('Failed to approve:', err);
      setStatusError(err.message || 'Failed to verify organization.');
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
    const targetEntityId = currentProfile?.id || record.id || rawObj.id || targetOrgId;
    try {
      if (type === 'buyers') {
        await updateBuyerStatus(targetEntityId, 'REJECTED', rejectComments);
      } else {
        await updateSupplierStatus(targetEntityId, 'REJECTED', rejectComments);
      }
      setShowRejectModal(false);
      setRejectComments('');
      await fetchProfileData();
      onStatusUpdated?.();
    } catch (err: any) {
      console.error('Failed to reject:', err);
      setStatusError(err.message || 'Failed to reject registration.');
    } finally {
      setStatusLoading(false);
    }
  };

  const handleViewDoc = async (assetId: string) => {
    setStatusError(null);
    try {
      const data = type === 'buyers' ? await downloadBuyerAsset(assetId) : await downloadSupplierAsset(assetId);
      const fileBytes = typeof data === 'string' ? data : data.fileBytes;
      let contentType = data.contentType || 'application/pdf';
      if (contentType === 'pdf') contentType = 'application/pdf';
      if (!fileBytes) throw new Error('No file data received');
      const blob = base64ToBlob(fileBytes, contentType);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err: any) {
      console.error('Failed to view document:', err);
      setStatusError(err.message || 'Failed to open document.');
    }
  };

  const orgName = currentProfile?.businessProfile?.organizationName || 'this organization';
  const commentsInvalid = !!statusError && !rejectComments.trim();

  return (
    <div className="pudv-page">
      <CompanyProfile
        mode="admin-review"
        showHeader={true}
        entityLabel={type === 'buyers' ? 'Buyer' : 'Supplier'}
        fetchProfile={fetchProfileData}
        onBack={onBack}
        onVerify={handleVerify}
        onReject={() => setShowRejectModal(true)}
        isStatusLoading={statusLoading}
        statusError={statusError}
        onViewDocument={handleViewDoc}
        onSettingsClick={onSettingsClick}
      />

      {showRejectModal && (
        <div className="pudv-modal-overlay sila-overlay">
          <div
            className="pudv-reject-dialog sila-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pudv-reject-title"
            aria-describedby="pudv-reject-desc"
          >
            <div className="sila-modal-header">
              <h3 id="pudv-reject-title" className="sila-modal-title">Reject Organization Registration</h3>
            </div>
            <div className="sila-modal-body pudv-reject-body">
              <p id="pudv-reject-desc" className="sila-modal-text">
                Please specify a reason for rejecting <strong>{orgName}</strong>:
              </p>
              <div className={`sila-field${commentsInvalid ? ' sila-field--error' : ''}`}>
                <label htmlFor="pudv-reject-comments" className="sila-label">
                  Rejection comments<span className="sila-required" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="pudv-reject-comments"
                  value={rejectComments}
                  onChange={(e) => setRejectComments(e.target.value)}
                  placeholder="Type rejection comments here..."
                  rows={4}
                  className="pudv-textarea sila-textarea"
                  required
                  aria-required="true"
                  aria-invalid={commentsInvalid}
                  aria-describedby={statusError ? 'pudv-reject-error' : undefined}
                  autoFocus
                />
                {statusError && (
                  <span id="pudv-reject-error" className="sila-error-text" role="alert">
                    {statusError}
                  </span>
                )}
              </div>
            </div>
            <div className="pudv-dialog-actions sila-modal-footer">
              <button
                type="button"
                className="pudv-btn-cancel sila-btn sila-btn--secondary"
                onClick={() => setShowRejectModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="pudv-btn-confirm-reject sila-btn sila-btn--danger"
                onClick={handleReject}
                disabled={statusLoading}
                aria-busy={statusLoading}
              >
                {statusLoading ? (
                  <>
                    <FaSpinner className="pudv-spin" aria-hidden="true" />
                    <span className="sila-visually-hidden">Rejecting</span>
                  </>
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PlatformUserDetailView;
