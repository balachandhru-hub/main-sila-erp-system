import React from "react";
import { StatusBadge } from "@vosox/shared-ui";
import { IconBuildingSmall, IconCalendar, IconTag, IconCheckCircle, IconXCircle, IconArrowRight, STATUS_ICON } from "./icons";
import type { Invitation } from "./types";

interface InvitationCardProps {
    invitation: Invitation;
    showActions: boolean;
    canViewDetails: boolean;
    onAccept: (invitation: Invitation) => void;
    onDecline: (invitation: Invitation) => void;
    onViewDetails: (invitation: Invitation) => void;
    actionLoading: "accept" | "decline" | null;
    actionError: string | null;
}

const InvitationCard: React.FC<InvitationCardProps> = ({ invitation, showActions, canViewDetails, onAccept, onDecline, onViewDetails, actionLoading, actionError }) => {
    const { category, status, code, title, company, description, closing } = invitation;
    const canRespond = showActions && (status === "open" || status === "submitted");

    return (
        <article className={`inv-card inv-card-${status}`}>
            <div className="inv-card-top">
                <span className="sila-ref">{code}</span>
                <StatusBadge
                    status={status}
                    size="sm"
                    label={<>{STATUS_ICON[status] && <span className="inv-status-icon" aria-hidden="true">{STATUS_ICON[status]}</span>}{status.charAt(0).toUpperCase() + status.slice(1)}</>}
                />
            </div>

            <div className="inv-card-body">
                <h3 className="inv-card-title">{title}</h3>
                <div className="inv-card-meta-row">
                    <span className="inv-meta-item">
                        <IconBuildingSmall /> {company}
                    </span>
                    <span className="inv-meta-item">
                        <IconCalendar /> Closing: {closing}
                    </span>
                    {category && (
                        <span className="inv-meta-item">
                            <IconTag /> {category}
                        </span>
                    )}
                </div>
                <p className="inv-description">{description}</p>

                {actionError && (
                    <div className="sila-error-text inv-action-error" role="alert">{actionError}</div>
                )}
            </div>

            <div className="inv-card-footer">
                <div className="inv-footer-left">
                    {canRespond && (
                        <>
                            <button
                                type="button"
                                className="sila-btn sila-btn--primary sila-btn--sm"
                                onClick={() => onAccept(invitation)}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === "accept" && <span className="sila-spinner" aria-hidden="true" />}
                                {actionLoading === "accept" ? "Accepting..." : "Accept"}
                            </button>
                            <button
                                type="button"
                                className="sila-btn sila-btn--secondary sila-btn--sm inv-btn-decline"
                                onClick={() => onDecline(invitation)}
                                disabled={actionLoading !== null}
                            >
                                {actionLoading === "decline" && <span className="sila-spinner" aria-hidden="true" />}
                                {actionLoading === "decline" ? "Declining..." : "Decline"}
                            </button>
                        </>
                    )}
                    {status === "accepted" && (
                        <span className="inv-footer-status inv-footer-status-accepted">
                            <IconCheckCircle /> Invitation Accepted
                        </span>
                    )}
                    {status === "declined" && (
                        <span className="inv-footer-status inv-footer-status-declined">
                            <IconXCircle /> Invitation Declined
                        </span>
                    )}
                </div>

                <button
                    type="button"
                    className="sila-btn sila-btn--ghost sila-btn--sm inv-btn-view"
                    onClick={() => onViewDetails(invitation)}
                    disabled={!canViewDetails}
                    title={!canViewDetails ? "Details unavailable" : undefined}
                >
                    View Details <IconArrowRight />
                </button>
            </div>
        </article>
    );
};

export default InvitationCard;
