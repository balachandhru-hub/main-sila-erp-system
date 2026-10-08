import axiosInstance from "./axiosInstance";
import { readError } from "./readError";

/** A product and its quantity, as sent to a personal wishlist or the weekly bucket. */
export interface CatalogQuantity {
  catalogId: string;
  quantity: number;
}

export interface PersonalWishlistListItem {
  id: string;
  name: string;
  description?: string | null;
  itemCount: number;
  dateCreated: string;
  dateUpdated?: string | null;
}

export interface PersonalWishlistItem {
  id: string;
  catalogId: string;
  sku?: string | null;
  productName: string;
  description?: string | null;
  supplierId: string;
  supplierName?: string | null;
  unitOfMeasure?: string | null;
  price?: number | null;
  currency?: string | null;
  discountPercent?: number | null;
  quantity: number;
}

export interface PersonalWishlist {
  id: string;
  name: string;
  description?: string | null;
  dateCreated: string;
  dateUpdated?: string | null;
  items: PersonalWishlistItem[];
}

export interface PersonalWishlistCreate {
  name: string;
  description: string | null;
  items: CatalogQuantity[];
}

export interface PersonalWishlistUpdate {
  name: string;
  description: string | null;
}

const BASE = "/api/v1/buyer/personal-wishlists";

/** The signed-in user's wishlists. */
export const getPersonalWishlists = async (): Promise<PersonalWishlistListItem[]> => {
  try {
    const response = await axiosInstance.get<PersonalWishlistListItem[]>(BASE);
    return Array.isArray(response.data) ? response.data : [];
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load wishlists."));
  }
};

export const getPersonalWishlist = async (wishlistId: string): Promise<PersonalWishlist> => {
  try {
    const response = await axiosInstance.get<PersonalWishlist>(`${BASE}/${wishlistId}`);
    return { ...response.data, items: Array.isArray(response.data?.items) ? response.data.items : [] };
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not load this wishlist."));
  }
};

export const createPersonalWishlist = async (payload: PersonalWishlistCreate): Promise<void> => {
  try {
    await axiosInstance.post(BASE, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not create the wishlist."));
  }
};

export const updatePersonalWishlist = async (wishlistId: string, payload: PersonalWishlistUpdate): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/${wishlistId}`, payload);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the wishlist."));
  }
};

export const deletePersonalWishlist = async (wishlistId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${BASE}/${wishlistId}`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not delete the wishlist."));
  }
};

/** A product already in the wishlist has its quantity increased. */
export const addPersonalWishlistItems = async (wishlistId: string, items: CatalogQuantity[]): Promise<void> => {
  try {
    await axiosInstance.post(`${BASE}/${wishlistId}/items`, { items });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not add the products to the wishlist."));
  }
};

export const setPersonalWishlistItemQuantity = async (
  wishlistId: string,
  itemId: string,
  quantity: number,
): Promise<void> => {
  try {
    await axiosInstance.put(`${BASE}/${wishlistId}/items/${itemId}`, { quantity });
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not update the quantity."));
  }
};

export const deletePersonalWishlistItem = async (wishlistId: string, itemId: string): Promise<void> => {
  try {
    await axiosInstance.delete(`${BASE}/${wishlistId}/items/${itemId}`);
  } catch (error: unknown) {
    throw new Error(readError(error, "Could not remove the product."));
  }
};
