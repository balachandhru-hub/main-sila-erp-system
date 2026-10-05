import React from "react";
import type { ChatParticipantProfile } from "./chatTypes";
import { getInitials } from "./chatUtils";
import { IconChevronLeft } from "./ChatIcons";

export interface ObservedParticipant {
  userId: string;
  name: string;
}

interface ChatDetailsProps {
  role: "buyer" | "supplier";
  counterpartyName: string;
  currentUserProfile: ChatParticipantProfile | null;
  isLoadingCurrentUserProfile: boolean;
  /** Other people (not the current user) observed sending messages, scoped per role — see ChatPanel. */
  observedParticipants: ObservedParticipant[];
  onBack: () => void;
}

const ChatDetails: React.FC<ChatDetailsProps> = ({
  role,
  counterpartyName,
  currentUserProfile,
  isLoadingCurrentUserProfile,
  observedParticipants,
  onBack,
}) => {
  const myDisplayName = currentUserProfile?.name || currentUserProfile?.userName || (role === "buyer" ? "Buyer" : "You");

  if (role === "buyer") {
    return (
      <div className="brc-details">
        <div className="brcd-header">
          <button type="button" className="brcd-back-btn" onClick={onBack} aria-label="Back to conversation">
            <IconChevronLeft />
          </button>
          <h3 className="brcd-header-title">Chat Details</h3>
        </div>

        <div className="brcd-body">
          <div className="brcd-hero">
            <div className="brc-supplier-avatar brcd-hero-avatar" aria-hidden="true">{getInitials(counterpartyName)}</div>
            <div className="brcd-hero-name">{counterpartyName}</div>
            <div className="brcd-hero-sub">Supplier</div>
          </div>

          <div className="brcd-section">
            <h4 className="brcd-section-title">Supplier</h4>
            <div className="brcd-field">
              <span className="brcd-field-label">Name</span>
              <span className="brcd-field-value">{counterpartyName}</span>
            </div>
          </div>

          <div className="brcd-section">
            <h4 className="brcd-section-title">Chat participants</h4>

            <div className="brcd-participant-group-label">Buyer</div>
            {isLoadingCurrentUserProfile ? (
              <div className="brcd-empty-note" role="status">Loading buyer details...</div>
            ) : currentUserProfile ? (
              <div className="brc-participant-row">
                <div className="brc-supplier-avatar brc-participant-avatar" aria-hidden="true">{getInitials(myDisplayName)}</div>
                <div className="brc-participant-info">
                  <div className="brc-participant-name">{myDisplayName} (You)</div>
                  <div className="brc-participant-email">{currentUserProfile.email}</div>
                </div>
              </div>
            ) : (
              <div className="brcd-empty-note">Buyer details unavailable.</div>
            )}

            <div className="brcd-participant-group-label">{counterpartyName}</div>
            {observedParticipants.length === 0 ? (
              <div className="brcd-empty-note">
                No users from {counterpartyName} have sent a message in this conversation yet.
              </div>
            ) : (
              observedParticipants.map((participant) => (
                <div key={participant.userId} className="brc-participant-row">
                  <div className="brc-supplier-avatar brc-participant-avatar" aria-hidden="true">{getInitials(participant.name)}</div>
                  <div className="brc-participant-info">
                    <div className="brc-participant-name">{participant.name}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }

  // Supplier side: "self" is this org's own group (current user + any observed
  // teammates), and the buyer's identity is only known by name — there's no
  // per-buyer-user visibility the way the buyer side observes supplier senders.
  const myOrganizationName = currentUserProfile?.organizationName || "Your organization";

  return (
    <div className="brc-details">
      <div className="brcd-header">
        <button type="button" className="brcd-back-btn" onClick={onBack} aria-label="Back to conversation">
          <IconChevronLeft />
        </button>
        <div className="brcd-header-title">Chat Details</div>
      </div>

      <div className="brcd-body">
        <div className="brcd-hero">
          <div className="brc-supplier-avatar brcd-hero-avatar">{getInitials(counterpartyName)}</div>
          <div className="brcd-hero-name">{counterpartyName}</div>
          <div className="brcd-hero-sub">Buyer</div>
        </div>

        <div className="brcd-section">
          <div className="brcd-section-title">Conversation</div>
          <div className="brcd-field">
            <span className="brcd-field-label">Counterparty</span>
            <span className="brcd-field-value">{counterpartyName}</span>
          </div>
        </div>

        <div className="brcd-section">
          <div className="brcd-section-title">Chat participants</div>

          <div className="brcd-participant-group-label">{myOrganizationName}</div>
          {isLoadingCurrentUserProfile ? (
            <div className="brcd-empty-note">Loading your details...</div>
          ) : currentUserProfile ? (
            <div className="brc-participant-row">
              <div className="brc-supplier-avatar brc-participant-avatar">{getInitials(myDisplayName)}</div>
              <div className="brc-participant-info">
                <div className="brc-participant-name">{myDisplayName} (You)</div>
                <div className="brc-participant-email">{currentUserProfile.email}</div>
              </div>
            </div>
          ) : (
            <div className="brcd-empty-note">Your details are unavailable.</div>
          )}
          {observedParticipants.map((participant) => (
            <div key={participant.userId} className="brc-participant-row">
              <div className="brc-supplier-avatar brc-participant-avatar">{getInitials(participant.name)}</div>
              <div className="brc-participant-info">
                <div className="brc-participant-name">{participant.name}</div>
              </div>
            </div>
          ))}

          <div className="brcd-participant-group-label">Buyer</div>
          <div className="brc-participant-row">
            <div className="brc-supplier-avatar brc-participant-avatar">{getInitials(counterpartyName)}</div>
            <div className="brc-participant-info">
              <div className="brc-participant-name">{counterpartyName}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatDetails;
