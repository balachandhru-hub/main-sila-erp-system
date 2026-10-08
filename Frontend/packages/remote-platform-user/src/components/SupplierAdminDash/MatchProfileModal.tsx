import React from "react";
import { IconShieldCheck, IconClose, IconPin, IconGlobe, IconSparkles, IconCheckCircle, IconMessageSquare, IconSend } from "./icons";
import type { MatchCard } from "./MatchmakerGrid";

interface MatchProfileModalProps {
  profile: MatchCard;
  onClose: () => void;
}

const MatchProfileModal: React.FC<MatchProfileModalProps> = ({ profile, onClose }) => {
  return (
    <div className="sad-modal-overlay" onClick={onClose}>
      <div className="sad-modal" role="dialog" aria-modal="true" aria-label={profile.name} onClick={(e) => e.stopPropagation()}>
        <div className="sad-modal-header">
          <span className="sad-modal-badge">
            <IconShieldCheck /> Verified Buyer Partner
          </span>
          <button type="button" className="sad-modal-close" onClick={onClose} aria-label="Close profile">
            <IconClose />
          </button>
          <h2 className="sad-modal-name">{profile.name}</h2>
          <div className="sad-modal-meta">
            <span><IconPin /> {profile.location}</span>
            <span><IconGlobe /> {profile.website}</span>
          </div>
        </div>

        <div className="sad-modal-body">
          <div className="sad-modal-section-title">Organization Description</div>
          <p className="sad-modal-desc">{profile.description}</p>

          <div className="sad-modal-analytics">
            <div className="sad-modal-analytics-title">
              <IconSparkles /> Verified Match Analytics
            </div>
            <div className="sad-modal-analytics-grid">
              <div className="sad-modal-analytics-item">
                <span className="sad-modal-check"><IconCheckCircle /></span>
                <div>
                  <div className="sad-modal-analytics-label">Interest Category</div>
                  <div className="sad-modal-analytics-value">{profile.seeking}</div>
                  <div className="sad-modal-analytics-note">{profile.categoryNote}</div>
                </div>
              </div>
              <div className="sad-modal-analytics-item">
                <span className="sad-modal-check"><IconCheckCircle /></span>
                <div>
                  <div className="sad-modal-analytics-label">Delivery Destination</div>
                  <div className="sad-modal-analytics-value">{profile.location}</div>
                  <div className="sad-modal-analytics-note">{profile.destinationNote}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="sad-modal-info-grid">
            <div>
              <div className="sad-modal-info-label">Company Representative</div>
              <div className="sad-modal-info-value">
                {profile.representative} ({profile.repTitle})
              </div>
              <a className="sad-modal-info-link" href={`mailto:${profile.repEmail}`}>
                {profile.repEmail}
              </a>
            </div>
            <div>
              <div className="sad-modal-info-label">Scale of Operations</div>
              <div className="sad-modal-info-value">Revenue: {profile.revenue}</div>
              <div className="sad-modal-info-value">Scale: {profile.employees}</div>
            </div>
          </div>
        </div>

        <div className="sad-modal-footer">
          {profile.actionVariant === "message" ? (
            <button type="button" className="sad-btn sad-btn-message sad-modal-footer-btn">
              <IconMessageSquare /> Message Buyer
            </button>
          ) : (
            <button type="button" className="sad-btn sad-btn-interest sad-modal-footer-btn">
              <IconSend /> Send Interest
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MatchProfileModal;
