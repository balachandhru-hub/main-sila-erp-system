import React from "react";
import type { DropdownValue, DropdownLoadParams, DropdownLoadResult } from "@vosox/shared-ui";
import { Button, CloseIcon, Dropdown, FilterIcon, Input } from "@vosox/shared-ui";
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
        <Button type="button" variant="ghost" size="sm" onClick={onMove}>
          Move {side === "left" ? "right" : "left"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="sila-btn--icon" onClick={onClose} aria-label="Close filters">
          <CloseIcon />
        </Button>
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
      <Input
        id="pud-product-supplier"
        label="Supplier"
        type="text"
        placeholder="Supplier name or SNID"
        value={filters.supplier}
        onChange={(e) => onSupplierChange(e as React.ChangeEvent<HTMLInputElement>)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onApply();
        }}
      />
    </div>

    <div className="pud-catalog-drawer-actions">
      <Button type="button" variant="primary" size="sm" onClick={onApply} disabled={loadingResults}>
        Apply filters
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onClear} disabled={loadingResults}>
        Clear all
      </Button>
    </div>
  </aside>
);

export default ProductFilters;
