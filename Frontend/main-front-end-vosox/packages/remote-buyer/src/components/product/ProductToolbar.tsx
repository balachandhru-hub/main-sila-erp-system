import React from "react";
import { FilterIcon, LoaderIcon, SearchIcon } from "@vosox/shared-ui";
import { PRODUCT_PAGE_SIZES, PRODUCT_SORT_OPTIONS, type ProductSort } from "./types";

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
      <label className="pud-product-filter-label" htmlFor="pud-product-sort">Sort</label>
      <select
        id="pud-product-sort"
        className="sila-select"
        value={sort}
        disabled={loading}
        onChange={(e) => onSortChange(e.target.value as ProductSort)}
      >
        {PRODUCT_SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>

    <div className="pud-catalog-toolbar-select">
      <label className="pud-product-filter-label" htmlFor="pud-product-page-size">Per page</label>
      <select
        id="pud-product-page-size"
        className="sila-select"
        value={pageSize}
        disabled={loading}
        onChange={(e) => onPageSizeChange(Number(e.target.value))}
      >
        {PRODUCT_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>{size}</option>
        ))}
      </select>
    </div>
  </div>
);

export default ProductToolbar;
