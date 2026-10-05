import React from "react";
import {
  CheckIcon,
  CloseIcon,
  GlobeIcon,
  MapPinIcon,
  MessageSquareIcon,
  SendIcon,
  ShieldCheckIcon,
  SparklesIcon,
} from "@vosox/shared-ui";
import type { MatchCard } from "./types";

interface SupplierProfileModalProps {
  profile: MatchCard;
  onClose: () => void;
}

/** Details of a matched supplier, opened from the matchmaker cards. */
const SupplierProfileModal: React.FC<SupplierProfileModalProps> = ({ profile, onClose }) => (
  <div className="pud-modal-overlay" onClick={onClose}>
    <div
      className="pud-modal pud-profile-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pud-profile-modal-title"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="pud-modal-header">
        <span className="pud-modal-badge">
          <ShieldCheckIcon /> Verified Supplier Partner
        </span>
        <button
          type="button"
          className="pud-modal-close"
          onClick={onClose}
          aria-label="Close supplier profile"
        >
          <CloseIcon />
        </button>
        <h2 className="pud-modal-name" id="pud-profile-modal-title">{profile.name}</h2>
        <div className="pud-modal-meta">
          <span><MapPinIcon /> {profile.location}</span>
          <span><GlobeIcon /> {profile.website}</span>
        </div>
      </div>

      <div className="pud-modal-body">
        <div className="pud-modal-section-title">Organization Description</div>
        <p className="pud-modal-desc">{profile.description}</p>

        <div className="pud-modal-analytics">
          <div className="pud-modal-analytics-title">
            <SparklesIcon /> Verified Match Analytics
          </div>
          <div className="pud-modal-analytics-grid">
            <div className="pud-modal-analytics-item">
              <span className="pud-modal-check"><CheckIcon /></span>
              <div>
                <div className="pud-modal-analytics-label">Supply Category</div>
                <div className="pud-modal-analytics-value">{profile.seeking}</div>
                <div className="pud-modal-analytics-note">{profile.categoryNote}</div>
              </div>
            </div>
            <div className="pud-modal-analytics-item">
              <span className="pud-modal-check"><CheckIcon /></span>
              <div>
                <div className="pud-modal-analytics-label">Service Region</div>
                <div className="pud-modal-analytics-value">{profile.location}</div>
                <div className="pud-modal-analytics-note">{profile.destinationNote}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="pud-modal-info-grid">
          <div>
            <div className="pud-modal-info-label">Company Representative</div>
            <div className="pud-modal-info-value">
              {profile.representative} ({profile.repTitle})
            </div>
            <a className="pud-modal-info-link" href={`mailto:${profile.repEmail}`}>
              {profile.repEmail}
            </a>
          </div>
          <div>
            <div className="pud-modal-info-label">Scale of Operations</div>
            <div className="pud-modal-info-value">Revenue: {profile.revenue}</div>
            <div className="pud-modal-info-value">Scale: {profile.employees}</div>
          </div>
        </div>
      </div>

      <div className="pud-modal-footer">
        {profile.actionVariant === "message" ? (
          <button type="button" className="pud-btn pud-btn-message pud-modal-footer-btn">
            <MessageSquareIcon /> Message Supplier
          </button>
        ) : (
          <button type="button" className="pud-btn pud-btn-interest pud-modal-footer-btn">
            <SendIcon /> Send Interest
          </button>
        )}
      </div>
    </div>
  </div>
);

export default SupplierProfileModal;
