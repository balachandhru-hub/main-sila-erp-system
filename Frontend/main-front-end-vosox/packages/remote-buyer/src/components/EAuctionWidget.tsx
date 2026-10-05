import React, { useState } from 'react';
import {
  FaAddressBook,
  FaArrowRight,
  FaBolt,
  FaBoxes,
  FaCheck,
  FaChevronLeft,
  FaMobileAlt,
  FaTimes,
  FaTrophy,
  FaUser,
} from 'react-icons/fa';
import './EAuctionWidget.css';

/* ---------------------------------- Interfaces ---------------------------------- */

export interface LiveAuctionItem {
  id: string;
  name: string;
  itemCode: string;
  category: string;
  closingIn: string;
  currentBid: string;
  leadSupplier: string;
  userRank: number;
}

export interface SupplierBidLeaderboard {
  rank: number;
  supplierName: string;
  bidAmount: string;
  messageCount: number;
}

export interface LiveChatMessage {
  id: string;
  sender: string;
  avatarClass: string;
  text: string;
  time: string;
}

/* ---------------------------------- Mock Live Data ---------------------------------- */

const mockAuctions: LiveAuctionItem[] = [
  {
    id: "lot-023",
    name: "Global IT Hardware Refresh - Tier 1 Laptops",
    itemCode: "AUCTION-2026-0901",
    category: "IT Hardware",
    closingIn: "14:500",
    currentBid: "$48,000.00",
    leadSupplier: "CompUSA Direct",
    userRank: 1,
  },
  {
    id: "lot-024",
    name: "Facility Management Services - Midwest Region",
    itemCode: "AUCTION-2026-0902",
    category: "Services",
    closingIn: "08:120",
    currentBid: "$49,000.00",
    leadSupplier: "OfficeMax Global",
    userRank: 2,
  },
  {
    id: "lot-025",
    name: "Office Supply Annual Contract",
    itemCode: "AUCTION-2026-0903",
    category: "Office Supplies",
    closingIn: "22:040",
    currentBid: "$18,250.00",
    leadSupplier: "SecureNet IT",
    userRank: 1,
  },
];

const mockLeaderboard: SupplierBidLeaderboard[] = [
  { rank: 1, supplierName: "CompUSA Direct", bidAmount: "$48,000", messageCount: 2 },
  { rank: 2, supplierName: "OfficeMax Global", bidAmount: "$49,000", messageCount: 1 },
  { rank: 3, supplierName: "TechSupplies Inc.", bidAmount: "$49,000", messageCount: 3 },
  { rank: 4, supplierName: "DataCorp Services", bidAmount: "$52,230", messageCount: 1 },
  { rank: 5, supplierName: "SecureNet IT", bidAmount: "$58,250", messageCount: 0 },
];

const initialChatMessages: LiveChatMessage[] = [
  { id: "c1", sender: "CompUSA Direct", avatarClass: "avatar-red", text: "Can we get clarification on the technical specifications for Lot #023?", time: "14:20" },
  { id: "c2", sender: "GlobalCorp Solutions Buyer (Alice W.)", avatarClass: "avatar-blue", text: "Clarification sent to all bidders. Check attachments in portal.", time: "14:22" },
  { id: "c3", sender: "DataCorp", avatarClass: "avatar-gold", text: "Happy to discuss volume quantity discounts for batch submittals.", time: "14:25" },
  { id: "c4", sender: "TechSupplies", avatarClass: "avatar-teal", text: "Confirming we can meet the delivery timeline for UAE location.", time: "14:28" },
];

/* ---------------------------------- Component ---------------------------------- */

