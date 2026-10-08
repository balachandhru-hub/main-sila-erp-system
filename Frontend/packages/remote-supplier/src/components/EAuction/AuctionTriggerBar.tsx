import React from "react";
import { FaArrowRight, FaBolt } from "react-icons/fa";
import type { LiveAuctionItem } from "../../hooks/useLiveBids";

interface AuctionTriggerBarProps {
  selectedLot: LiveAuctionItem | null;
  totalAuctions: number;
  isHovered: boolean;
  isModalOpen: boolean;
  onHoverChange: (hovered: boolean) => void;
  onOpen: () => void;
}

const AuctionTriggerBar: React.FC<AuctionTriggerBarProps> = ({
  selectedLot,
  totalAuctions,
  isHovered,
  isModalOpen,
  onHoverChange,
  onOpen,
}) => {
  return (
    <div
      className="eauction-floating-bar"
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      {/* Hover Popover Preview Card */}
      {isHovered && !isModalOpen && (
        <div className="eauction-preview-popover">
          <div className="eauction-preview-header">
            <div className="eauction-preview-title">
              <FaBolt aria-hidden="true" />
              <span>Live e-Auction Bidding</span>
            </div>
            <span className="eauction-live-status">Live reverse auction</span>
          </div>

          {selectedLot ? (
            <div className="eauction-preview-item">
              <div className="eauction-preview-item-title">{selectedLot.name}</div>
              <div className="eauction-preview-meta">
                <span>Code: <strong className="eauction-bid-price">{selectedLot.itemCode}</strong></span>
                <span>Closing: <strong className="eauction-timer">{selectedLot.formattedEndDate}</strong></span>
              </div>
            </div>
          ) : (
            <div className="eauction-preview-item">
              <div className="eauction-preview-item-title eauction-preview-empty">
                No active live bids available
              </div>
            </div>
          )}

          <button
            type="button"
            className="eauction-enter-btn"
            onClick={onOpen}
          >
            <span>Enter Supplier Bidding Console</span>
            <FaArrowRight aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Floating Bar Button */}
      <button
        type="button"
        className="eauction-trigger-btn"
        onClick={onOpen}
        title="Open Live e-Auction Bidding Console"
      >
        <span className="eauction-pulse-dot" aria-hidden="true" />
        <FaBolt aria-hidden="true" className="eauction-trigger-icon" />
        <span>Live e-Auction</span>
        <span className="eauction-badge-count">{totalAuctions} Live</span>
      </button>
    </div>
  );
};

export default AuctionTriggerBar;
