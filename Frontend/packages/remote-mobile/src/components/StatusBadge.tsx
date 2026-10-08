import React from 'react';
import { silaLabel } from '../../../remote-buyer/src/api/silaMe/silaInventoryApi';

const SUCCESS = ['RECEIVED', 'POSTED', 'APPROVED', 'MATCHED', 'ACCEPTED', 'COMPLETED', 'SUCCESS', 'RESOLVED', 'CLOSED', 'ACTIVE', 'ADDED_TO_BUCKET', 'GRN_POSTED'];
const WARNING = [
  'PENDING_APPROVAL', 'DISPATCHED', 'IN_PROGRESS', 'SUBMITTED', 'ENQUIRY_PENDING', 'SENT', 'PENDING', 'NEW', 'SURPLUS',
  'PARTIALLY_RECEIVED', 'POSTING', 'MEDIUM', 'HIGH', 'PROPOSED', 'REVIEW_REQUIRED', 'MORE_INFORMATION_REQUIRED',
  'RECOUNT', 'RECOUNT_REQUESTED', 'RESPONDED', 'SCHEDULED', 'IN_TRANSIT', 'APPROVED_PENDING_DISPATCH',
];
const ERROR = ['REJECTED', 'DISCREPANCY', 'FAILED', 'SHORTAGE', 'CRITICAL', 'UNKNOWN', 'OCR_FAILED', 'DISPUTED'];
const NEUTRAL = ['CANCELLED', 'NOT_COUNTED', 'DISMISSED', 'ACKNOWLEDGED', 'INFO', 'INACTIVE', 'DRAFT', 'SKIPPED'];
/** Open / informational states use the brand tone (no modifier). */

const toneOf = (status: string): string => {
  const code = status.toUpperCase();
  if (SUCCESS.includes(code)) return 'sm-badge--success';
  if (ERROR.includes(code)) return 'sm-badge--error';
  if (WARNING.includes(code)) return 'sm-badge--warning';
  if (NEUTRAL.includes(code)) return 'sm-badge--neutral';
  return '';
};

interface StatusBadgeProps {
  status: string | null | undefined;
  /** Text to show instead of the status label (the tone still follows the status). */
  label?: string;
}

/** Coloured upper-case status chip of a status code. */
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label }) => {
  if (!status) return null;
  return <span className={`sm-badge ${toneOf(status)}`}>{label ?? silaLabel(status)}</span>;
};

export default StatusBadge;
