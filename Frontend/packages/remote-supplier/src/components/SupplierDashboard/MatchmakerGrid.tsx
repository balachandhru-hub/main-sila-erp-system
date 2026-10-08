import React from "react";
import { IconSparkles, NavIconBuilding, IconPin, IconEye, IconMessageSquare, IconSend, IconChevronLeft, IconChevronRight } from "./icons";

export interface MatchCard {
  location: string;
  initials: string;
  name: string;
  seeking: string;
  description: string;
  representative: string;
  actionLabel: string;
  actionVariant: "message" | "interest";
  website: string;
  repTitle: string;
  repEmail: string;
  revenue: string;
  employees: string;
  categoryNote: string;
  destinationNote: string;
}

export const matchCards: MatchCard[] = [
  {
    location: "Singapore",
    initials: "VL",
    name: "Vertex Labs Singapore",
    seeking: "IT Hardware & Accessories",
    description: "Vertex Labs is a cutting-edge deep tech incubator looking to outfit their brand-new engineering office space with state-of-the-art workstations, high-end developer peripherals, and responsive monitor systems.",
    representative: "Dr. Adrian Cheng",
    actionLabel: "Message",
    actionVariant: "message",
    website: "www.vertexlabs.com",
    repTitle: "VP Operations",
    repEmail: "adrian.cheng@vertexlabs.sg",
    revenue: "$12.5M USD",
    employees: "145 Employees",
    categoryNote: "Matches your catalog listings",
    destinationNote: "Matches your active service regions",
  },
  {
    location: "European Union",
    initials: "SH",
    name: "Starlight Hospitality Group",
    seeking: "Office Furniture",
    description: "Starlight Group coordinates multi-location boutique hotel lounges and business centers across Europe. Currently expanding common areas across three new properties and sourcing durable, design-forward furniture.",
    representative: "Evelyn Carter",
    actionLabel: "Send Interest",
    actionVariant: "interest",
    website: "www.starlighthospitality.eu",
    repTitle: "Procurement Lead",
    repEmail: "evelyn.carter@starlightgroup.eu",
    revenue: "$34.2M USD",
    employees: "620 Employees",
    categoryNote: "Matches your catalog listings",
    destinationNote: "Matches your active service regions",
  },
  {
    location: "North America",
    initials: "VS",
    name: "Vanguard Sourcing Partners",
    seeking: "Stationery",
    description: "Vanguard supplies administrative desks and corporate centers with specialized FSC certified eco-friendly writing materials, premium notebooks, and recycled paper goods.",
    representative: "Robert Miller",
    actionLabel: "Send Interest",
    actionVariant: "interest",
    website: "www.vanguardsourcing.com",
    repTitle: "Sourcing Manager",
    repEmail: "robert.miller@vanguardsourcing.com",
    revenue: "$8.9M USD",
    employees: "95 Employees",
    categoryNote: "Matches your catalog listings",
    destinationNote: "Matches your active service regions",
  },
  {
    location: "United Kingdom",
    initials: "HB",
    name: "Horizon BioTech",
    seeking: "Breakroom Supplies",
    description: "Horizon BioTech operates premium research facilities and corporate office buildings. They require high-volume premium organic coffee, snacks, and breakroom essentials across all sites.",
    representative: "Claire Johnston",
    actionLabel: "Send Interest",
    actionVariant: "interest",
    website: "www.horizonbiotech.co.uk",
    repTitle: "Facilities Director",
    repEmail: "claire.johnston@horizonbiotech.co.uk",
    revenue: "$21.7M USD",
    employees: "310 Employees",
    categoryNote: "Matches your catalog listings",
    destinationNote: "Matches your active service regions",
  },
];

interface MatchmakerGridProps {
  onSelectProfile: (card: MatchCard) => void;
}

const MatchmakerGrid: React.FC<MatchmakerGridProps> = ({ onSelectProfile }) => {
  return (
    <section className="sila-card pud-matchmaker-card">
      <div className="sila-card-header">
        <div className="pud-matchmaker-title-row">
          <span className="pud-matchmaker-icon" aria-hidden="true"><IconSparkles /></span>
          <div>
            <h2 className="sila-card-title">Smart Sourcing Matchmaker</h2>
            <p className="sila-card-subtitle">
              Active enterprise buyers looking for products and services matching your certified categories and registered ship-to locations.
            </p>
          </div>
        </div>
      </div>

      <div className="sila-card-body">
        <div className="pud-match-grid">
          {matchCards.map((card) => (
            <article className="pud-match-card" key={card.name}>
              <div className="pud-match-top">
                <div className="pud-match-avatar" aria-hidden="true">{card.initials}</div>
                <div className="pud-match-heading">
                  <h3 className="pud-match-name">{card.name}</h3>
                  <div className="pud-match-seeking"><NavIconBuilding /> Seeking: {card.seeking}</div>
                </div>
                <span className="pud-match-location"><IconPin /> {card.location}</span>
              </div>
              <p className="pud-match-desc">{card.description}</p>
              <div className="pud-match-rep-row">
                <span className="pud-match-rep-label">Representative</span>
                <span className="pud-match-rep-name">{card.representative}</span>
              </div>
              <div className="pud-match-actions">
                <button
                  type="button"
                  className="sila-btn sila-btn--secondary sila-btn--sm"
                  onClick={() => onSelectProfile(card)}
                >
                  <IconEye /> Profile
                </button>
                {card.actionVariant === "message" ? (
                  <button type="button" className="sila-btn sila-btn--primary sila-btn--sm">
                    <IconMessageSquare /> Message
                  </button>
                ) : (
                  <button type="button" className="sila-btn sila-btn--primary sila-btn--sm">
                    <IconSend /> Send Interest
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="sila-pagination pud-match-pagination">
        <span />
        <div className="sila-pagination-pages">
          <button type="button" className="sila-page-btn" disabled aria-label="Previous matches">
            <IconChevronLeft />
          </button>
          <button type="button" className="sila-page-btn" aria-label="Next matches">
            <IconChevronRight />
          </button>
        </div>
      </div>
    </section>
  );
};

export default MatchmakerGrid;
