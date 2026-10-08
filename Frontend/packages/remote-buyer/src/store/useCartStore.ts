import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { BuyerCatalogResponse } from '../api/Buyerapi';
import type { PersonalWishlistItem } from '../api/personalWishlistApi';

/** A Product Catalog product in the cart, waiting to go to a personal wishlist or the weekly bucket. */
export interface CartProduct {
  catalogId: string;
  catalogName: string;
  sku: string | null;
  supplierName: string;
  price: number;
  currency: string;
  unitOfMeasure: string;
  discountPercent: number | null;
  /** The supplier's stock when the product was added to the cart. */
  availableStock: number | null;
  /** First image of the product, loaded on demand for the cart thumbnail. */
  imageAssetId: string | null;
  quantity: number;
}

export interface CartState {
  products: CartProduct[];
  addProduct: (product: BuyerCatalogResponse) => void;
  /** Adds personal wishlist items with their quantities; a product already in the cart has its quantity increased. */
  addWishlistItems: (items: PersonalWishlistItem[]) => void;
  removeProducts: (catalogIds: string[]) => void;
  setQuantity: (catalogId: string, quantity: number) => void;
  clear: () => void;
}

// Catalog, cart, wishlist and weekly bucket are separate dashboard sections, so the cart lives here instead of
// in any one component. It is kept in sessionStorage so a page reload does not empty it; logout clears it.
export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      products: [],

      addProduct: (product) => {
        set((state) => {
          if (state.products.some((item) => item.catalogId === product.catalogId)) return state;
          return {
            products: [
              ...state.products,
              {
                catalogId: product.catalogId,
                catalogName: product.catalogName,
                sku: product.sku ?? null,
                supplierName: product.supplierName,
                price: product.price,
                currency: product.currency,
                unitOfMeasure: product.unitOfMeasure,
                discountPercent: product.discountPercent ?? null,
                availableStock: product.availableStock ?? null,
                imageAssetId: product.asset?.[0]?.id ?? null,
                quantity: 1,
              },
            ],
          };
        });
      },

      addWishlistItems: (items) => {
        set((state) => {
          const products = [...state.products];
          items.forEach((item) => {
            const index = products.findIndex((product) => product.catalogId === item.catalogId);
            if (index >= 0) {
              products[index] = { ...products[index], quantity: products[index].quantity + item.quantity };
              return;
            }
            products.push({
              catalogId: item.catalogId,
              catalogName: item.productName,
              sku: item.sku ?? null,
              supplierName: item.supplierName ?? '',
              price: item.price ?? 0,
              currency: item.currency ?? '',
              unitOfMeasure: item.unitOfMeasure ?? '',
              discountPercent: item.discountPercent ?? null,
              availableStock: null,
              imageAssetId: null,
              quantity: item.quantity,
            });
          });
          return { products };
        });
      },

      removeProducts: (catalogIds) => {
        set((state) => ({ products: state.products.filter((item) => !catalogIds.includes(item.catalogId)) }));
      },

      setQuantity: (catalogId, quantity) => {
        set((state) => ({
          products: state.products.map((item) => (item.catalogId === catalogId ? { ...item, quantity } : item)),
        }));
      },

      clear: () => {
        set({ products: [] });
      },
    }),
    {
      name: 'vosox-buyer-cart',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ products: state.products }),
    },
  ),
);

if (typeof window !== 'undefined') {
  window.addEventListener('session:expired', () => {
    useCartStore.getState().clear();
  });
}
