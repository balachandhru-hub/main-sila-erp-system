import React from "react";
import { Dropdown, FilterIcon, LoaderIcon, SearchIcon } from "@vosox/shared-ui";
import { PRODUCT_PAGE_SIZES, PRODUCT_SORT_OPTIONS, type ProductSort } from "./types";

// A type alias (not DropdownValue) so it is assignable to both Dropdown's `options` and `value`.
type ToolbarOption = { name: string; value: string };

const SORT_DROPDOWN_OPTIONS: ToolbarOption[] = PRODUCT_SORT_OPTIONS.map((option) => ({
  name: option.label,
  value: option.value,
}));

const PAGE_SIZE_DROPDOWN_OPTIONS: ToolbarOption[] = PRODUCT_PAGE_SIZES.map((size) => ({
  name: String(size),
  value: String(size),
}));

interface ProductToolbarProps {
  search: string;
  sort: ProductSort;
  pageSize: number;
  filtersOpen: boolean;
  /** Id of the filter drawer, for aria-controls. */
  drawerId: string;
  activeFilterCount: number;
  loading: boolean;
  onSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSearchSubmit: () => void;
  onSortChange: (sort: ProductSort) => void;
  onPageSizeChange: (pageSize: number) => void;
  onToggleFilters: () => void;
}

/** Search box, filter drawer toggle, sort and page size above the product grid. */
const ProductToolbar: React.FC<ProductToolbarProps> = ({
  search,
  sort,
  pageSize,
  filtersOpen,
  drawerId,
  activeFilterCount,
  loading,
  onSearchChange,
  onSearchSubmit,
  onSortChange,
  onPageSizeChange,
  onToggleFilters,
}) => (
  <div className="pud-catalog-toolbar">
    <button
      type="button"
      className={`sila-btn ${filtersOpen ? "sila-btn--primary" : "sila-btn--secondary"}`}
      aria-expanded={filtersOpen}
      aria-controls={drawerId}
      onClick={onToggleFilters}
    >
      <FilterIcon />
      <span>Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}</span>
    </button>

    <form
      className="pud-catalog-toolbar-search"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearchSubmit();
      }}
    >
      <label className="sila-visually-hidden" htmlFor="pud-product-search">Search products</label>
      <input
        id="pud-product-search"
        type="search"
        className="pud-product-search-input"
        placeholder="Search by product name, description or supplier..."
        value={search}
        onChange={onSearchChange}
      />
      <button type="submit" className="pud-product-search-button" disabled={loading} aria-label="Search products">
        {loading ? <LoaderIcon className="pud-loader" /> : <SearchIcon />}
      </button>
    </form>

    <div className="pud-catalog-toolbar-select">
      <Dropdown
        label="Sort"
        options={SORT_DROPDOWN_OPTIONS}
        value={SORT_DROPDOWN_OPTIONS.find((option) => option.value === sort) ?? null}
        isDisable={loading}
        onChange={(selected) => {
          if (selected) onSortChange(selected.value as ProductSort);
        }}
      />
    </div>

    <div className="pud-catalog-toolbar-select">
      <Dropdown
        label="Per page"
        options={PAGE_SIZE_DROPDOWN_OPTIONS}
        value={PAGE_SIZE_DROPDOWN_OPTIONS.find((option) => option.value === String(pageSize)) ?? null}
        isDisable={loading}
        onChange={(selected) => {
          if (selected) onPageSizeChange(Number(selected.value));
        }}
      />
    </div>
  </div>
);

export default ProductToolbar;
