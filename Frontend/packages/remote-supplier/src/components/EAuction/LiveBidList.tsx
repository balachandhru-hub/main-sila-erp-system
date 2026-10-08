import React from "react";
import type { LiveAuctionItem } from "../../hooks/useLiveBids";
import { LIVE_BIDS_PAGE_SIZE } from "../../hooks/useLiveBids";

const IconChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

interface LiveBidListProps {
  auctions: LiveAuctionItem[];
  selectedLot: LiveAuctionItem | null;
  onSelectLot: (lot: LiveAuctionItem) => void;
  loadingApi: boolean;
  currentPage: number;
  totalAuctions: number;
  hasNextPage: boolean;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const LiveBidList: React.FC<LiveBidListProps> = ({
  auctions,
  selectedLot,
  onSelectLot,
  loadingApi,
  currentPage,
  totalAuctions,
  hasNextPage,
  onPrevPage,
  onNextPage,
}) => {
  return (
    <aside className="eauction-sidebar">
      <div className="eauction-sidebar-header">
        <div className="eauction-panel-title-text">My live bid status &amp; ranks</div>
        <span className="eauction-live-pill"><span className="eauction-live-pill-dot" aria-hidden="true" />Real-time bidding active</span>
      </div>

      <div className="eauction-sidebar-list">
        {loadingApi ? (
          <div className="eauction-sidebar-status">Loading live bid status...</div>
        ) : auctions.length === 0 ? (
          <div className="eauction-empty-state">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span className="eauction-empty-title">No live bids found</span>
            <span className="eauction-empty-subtitle">There are currently no active live auctions available for your account.</span>
          </div>
        ) : (
          auctions.map((auc) => {
            const isSelected = Boolean(selectedLot && auc.id === selectedLot.id);
            return (
              <div
                key={auc.id}
                className={`eauction-sidebar-item${isSelected ? ' is-selected' : ''}`}
                onClick={() => onSelectLot(auc)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelectLot(auc);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
              >
                <div className="eauction-sidebar-item-title">{auc.name}</div>
                <div className="eauction-sidebar-item-code sila-ref">{auc.itemCode}</div>
              </div>
            );
          })
        )}
      </div>

      {/* Pagination Bar */}
      {auctions.length > 0 && (() => {
        const startItem = (currentPage - 1) * LIVE_BIDS_PAGE_SIZE + 1;
        const endItem = (currentPage - 1) * LIVE_BIDS_PAGE_SIZE + auctions.length;
        const canGoPrev = currentPage > 1;
        const canGoNext = hasNextPage;

        return (
          <div className="eauction-sidebar-footer">
            <div className="eauction-pagination-bar">
              <div className="eauction-pagination-info">
                <strong>{startItem}</strong>–<strong>{endItem}</strong> of <strong>{Math.max(totalAuctions, endItem)}</strong>
              </div>

              <div className="eauction-pagination-controls">
                <button
                  type="button"
                  className={`eauction-page-btn${!canGoPrev ? ' is-disabled' : ''}`}
                  onClick={() => canGoPrev && onPrevPage()}
                  disabled={!canGoPrev}
                  aria-label="Previous page"
                >
                  <IconChevronLeft />
                </button>

                <span className="eauction-page-btn is-current" aria-current="page">
                  {currentPage}
                </span>

                <button
                  type="button"
                  className={`eauction-page-btn${!canGoNext ? ' is-disabled' : ''}`}
                  onClick={() => canGoNext && onNextPage()}
                  disabled={!canGoNext}
                  aria-label="Next page"
                >
                  <IconChevronRight />
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </aside>
  );
};

export default LiveBidList;
