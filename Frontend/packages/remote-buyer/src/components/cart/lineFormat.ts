/** Display helpers shared by the cart, the personal wishlist and the weekly bucket tables. */

const EMPTY_VALUE = "—";

export const formatPrice = (price?: number | null, currency?: string | null): string => {
  if (price == null || !(price > 0)) return EMPTY_VALUE;
  return `${currency ?? ""} ${price}`.trim();
};

export const formatDiscount = (discountPercent?: number | null): string =>
  discountPercent != null && discountPercent > 0 ? `${discountPercent}%` : EMPTY_VALUE;

export const formatNumber = (value?: number | null): string => (value == null ? EMPTY_VALUE : String(value));

export const formatDate = (value?: string | null): string => {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

export const formatDateTime = (value?: string | null): string => {
  if (!value) return EMPTY_VALUE;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
};

/** Ids are GUIDs, which the services do not always return in the same letter case. */
export const sameId = (left?: string | null, right?: string | null): boolean =>
  Boolean(left && right && left.toLowerCase() === right.toLowerCase());
