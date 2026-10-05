import React, { useState } from "react";

export type SilaDashboardTarget = "silaLiveInventory" | "silaTransfers";

interface SilaDashboardSearchProps {
  /** Opens another SILA ME screen; the search query goes to Live Inventory. */
  onNavigate: (key: SilaDashboardTarget, query?: string) => void;
  canTransfer: boolean;
}

const MIN_QUERY = 2;

/** Header of the control center: material search (Enter opens Live Inventory) and the transfer shortcuts. */
const SilaDashboardSearch: React.FC<SilaDashboardSearchProps> = ({ onNavigate, canTransfer }) => {
  const [query, setQuery] = useState("");
  const trimmed = query.trim();

  return (
    <div className="sila-btn-group sinv-dash-search">
      <form
        className="sinv-inline"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed.length >= MIN_QUERY) onNavigate("silaLiveInventory", trimmed);
        }}
      >
        <label className="sila-visually-hidden" htmlFor="sinv-dash-search">Search materials</label>
        <input
          id="sinv-dash-search"
          className="sila-input"
          type="search"
          placeholder="Search material code or name"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
      </form>
      <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("silaLiveInventory")}>
        Live Inventory
      </button>
      <button type="button" className="sila-btn sila-btn--secondary" onClick={() => onNavigate("silaTransfers")}>
        Open Transfer Center
      </button>
      {canTransfer && (
        <button type="button" className="sila-btn sila-btn--primary" onClick={() => onNavigate("silaTransfers")}>
          + Internal Transfer
        </button>
      )}
    </div>
  );
};

export default SilaDashboardSearch;
