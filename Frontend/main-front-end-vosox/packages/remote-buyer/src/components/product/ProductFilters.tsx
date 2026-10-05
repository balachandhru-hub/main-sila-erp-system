import React from "react";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "@vosox/shared-ui";
import { CloseIcon, Dropdown, FilterIcon } from "@vosox/shared-ui";
import type { ProductFilterState } from "./types";
import type { FilterDrawerSide } from "./useFilterDrawer";

interface ProductFiltersProps {
  id: string;
  side: FilterDrawerSide;
  filters: ProductFilterState;
  selectedSegment: DropdownValue | null;
  selectedFamily: DropdownValue | null;
  selectedClass: DropdownValue | null;
  selectedCommodity: DropdownValue | null;
  loadSegmentOptions: (params: DropdownLoadParams) => Promise<DropdownLoadResult>;
  loadFamilyOptions: (params: DropdownLoadParams) => Promise<DropdownLoadResult>;
  loadClassOptions: (params: DropdownLoadParams) => Promise<DropdownLoadResult>;
  loadCommodityOptions: (params: DropdownLoadParams) => Promise<DropdownLoadResult>;
  onSegmentChange: (val: DropdownValue | null) => void;
  onFamilyChange: (val: DropdownValue | null) => void;
  onClassChange: (val: DropdownValue | null) => void;
  onCommodityChange: (val: DropdownValue | null) => void;
  onSupplierChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onApply: () => void;
  onClear: () => void;
  onMove: () => void;
  onClose: () => void;
  loadingResults: boolean;
}

/** The catalog's filter drawer: classification levels and supplier; it can be closed or moved to the other side. */
const ProductFilters: React.FC<ProductFiltersProps> = ({
  id,
  side,
  filters,
  selectedSegment,
  selectedFamily,
  selectedClass,
  selectedCommodity,
  loadSegmentOptions,
  loadFamilyOptions,
  loadClassOptions,
  loadCommodityOptions,
  onSegmentChange,
  onFamilyChange,
  onClassChange,
  onCommodityChange,
  onSupplierChange,
  onApply,
  onClear,
  onMove,
  onClose,
  loadingResults,
}) => (
  <aside id={id} className="pud-catalog-drawer" aria-label="Product filters">
    <div className="pud-catalog-drawer-header">
      <span className="pud-product-filter-title">
        <FilterIcon /> Filters
      </span>
      <div className="pud-catalog-drawer-tools">
        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={onMove}>
          Move {side === "left" ? "right" : "left"}
        </button>
        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon" onClick={onClose} aria-label="Close filters">
          <CloseIcon />
        </button>
      </div>
    </div>

    <div className="pud-catalog-drawer-fields">
      <Dropdown
        label="Segment"
        placeholder="Select Segment"
        isAsync
        loadOptions={loadSegmentOptions}
        value={selectedSegment}
        onChange={onSegmentChange}
      />
      <Dropdown
        label="Family"
        placeholder={!filters.segment ? "Select Segment first" : "Select Family"}
        isDisable={!filters.segment}
        isAsync
        loadOptions={loadFamilyOptions}
        cacheUniques={[filters.segment]}
        value={selectedFamily}
        onChange={onFamilyChange}
      />
      <Dropdown
        label="Class"
        placeholder={!filters.family ? "Select Family first" : "Select Class"}
        isDisable={!filters.family}
        isAsync
        loadOptions={loadClassOptions}
        cacheUniques={[filters.family]}
        value={selectedClass}
        onChange={onClassChange}
      />
      <Dropdown
        label="Commodity"
        placeholder={!filters.class ? "Select Class first" : "Select Commodity"}
        isDisable={!filters.class}
        isAsync
        loadOptions={loadCommodityOptions}
        cacheUniques={[filters.class]}
        value={selectedCommodity}
        onChange={onCommodityChange}
      />
      <div className="pud-product-filter-field">
        <label className="pud-product-filter-label" htmlFor="pud-product-supplier">Supplier</label>
        <input
          id="pud-product-supplier"
          type="text"
          className="pud-product-search-input"
          placeholder="Supplier name or SNID"
          value={filters.supplier}
          onChange={onSupplierChange}
          onKeyDown={(e) => {
            if (e.key === "Enter") onApply();
          }}
        />
      </div>
    </div>

    <div className="pud-catalog-drawer-actions">
      <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={onApply} disabled={loadingResults}>
        Apply filters
      </button>
      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={onClear} disabled={loadingResults}>
        Clear all
      </button>
    </div>
  </aside>
);

export default ProductFilters;
