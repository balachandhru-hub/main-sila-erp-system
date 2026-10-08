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
    description: "Vertex Labs is a cutting-edge deep tech incubator looking to outfit their brand-new engineering office space with state-of-the-art workstations.",
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
    description: "Starlight Group coordinates multi-location boutique hotel lounges and business centers across Europe.",
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
    description: "Vanguard supplies administrative desks and corporate centers with specialized FSC certified eco-friendly writing materials.",
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
    description: "Horizon BioTech operates premium research facilities and corporate office buildings requiring high-volume supplies.",
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
    <section className="sad-matchmaker">
      <div className="sad-matchmaker-header">
        <div className="sad-matchmaker-title-row">
          <span className="sad-matchmaker-icon" aria-hidden="true"><IconSparkles /></span>
          <div className="sad-matchmaker-title">Buyer Network Overview</div>
        </div>
        <div className="sad-matchmaker-subtitle">
          Monitor connected buyers and their engagement with your suppliers.
        </div>
      </div>

      <div className="sad-match-grid">
        {matchCards.map((card) => (
          <div className="sad-match-card" key={card.name}>
            <span className="sad-match-location"><IconPin /> {card.location}</span>
            <div className="sad-match-top">
              <div className="sad-match-avatar" aria-hidden="true">{card.initials}</div>
              <div>
                <div className="sad-match-name">{card.name}</div>
                <div className="sad-match-seeking"><NavIconBuilding /> Seeking: {card.seeking}</div>
              </div>
            </div>
            <p className="sad-match-desc">{card.description}</p>
            <div className="sad-match-rep-row">
              <span className="sad-match-rep-label">Representative:</span>
              <span className="sad-match-rep-name">{card.representative}</span>
            </div>
            <div className="sad-match-actions">
              <button
                type="button"
                className="sad-btn sad-btn-outline sad-btn-flex"
                onClick={() => onSelectProfile(card)}
              >
                <IconEye /> Profile
              </button>
              {card.actionVariant === "message" ? (
                <button type="button" className="sad-btn sad-btn-message sad-btn-flex">
                  <IconMessageSquare /> Message
                </button>
              ) : (
                <button type="button" className="sad-btn sad-btn-interest sad-btn-flex">
                  <IconSend /> Send Interest
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="sad-pagination">
        <button type="button" className="sad-page-btn sad-page-btn-disabled" disabled aria-label="Previous page">
          <IconChevronLeft />
        </button>
        <button type="button" className="sad-page-btn sad-page-btn-active" aria-label="Next page">
          <IconChevronRight />
        </button>
      </div>
    </section>
  );
};

export default MatchmakerGrid;
