import React from "react";
import { StatusBadge } from "@vosox/shared-ui";
import { IconShieldCheck, IconPin, IconGlobe, IconClose, IconSparkles, IconCheckCircle, IconMessageSquare, IconSend } from "./icons";
import type { MatchCard } from "./MatchmakerGrid";

interface MatchProfileModalProps {
  profile: MatchCard;
  onClose: () => void;
}

const MatchProfileModal: React.FC<MatchProfileModalProps> = ({ profile, onClose }) => {
  return (
    <div className="sila-overlay pud-profile-overlay" onClick={onClose}>
      <div
        className="sila-modal sila-modal--lg pud-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pud-profile-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sila-modal-header">
          <div className="pud-profile-heading">
            <StatusBadge
              status="Verified"
              size="sm"
              label={<><IconShieldCheck /> Verified Sourcing Partner</>}
            />
            <h2 className="sila-modal-title" id="pud-profile-title">{profile.name}</h2>
            <div className="pud-profile-meta">
              <span><IconPin /> {profile.location}</span>
              <span><IconGlobe /> {profile.website}</span>
            </div>
          </div>
          <button
            type="button"
            className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
            onClick={onClose}
            aria-label="Close profile"
          >
            <IconClose />
          </button>
        </div>

        <div className="sila-modal-body">
          <h3 className="pud-profile-section-title">Organization Description</h3>
          <p className="pud-profile-desc">{profile.description}</p>

          <div className="pud-profile-analytics">
            <h3 className="pud-profile-section-title">
              <IconSparkles /> Verified Match Analytics
            </h3>
            <div className="pud-profile-analytics-grid">
              <div className="pud-profile-analytics-item">
                <span className="pud-profile-check" aria-hidden="true"><IconCheckCircle /></span>
                <div>
                  <div className="sila-meta-label">Interest Category</div>
                  <div className="sila-meta-value">{profile.seeking}</div>
                  <div className="pud-profile-note">{profile.categoryNote}</div>
                </div>
              </div>
              <div className="pud-profile-analytics-item">
                <span className="pud-profile-check" aria-hidden="true"><IconCheckCircle /></span>
                <div>
                  <div className="sila-meta-label">Delivery Destination</div>
                  <div className="sila-meta-value">{profile.location}</div>
                  <div className="pud-profile-note">{profile.destinationNote}</div>
                </div>
              </div>
            </div>
          </div>

          <dl className="sila-meta-grid pud-profile-info">
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Company Representative</dt>
              <dd className="sila-meta-value">
                {profile.representative} ({profile.repTitle})
              </dd>
              <dd className="pud-profile-link-row">
                <a className="pud-profile-link" href={`mailto:${profile.repEmail}`}>
                  {profile.repEmail}
                </a>
              </dd>
            </div>
            <div className="sila-meta-item">
              <dt className="sila-meta-label">Scale of Operations</dt>
              <dd className="sila-meta-value">Revenue: {profile.revenue}</dd>
              <dd className="sila-meta-value">Scale: {profile.employees}</dd>
            </div>
          </dl>
        </div>

        <div className="sila-modal-footer">
          {profile.actionVariant === "message" ? (
            <button type="button" className="sila-btn sila-btn--primary">
              <IconMessageSquare /> Message Buyer
            </button>
          ) : (
            <button type="button" className="sila-btn sila-btn--primary">
              <IconSend /> Send Interest
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchProfileModal;
