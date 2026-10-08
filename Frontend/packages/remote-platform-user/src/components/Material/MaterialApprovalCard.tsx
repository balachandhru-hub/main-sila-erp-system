import React, { useState } from 'react';
import { StatusBadge, toastService } from '@vosox/shared-ui';
import type { StatusTone } from './materialApi';

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

const IconMail = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="4" width="20" height="16" rx="2" />
    <path d="m22 6-10 7L2 6" />
  </svg>
);

interface MaterialApprovalCardProps {
  approverName: string;
  approverEmail: string;
  position: number;
  isCurrentUser: boolean;
  canAct: boolean;
  submitting: boolean;
  onDecision: (action: 'APPROVE' | 'REJECT', comment: string) => void;
  statusTone: StatusTone;
}

const TONE_BADGE: Record<StatusTone, { status: string; tone: 'success' | 'danger' | 'warning' } | null> = {
  approved: { status: 'Approved', tone: 'success' },
  rejected: { status: 'Rejected', tone: 'danger' },
  pending: { status: 'Pending', tone: 'warning' },
  neutral: null,
};

const initialsOf = (name: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const MaterialApprovalCard: React.FC<MaterialApprovalCardProps> = ({
  approverName,
  approverEmail,
  position,
  isCurrentUser,
  canAct,
  submitting,
  onDecision,
  statusTone,
}) => {
  const [comment, setComment] = useState('');
  const [commentTouched, setCommentTouched] = useState(false);
  const [pendingAction, setPendingAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const trimmedComment = comment.trim();
  const commentInvalid = commentTouched && trimmedComment.length === 0;

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

  const badge = TONE_BADGE[statusTone];
  const commentId = `matap-comment-${position}`;

  return (
    <div className={`matap-card matap-status-${statusTone}${canAct ? ' matap-card-active' : ''}`} role="listitem">
      <div className="matap-card-head">
        <span className="matap-card-order-badge" aria-hidden="true">{position}</span>
        <span className="matap-card-order-label">Approver {position}</span>
        {badge && <StatusBadge status={badge.status} tone={badge.tone} size="sm" dot className="matap-card-status" />}
      </div>

      <div className="matap-card-body">
        <div className="matap-card-person">
          <span className="matap-card-avatar" aria-hidden="true">{initialsOf(approverName || '?')}</span>
          <div className="matap-card-identity">
            <div className="matap-card-name" title={approverName}>
              <span className="matap-card-name-text">{approverName}</span>
              {isCurrentUser && <span className="matap-card-you">You</span>}
            </div>
            {approverEmail && (
              <div className="matap-card-email" title={approverEmail}>
                <IconMail />
                <span>{approverEmail}</span>
              </div>
            )}
          </div>
        </div>

        {canAct && (
          <div className="matap-card-actions">
            <label className="sila-label" htmlFor={commentId}>
              Comment <span className="sila-required" aria-hidden="true">*</span>
            </label>
            <textarea
              id={commentId}
              className={`sila-textarea matap-card-comment-input${commentInvalid ? ' matap-card-comment-input-invalid' : ''}`}
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
            <div className="matap-card-buttons">
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
                className="sila-btn sila-btn--secondary matap-btn-reject"
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

export default MaterialApprovalCard;