export const EAuctionWidget: React.FC = () => {
  const [isHovered, setIsHovered] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLot, setSelectedLot] = useState<LiveAuctionItem>(mockAuctions[0]);
  const [chatMessages, setChatMessages] = useState<LiveChatMessage[]>(initialChatMessages);
  const [newMessageText, setNewMessageText] = useState("");
  const [awardedSupplier, setAwardedSupplier] = useState<string | null>(null);

  // Small screens only (CSS-driven): show either the sidebar or the workspace
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setMobileView("list");
  };

  const sidebarItemProps = {
    role: "button" as const,
    tabIndex: 0,
    onClick: () => setMobileView("detail"),
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setMobileView("detail");
      }
    },
  };

  const handleSendMessage = () => {
    if (!newMessageText.trim()) return;
    const msg: LiveChatMessage = {
      id: `c_${Date.now()}`,
      sender: "Buyer (Alice W.)",
      avatarClass: "avatar-blue",
      text: newMessageText,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatMessages((prev) => [...prev, msg]);
    setNewMessageText("");
  };

  const handleConfirmAward = () => {
    setAwardedSupplier(selectedLot.leadSupplier);
    alert(`Award confirmed for ${selectedLot.name} to ${selectedLot.leadSupplier}! Contract generation initialized.`);
  };

  return (
    <>
      {/* Bottom-left floating trigger widget */}
      <div
        className="eauction-floating-bar"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Hover preview card */}
        {isHovered && !isModalOpen && (
          <div className="eauction-preview-popover">
            <div className="eauction-preview-header">
              <div className="eauction-preview-title">
                <FaBolt className="eauction-icon" aria-hidden="true" />
                <span>Live e-Auction Portal</span>
              </div>
              <span className="eauction-live-status">
                <span className="eauction-live-dot" aria-hidden="true" />
                Live sourcing
              </span>
            </div>

            <div className="eauction-preview-item">
              <div className="eauction-preview-item-title">{selectedLot.name}</div>
              <div className="eauction-preview-meta">
                <span>Lead Bid: <strong className="eauction-bid-price">{selectedLot.currentBid}</strong></span>
                <span>Closing: <strong className="eauction-timer">{selectedLot.closingIn}</strong></span>
              </div>
            </div>

            <button
              type="button"
              className="eauction-enter-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <span>Enter Live Bidding Console</span>
              <FaArrowRight className="eauction-icon" aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Floating bar button */}
        <button
          type="button"
          className="eauction-trigger-btn"
          onClick={() => setIsModalOpen(true)}
          title="Open SAP Ariba Live e-Auction Console"
        >
          <span className="eauction-pulse-dot" aria-hidden="true" />
          <FaBolt className="eauction-icon eauction-icon--brand" aria-hidden="true" />
          <span>Live e-Auction</span>
          <span className="eauction-badge-count">{mockAuctions.length} Live</span>
        </button>
      </div>

      {/* Full live portal modal view */}
      {isModalOpen && (
        <div className="eauction-modal-overlay" onClick={handleCloseModal}>
          <div
            className="eauction-portal-container"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eauction-portal-title"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top header bar */}
            <div className="eauction-portal-header">
              <div className="eauction-brand">
                <div className="eauction-logo-icon" aria-hidden="true">e</div>
                <div>
                  <div className="eauction-portal-title" id="eauction-portal-title">eAuction Portal</div>
                  <div className="eauction-portal-subtitle">SAP Ariba Live Sourcing v2.1</div>
                </div>
              </div>

              <div className="eauction-project-banner">
                <span className="eauction-project-label">Current Sourcing Project:</span>
                <span className="eauction-project-name">Global IT Hardware Refresh</span>
              </div>

              <div className="eauction-header-actions">
                <span className="eauction-buyer">
                  <FaUser className="eauction-icon" aria-hidden="true" />
                  Buyer: <strong>Alice W.</strong>
                </span>
                <button
                  type="button"
                  className="eauction-portal-close"
                  onClick={handleCloseModal}
                  title="Close e-Auction Console"
                  aria-label="Close e-Auction Console"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Main portal body */}
            <div className={`eauction-portal-body eauction-mobile-${mobileView}`}>
              {/* Left sidebar filters */}
              <div className="eauction-left-sidebar">
                <div>
                  <div className="eauction-section-header">Live Auctions</div>
                  <div className="eauction-sidebar-menu">
                    <div
                      className="eauction-sidebar-item active"
                      aria-current="true"
                      {...sidebarItemProps}
                    >
                      <FaBolt className="eauction-icon" aria-hidden="true" /> Quick Links
                    </div>
                    <div className="eauction-sidebar-item" {...sidebarItemProps}>
                      <FaBoxes className="eauction-icon" aria-hidden="true" /> Quick Lots
                    </div>
                    <div className="eauction-sidebar-item" {...sidebarItemProps}>
                      <FaMobileAlt className="eauction-icon" aria-hidden="true" /> Applications
                    </div>
                    <div className="eauction-sidebar-item" {...sidebarItemProps}>
                      <FaAddressBook className="eauction-icon" aria-hidden="true" /> Contacts
                    </div>
                  </div>
                </div>

                <div>
                  <div className="eauction-section-header">Filters</div>
                  <div className="eauction-filter-group">
                    <label className="eauction-filter-checkbox">
                      <input type="checkbox" defaultChecked /> Closing In
                    </label>
                    <label className="eauction-filter-checkbox">
                      <input type="checkbox" /> My Max Bid
                    </label>
                    <label className="eauction-filter-checkbox">
                      <input type="checkbox" /> Flashing Item
                    </label>
                    <label className="eauction-filter-checkbox">
                      <input type="checkbox" /> My Current Bid
                    </label>
                  </div>
                </div>

                <div className="eauction-sidebar-footer">
                  <div className="eauction-section-header">RFx Requests</div>
                  <div className="eauction-sidebar-note">
                    3 Active RFQ Live Tenders
                  </div>
                </div>
              </div>

              {/* Main content workspace */}
              <div className="eauction-main-content">
                <button
                  type="button"
                  className="eauction-back-to-list"
                  onClick={() => setMobileView("list")}
                  aria-label="Back to live auctions menu"
                >
                  <FaChevronLeft aria-hidden="true" /> Back
                </button>

                {/* Active bids & rank grid */}
                <div className="eauction-panel-light">
                  <div className="eauction-panel-head">
                    <div className="eauction-panel-title-text">My active bids &amp; ranks</div>
                    <span className="eauction-realtime-tag">
                      <span className="eauction-live-dot" aria-hidden="true" />
                      Real-time table active
                    </span>
                  </div>

                  <div className="eauction-table-wrap">
                    <table className="eauction-table">
                      <thead>
                        <tr>
                          <th scope="col">#</th>
                          <th scope="col">Item ID/Name</th>
                          <th scope="col">Category</th>
                          <th scope="col">Closing In</th>
                          <th scope="col" className="eauction-num">Current Lead Bid</th>
                          <th scope="col">Rank #1 Lead</th>
                          <th scope="col">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {mockAuctions.map((auc, idx) => (
                          <tr
                            key={auc.id}
                            className={`eauction-row${auc.id === selectedLot.id ? ' eauction-row--selected' : ''}`}
                            tabIndex={0}
                            aria-selected={auc.id === selectedLot.id}
                            onClick={() => setSelectedLot(auc)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && e.target === e.currentTarget) setSelectedLot(auc);
                            }}
                          >
                            <td className="eauction-cell-muted">{idx + 1}</td>
                            <td>
                              <div className="eauction-item-name">{auc.name}</div>
                              <div className="eauction-item-code sila-ref">{auc.itemCode}</div>
                            </td>
                            <td>{auc.category}</td>
                            <td>
                              <span className="eauction-timer">{auc.closingIn}</span>
                            </td>
                            <td className="eauction-num">
                              <span className="eauction-bid-price">{auc.currentBid}</span>
                            </td>
                            <td>
                              <span className={`eauction-rank-badge rank-${auc.userRank}`}>
                                {auc.userRank}
                              </span>
                              <span className="eauction-lead-supplier">
                                {auc.leadSupplier}
                              </span>
                            </td>
                            <td>
                              <button type="button" className="eauction-action-btn">View lot</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Split bottom workspace */}
                <div className="eauction-grid-split">
                  {/* Left column: live bidding view & messaging */}
                  <div className="eauction-panel-light eauction-panel-column">
                    <div className="eauction-panel-head">
                      <div className="eauction-panel-title-text">
                        Live bidding view: <span className="eauction-panel-title-accent">{selectedLot.name}</span>
                      </div>
                      <span className="eauction-realtime-tag eauction-realtime-tag--info">Live messaging active</span>
                    </div>

                    {/* Live leaderboard */}
                    <div className="eauction-bids-overlay-card">
                      <div className="eauction-bids-title">Live supplier bids leaderboard</div>
                      <div className="eauction-leaderboard-grid">
                        {mockLeaderboard.map((bid) => (
                          <div
                            key={bid.rank}
                            className={`eauction-leader-card${bid.rank === 1 ? ' eauction-leader-card--lead' : ''}`}
                          >
                            <div className="eauction-leader-head">
                              <span className={`eauction-rank-badge rank-${bid.rank}`}>{bid.rank}</span>
                              <span className="eauction-leader-amount">{bid.bidAmount}</span>
                            </div>
                            <div className="eauction-leader-name" title={bid.supplierName}>
                              {bid.supplierName}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Live chat discussion */}
                    <div className="eauction-chat">
                      <div className="eauction-chat-timeline" aria-live="polite">
                        {chatMessages.map((msg) => (
                          <div key={msg.id} className="eauction-chat-msg">
                            <div className={`eauction-chat-avatar ${msg.avatarClass}`} aria-hidden="true">
                              {msg.sender.charAt(0)}
                            </div>
                            <div className="eauction-chat-content">
                              <div className="eauction-chat-meta">
                                <strong className="eauction-chat-sender">{msg.sender}</strong>
                                <span className="eauction-chat-time">{msg.time}</span>
                              </div>
                              <div className="eauction-chat-text">{msg.text}</div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Chat input */}
                      <div className="eauction-chat-compose">
                        <input
                          type="text"
                          className="sila-input eauction-chat-input"
                          placeholder="Broadcast message to live e-Auction bidders..."
                          aria-label="Broadcast message to live e-Auction bidders"
                          value={newMessageText}
                          onChange={(e) => setNewMessageText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                        />
                        <button
                          type="button"
                          className="sila-btn sila-btn--primary"
                          onClick={handleSendMessage}
                        >
                          Send
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right column: awarding panel & history */}
                  <div className="eauction-panel-light eauction-panel-column eauction-award-panel">
                    <div className="eauction-panel-title-text">Awarding panel</div>

                    <div className="eauction-award-box">
                      <div className="eauction-overline">
                        Ranked suppliers for award
                      </div>

                      <div className="eauction-award-target">
                        <div className="eauction-award-label">Award lot to:</div>
                        <div className="eauction-award-supplier">
                          <FaTrophy className="eauction-icon eauction-icon--success" aria-hidden="true" />
                          <span>{selectedLot.leadSupplier} ({selectedLot.currentBid})</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="eauction-btn-confirm"
                        onClick={handleConfirmAward}
                      >
                        {awardedSupplier === selectedLot.leadSupplier ? (
                          <>
                            <FaCheck className="eauction-icon" aria-hidden="true" /> Award confirmed
                          </>
                        ) : (
                          'Confirm award'
                        )}
                      </button>
                    </div>

                    <div className="eauction-history">
                      <div className="eauction-overline">
                        Award history
                      </div>
                      <div className="eauction-history-list">
                        <div className="eauction-history-item">
                          <strong>Lot 4010: Office Supplies</strong>
                          <div className="eauction-history-status">Awarded to Staples Business</div>
                        </div>
                        <div className="eauction-history-item">
                          <strong>Lot 4008: IT Hardware Refurbish</strong>
                          <div className="eauction-history-status">Awarded to Meridian Logistics</div>
                        </div>
                      </div>
                    </div>

                    <div className="eauction-award-actions">
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        onClick={() => alert("Award Notification dispatched to all participating bidders!")}
                      >
                        Post &amp; notify
                      </button>
                      <button
                        type="button"
                        className="sila-btn sila-btn--primary sila-btn--sm"
                        onClick={() => alert("SAP Ariba Award Contract PDF generated successfully!")}
                      >
                        Generate contract
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EAuctionWidget;
