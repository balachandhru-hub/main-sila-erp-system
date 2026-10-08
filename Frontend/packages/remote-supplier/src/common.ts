export const DEFAULT_VERIFICATION_TEMPLATE_ID = "DD5A50B8-F087-4F0A-A004-CE43E92CE2B9";

export const INVITATION_STATUS = {
  ALL: "all",
  OPEN: "open",
  SUBMITTED: "submitted",
  ACCEPTED: "accepted",
  DECLINED: "declined",
} as const;

export type InvitationStatusKey = keyof typeof INVITATION_STATUS;
export type InvitationStatusValue = (typeof INVITATION_STATUS)[InvitationStatusKey];

export const INVITATION_STATUS_LABELS: Record<InvitationStatusValue, string> = {
  [INVITATION_STATUS.ALL]: "All",
  [INVITATION_STATUS.OPEN]: "Open",
  [INVITATION_STATUS.SUBMITTED]: "Submitted",
  [INVITATION_STATUS.ACCEPTED]: "Accepted",
  [INVITATION_STATUS.DECLINED]: "Declined",
};

export const INVITATION_TABS: { key: InvitationStatusValue; label: string }[] = [
  { key: INVITATION_STATUS.ALL, label: INVITATION_STATUS_LABELS[INVITATION_STATUS.ALL] },
  { key: INVITATION_STATUS.OPEN, label: INVITATION_STATUS_LABELS[INVITATION_STATUS.OPEN] },
  { key: INVITATION_STATUS.SUBMITTED, label: INVITATION_STATUS_LABELS[INVITATION_STATUS.SUBMITTED] },
  { key: INVITATION_STATUS.ACCEPTED, label: INVITATION_STATUS_LABELS[INVITATION_STATUS.ACCEPTED] },
  { key: INVITATION_STATUS.DECLINED, label: INVITATION_STATUS_LABELS[INVITATION_STATUS.DECLINED] },
];

// Backend status mapping
export const INVITATION_STATUS_BACKEND_MAP: Record<Exclude<InvitationStatusValue, "all">, string> = {
  [INVITATION_STATUS.OPEN]: "pending",
  [INVITATION_STATUS.SUBMITTED]: "submitted",
  [INVITATION_STATUS.ACCEPTED]: "accept",
  [INVITATION_STATUS.DECLINED]: "decline",
};
