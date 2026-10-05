import React, { useEffect, useState } from 'react';
import { EmptyState, Loader, StatusBadge, getStatusTone, toastService } from '@vosox/shared-ui';
import { downloadBuyerAsset } from '../../api/platformApi';
import type { ContractRecord } from './contractApi';
import {
  fetchContractById,
  formatContractAmount,
  formatContractDate,
  submitContractApprovalAction,
  CONTRACT_APPROVAL_STATUS,
} from './contractApi';
import './ContractDetail.css';

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const IconFile = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const IconDownload = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12m0 0-4-4m4 4 4-4M4 21h16" />
  </svg>
);

const IconArrow = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

const IconMail = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const initialsOf = (name: string) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

interface ContractDetailProps {
  /** The row the buyer clicked; used to render the header immediately while the full detail loads. */
  contract: ContractRecord;
  /** Signed-in user's id, used to determine which approver card (if any) they can act on. */
  currentUserId: string | null;
  onBack: () => void;
}

const InfoField: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="ctrd-info-field">
    <dt className="ctrd-info-label">{label}</dt>
    <dd className="ctrd-info-value">{value || '—'}</dd>
  </div>
);

interface ApprovalUserCardProps {
  userName: string;
  email: string;
  order: number;
  status: string;
  isCurrentUser: boolean;
  canAct: boolean;
  submitting: boolean;
  onDecision: (action: 'APPROVE' | 'REJECT', comment: string) => void;
}

