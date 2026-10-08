export interface ProductFilterState {
  segment: number | "";
  family: number | "";
  class: number | "";
  commodity: number | "";
  search: string;
  /** Part of a supplier name or of its SNID. */
  supplier: string;
}

/** Server-side order of the catalog: name or price, ascending or descending. */
export type ProductSort = "name" | "name_desc" | "price" | "price_desc";

export const PRODUCT_SORT_OPTIONS: { value: ProductSort; label: string }[] = [
  { value: "name", label: "Name: A to Z" },
  { value: "name_desc", label: "Name: Z to A" },
  { value: "price", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
];

/** Products per page; the catalog is paged on the server, so large catalogs (20,000+ SKUs) stay fast. */
export const PRODUCT_PAGE_SIZES = [24, 48, 96] as const;
