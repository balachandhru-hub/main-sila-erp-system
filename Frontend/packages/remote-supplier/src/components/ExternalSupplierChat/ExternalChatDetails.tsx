import React from "react";
import { getInitials, IconChevronLeft } from "@vosox/shared-ui";

interface ExternalChatDetailsProps {
  counterpartyName: string;
  externalSupplierName?: string;
  onBack: () => void;
}

// Unlike the logged-in Buyer/Supplier chats, an external supplier bid link has
// no authenticated profile to show for "You" — the invited contact is only
// ever known by the RFQ invitation itself, not a per-user session. It is also
// always exactly one buyer and one external contact — there's no multi-user
// participant list to observe from message history like the internal chats.
const ExternalChatDetails: React.FC<ExternalChatDetailsProps> = ({
  counterpartyName,
  externalSupplierName,
  onBack,
}) => {
  const youLabel = externalSupplierName ? `You (${externalSupplierName})` : "You (External Supplier)";
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

          <div className="brcd-participant-group-label">Supplier</div>
          <div className="brc-participant-row">
            <div className="brc-supplier-avatar brc-participant-avatar">
              {getInitials(externalSupplierName || "External Supplier")}
            </div>
            <div className="brc-participant-info">
              <div className="brc-participant-name">{youLabel}</div>
            </div>
          </div>

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

export default ExternalChatDetails;