const ApprovalUserCard: React.FC<ApprovalUserCardProps> = ({
  userName,
  email,
  order,
  status,
  isCurrentUser,
  canAct,
  submitting,
  onDecision,
}) => {
  const tone = getStatusTone(status);
  const [comment, setComment] = useState('');
  const [commentTouched, setCommentTouched] = useState(false);
  const [pendingAction, setPendingAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const trimmedComment = comment.trim();
  const commentInvalid = commentTouched && trimmedComment.length === 0;
  const commentId = `ctrd-approver-comment-${order}`;

  const handleSubmit = (action: 'APPROVE' | 'REJECT') => {
    if (submitting) return;
    if (trimmedComment.length === 0) {
      setCommentTouched(true);
      toastService.error('Please add a comment before submitting.');
      return;
    }
    setPendingAction(action);
    onDecision(action, trimmedComment);
  };

  return (
    <div className={`ctrd-approver-card ctrd-approver-card--${tone}${canAct ? ' ctrd-approver-card-active' : ''}`} role="listitem">
      <div className="ctrd-approver-card-head">
        <span className="ctrd-approver-order-badge" aria-hidden="true">{order}</span>
        <span className="ctrd-approver-order-label">Approver {order}</span>
        <StatusBadge status={status} tone={tone} size="sm" dot className="ctrd-approver-card-status" />
      </div>
      <div className="ctrd-approver-card-body">
        <div className="ctrd-approver-card-person">
          <span className="ctrd-approver-avatar" aria-hidden="true">{initialsOf(userName)}</span>
          <div className="ctrd-approver-identity">
            <div className="ctrd-approver-name" title={userName}>
              <span className="ctrd-approver-name-text">{userName}</span>
              {isCurrentUser && <span className="ctrd-approver-you">You</span>}
            </div>
            {email && (
              <div className="ctrd-approver-email" title={email}>
                <IconMail />
                <span>{email}</span>
              </div>
            )}
          </div>
        </div>

        {canAct && (
          <div className="ctrd-approver-card-actions">
            <label className="sila-label" htmlFor={commentId}>
              Comment <span className="sila-required" aria-hidden="true">*</span>
            </label>
            <textarea
              id={commentId}
              className={`sila-textarea ctrd-approver-comment-input${commentInvalid ? ' ctrd-approver-comment-input-invalid' : ''}`}
              aria-required="true"
              aria-invalid={commentInvalid}
              aria-describedby={commentInvalid ? `${commentId}-error` : undefined}
              placeholder="Add a comment for this decision..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onBlur={() => setCommentTouched(true)}
              disabled={submitting}
              rows={3}
            />
            {commentInvalid && (
              <span className="sila-error-text" id={`${commentId}-error`} role="alert">Comment is required.</span>
            )}
            <div className="ctrd-approver-card-buttons">
              <button
                type="button"
                className="sila-btn sila-btn--success"
                disabled={submitting}
                onClick={() => handleSubmit('APPROVE')}
              >
                {submitting && pendingAction === 'APPROVE' ? <span className="sila-spinner" aria-hidden="true" /> : <IconCheck />}
                Approve
              </button>
              <button
                type="button"
                className="sila-btn sila-btn--secondary ctrd-approver-btn-reject"
                disabled={submitting}
                onClick={() => handleSubmit('REJECT')}
              >
                {submitting && pendingAction === 'REJECT' ? <span className="sila-spinner" aria-hidden="true" /> : <IconX />}
                Reject
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ContractDetail: React.FC<ContractDetailProps> = ({ contract, currentUserId, onBack }) => {
  const [detail, setDetail] = useState<ContractRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadDetail = () => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchContractById(contract.id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((err: any) => {
        if (!cancelled) setError(err.message || 'Failed to load the contract.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  };

  useEffect(() => {
    setDetail(null);
    return loadDetail();
  }, [contract.id]);

  // Show the row's summary immediately; once the detail call resolves, use the fresher data.
  const shown = detail || contract;
  const approvers = [...(shown.approvalUsers || [])].sort((a, b) => a.order - b.order);
  const approvedCount = approvers.filter((a) => getStatusTone(a.status) === 'success').length;

  const handleDecision = async (action: 'APPROVE' | 'REJECT', comment: string) => {
    if (submitting) return;
    setSubmitting(true);
    try {
      const status = action === 'APPROVE' ? CONTRACT_APPROVAL_STATUS.APPROVE : CONTRACT_APPROVAL_STATUS.REJECT;
      await submitContractApprovalAction(contract.id, { status, comment });
      toastService.success(action === 'APPROVE' ? 'Contract approved successfully.' : 'Contract rejected.');
      loadDetail();
    } catch (err: any) {
      toastService.error(err?.message || 'Failed to submit your decision.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownload = async (attachment: { id: string; assetId: string; fileName: string }) => {
    if (downloadingId) return;
    setDownloadingId(attachment.id);
    try {
      const asset = await downloadBuyerAsset(attachment.assetId);
      if ('statusCode' in asset) {
        throw new Error((asset as any).message || 'Failed to download the attachment.');
      }
      const byteCharacters = atob(asset.fileBytes);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: asset.contentType || 'application/octet-stream' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = asset.fileName || attachment.fileName || 'download';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      toastService.error(err.message || 'Failed to download the attachment.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="ctrd-detail">
      <div className="ctrd-detail-header">
        <button
          type="button"
          className="sila-btn sila-btn--secondary sila-btn--icon ctrd-detail-close"
          onClick={onBack}
          aria-label="Back to list"
          title="Back to list"
        >
          <IconBack />
        </button>
        <div className="ctrd-detail-heading">
          <span className="sila-ref ctrd-detail-ref-badge">{shown.contractNumber}</span>
          <div className="ctrd-detail-title-row">
            <h2 className="ctrd-detail-title">{shown.contractName}</h2>
            {shown.status && <StatusBadge status={shown.status} />}
          </div>
          <div className="ctrd-detail-meta">
            <span>RFQ {shown.rfqNumber}</span>
            {shown.rfqTitle && (
              <>
                <span className="ctrd-detail-dot" aria-hidden="true">•</span>
                <span>{shown.rfqTitle}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="ctrd-detail-body">
        {loading && !detail ? (
          <Loader size={28} message="Loading contract details..." />
        ) : error && !detail ? (
          <EmptyState variant="error" title="Couldn't load this contract" description={error} />
        ) : (
          <div className="ctrd-detail-stack">
            <section>
              <h3 className="ctrd-section-title">Contract Information</h3>
              <dl className="ctrd-info-grid">
                <InfoField label="Contract Number" value={shown.contractNumber} />
                <InfoField label="Contract Name" value={shown.contractName} />
                <InfoField label="RFQ Number" value={shown.rfqNumber} />
                <InfoField label="RFQ Title" value={shown.rfqTitle} />
                <InfoField label="Start Date" value={formatContractDate(shown.startDate)} />
                <InfoField label="End Date" value={formatContractDate(shown.endDate)} />
                <InfoField label="Amount" value={formatContractAmount(shown.amount)} />
                <InfoField label="Date Created" value={formatContractDate(shown.dateCreated, true)} />
                <InfoField label="Status" value={shown.status ? <StatusBadge status={shown.status} /> : null} />
              </dl>
            </section>

            <section>
              <h3 className="ctrd-section-title">
                Attachments
                {shown.attachments.length > 0 && (
                  <span className="ctrd-section-count">{shown.attachments.length}</span>
                )}
              </h3>
              {shown.attachments.length === 0 ? (
                <EmptyState title="No attachments for this contract." />
              ) : (
                <ul className="ctrd-attachment-list">
                  {shown.attachments.map((attachment) => (
                    <li key={attachment.id} className="ctrd-attachment-row">
                      <span className="ctrd-attachment-icon" aria-hidden="true"><IconFile /></span>
                      <span className="ctrd-attachment-name">{attachment.fileName}</span>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary ctrd-attachment-download"
                        onClick={() => handleDownload(attachment)}
                        disabled={downloadingId === attachment.id}
                      >
                        <IconDownload />
                        {downloadingId === attachment.id ? 'Downloading…' : 'Download'}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h3 className="ctrd-section-title">
                Approval Chain
                {approvers.length > 0 && (
                  <span className="ctrd-section-count">
                    {approvedCount} of {approvers.length} approved
                  </span>
                )}
              </h3>
              {approvers.length === 0 ? (
                <EmptyState title="No approvers assigned to this contract yet." />
              ) : (
                <div className="ctrd-approver-strip" role="list">
                  {approvers.map((approver, idx) => {
                    const tone = getStatusTone(approver.status);
                    const isCurrentUser = !!currentUserId && approver.userId === currentUserId;
                    return (
                      <React.Fragment key={approver.userId}>
                        <ApprovalUserCard
                          userName={approver.userName}
                          email={approver.email}
                          order={approver.order}
                          status={approver.status}
                          isCurrentUser={isCurrentUser}
                          canAct={isCurrentUser && tone === 'warning'}
                          submitting={submitting}
                          onDecision={handleDecision}
                        />
                        {idx < approvers.length - 1 && (
                          <span
                            className={`ctrd-approver-connector${tone === 'success' ? ' ctrd-approver-connector-done' : ''}`}
                            aria-hidden="true"
                          >
                            <IconArrow />
                          </span>
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <div className="ctrd-detail-footer">
        <button type="button" className="sila-btn sila-btn--secondary" onClick={onBack}>
          Back to list
        </button>
      </div>
    </div>
  );
};

export default ContractDetail;
