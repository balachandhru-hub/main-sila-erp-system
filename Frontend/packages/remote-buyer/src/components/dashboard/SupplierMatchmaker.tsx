import React from "react";
import {
  BuildingIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  MapPinIcon,
  MessageSquareIcon,
  SendIcon,
  SparklesIcon,
} from "@vosox/shared-ui";
import { matchCards } from "./mockData";
import type { MatchCard } from "./types";

interface SupplierMatchmakerProps {
  onViewProfile: (card: MatchCard) => void;
}

/** "Smart Supplier Matchmaker" cards (placeholder data, see mockData). */
const SupplierMatchmaker: React.FC<SupplierMatchmakerProps> = ({ onViewProfile }) => (
  <section className="pud-matchmaker" aria-labelledby="pud-matchmaker-title">
    <div className="pud-matchmaker-header">
      <div className="pud-matchmaker-title-row">
        <span className="pud-matchmaker-icon" aria-hidden="true"><SparklesIcon /></span>
        <h2 className="pud-matchmaker-title" id="pud-matchmaker-title">Smart Supplier Matchmaker</h2>
      </div>
      <div className="pud-matchmaker-subtitle">
        Verified suppliers ready to fulfill products and services matching your sourcing categories and delivery regions.
      </div>
    </div>

    <div className="pud-match-grid">
      {matchCards.map((card) => (
        <article className="pud-match-card" key={card.name}>
          <span className="pud-match-location"><MapPinIcon /> {card.location}</span>
          <div className="pud-match-top">
            <div className="pud-match-avatar" aria-hidden="true">{card.initials}</div>
            <div>
              <h3 className="pud-match-name">{card.name}</h3>
              <div className="pud-match-seeking"><BuildingIcon /> Supplies: {card.seeking}</div>
            </div>
          </div>
          <p className="pud-match-desc">{card.description}</p>
          <div className="pud-match-rep-row">
            <span className="pud-match-rep-label">Representative:</span>
            <span className="pud-match-rep-name">{card.representative}</span>
          </div>
          <div className="pud-match-actions">
            <button
              type="button"
              className="pud-btn pud-btn-outline pud-btn-flex"
              onClick={() => onViewProfile(card)}
            >
              <EyeIcon /> Profile
            </button>
            {card.actionVariant === "message" ? (
              <button type="button" className="pud-btn pud-btn-message pud-btn-flex">
                <MessageSquareIcon /> Message
              </button>
            ) : (
              <button type="button" className="pud-btn pud-btn-interest pud-btn-flex">
                <SendIcon /> Send Interest
              </button>
            )}
          </div>
        </article>
      ))}
    </div>

    <nav className="pud-pagination" aria-label="Supplier matches pagination">
      <button type="button" className="pud-page-btn pud-page-btn-disabled" disabled aria-label="Previous suppliers">
        <ChevronLeftIcon />
      </button>
      <button type="button" className="pud-page-btn" aria-label="Next suppliers">
        <ChevronRightIcon />
      </button>
    </nav>
  </section>
);

export default SupplierMatchmaker;
