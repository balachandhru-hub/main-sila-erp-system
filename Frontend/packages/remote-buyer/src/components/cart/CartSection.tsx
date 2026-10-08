import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, FileIcon, PageHeader, isErrorResponse, toastService } from "@vosox/shared-ui";
import { fetchBuyerAsset } from "../../api/Buyerapi";
import type { CatalogQuantity } from "../../api/personalWishlistApi";
import { useCartStore } from "../../store/useCartStore";
import AddToBucketDialog from "./AddToBucketDialog";
import AddToWishlistDialog from "./AddToWishlistDialog";
import { formatDiscount, formatNumber, formatPrice } from "./lineFormat";
import "./CartSection.css";

interface CartSectionProps {
  /** Opens the weekly bucket the selected products were added to. */
  onOpenWeeklyBucket: () => void;
  /** Opens the Product Catalog, where products are added to the cart. */
  onBrowseCatalog: () => void;
}

/** The dialog keeps its own copy of the lines: they leave the cart as soon as they are added. */
interface CartDialog {
  target: "wishlist" | "bucket";
  items: CatalogQuantity[];
}

/** Cart: products added from the Product Catalog, which the user moves to a personal wishlist or the weekly bucket. */
const CartSection: React.FC<CartSectionProps> = ({ onOpenWeeklyBucket, onBrowseCatalog }) => {
  const products = useCartStore((state) => state.products);
  const removeProducts = useCartStore((state) => state.removeProducts);
  const setQuantity = useCartStore((state) => state.setQuantity);

  const [supplier, setSupplier] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [images, setImages] = useState<Record<string, string>>({});
  const [dialog, setDialog] = useState<CartDialog | null>(null);

  const suppliers = useMemo(
    () => Array.from(new Set(products.map((product) => product.supplierName).filter(Boolean))).sort(),
    [products],
  );
  const visibleProducts = supplier ? products.filter((product) => product.supplierName === supplier) : products;
  const selectedVisibleIds = visibleProducts
    .map((product) => product.catalogId)
    .filter((catalogId) => selectedIds.includes(catalogId));
  const allVisibleSelected = visibleProducts.length > 0 && selectedVisibleIds.length === visibleProducts.length;

  // Thumbnails: load each product's first image once.
  useEffect(() => {
    let active = true;
    products.forEach(async (product) => {
      const assetId = product.imageAssetId;
      if (!assetId || images[assetId]) return;
      try {
        const asset = await fetchBuyerAsset(assetId);
        if (!active || isErrorResponse(asset)) return;
        const src = asset.fileBytes
          ? `data:${asset.contentType || asset.fileType || "image/png"};base64,${asset.fileBytes}`
          : asset.url || asset.fileUrl;
        if (src) setImages((current) => ({ ...current, [assetId]: src }));
      } catch {
        // The row keeps its placeholder when the image cannot be loaded.
      }
    });
    return () => {
      active = false;
    };
  }, [products]);

  const toggleProduct = (catalogId: string) => {
    setSelectedIds((current) =>
      current.includes(catalogId) ? current.filter((id) => id !== catalogId) : [...current, catalogId],
    );
  };

  const toggleAllVisible = () => {
    const visibleIds = visibleProducts.map((product) => product.catalogId);
    setSelectedIds((current) =>
      allVisibleSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds])),
    );
  };

  const handleRemove = (catalogIds: string[]) => {
    removeProducts(catalogIds);
    setSelectedIds((current) => current.filter((id) => !catalogIds.includes(id)));
  };

  const openDialog = (target: CartDialog["target"]) => {
    const selected = products.filter((product) => selectedVisibleIds.includes(product.catalogId));
    if (selected.length === 0) {
      toastService.error("Select at least one product.");
      return;
    }
    if (selected.some((product) => !(product.quantity > 0))) {
      toastService.error("Enter a quantity greater than zero for every selected product.");
      return;
    }
    setDialog({
      target,
      items: selected.map((product) => ({ catalogId: product.catalogId, quantity: product.quantity })),
    });
  };

  const closeDialog = useCallback(() => setDialog(null), []);

  // The lines that were added leave the cart.
  const handleAdded = () => {
    if (dialog) handleRemove(dialog.items.map((item) => item.catalogId));
  };

  return (
    <>
      <PageHeader
        className="pud-page-header"
        title="Cart"
        actions={(
          <button type="button" className="sila-btn sila-btn--secondary" onClick={onBrowseCatalog}>
            Product Catalog
          </button>
        )}
      />
      <section className="sila-card">
        {products.length === 0 ? (
          <EmptyState
            title="Your cart is empty"
            description='Use "Add to cart" on products in the Product Catalog.'
            action={(
              <button type="button" className="sila-btn sila-btn--secondary" onClick={onBrowseCatalog}>
                Open Product Catalog
              </button>
            )}
          />
        ) : (
          <>
            <div className="sila-card-body">
              <div className="cart-toolbar">
                <div className="sila-field">
                  <label className="sila-label" htmlFor="cart-supplier">Supplier</label>
                  <select id="cart-supplier" className="sila-select" value={supplier} onChange={(event) => setSupplier(event.target.value)}>
                    <option value="">All suppliers</option>
                    {suppliers.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
                <div className="cart-toolbar-group">
                  <button
                    type="button"
                    className="sila-btn sila-btn--secondary"
                    onClick={() => openDialog("wishlist")}
                    disabled={selectedVisibleIds.length === 0}
                  >
                    Add to Personal Wishlist ({selectedVisibleIds.length})
                  </button>
                  <button
                    type="button"
                    className="sila-btn sila-btn--primary"
                    onClick={() => openDialog("bucket")}
                    disabled={selectedVisibleIds.length === 0}
                  >
                    Add to Weekly Bucket ({selectedVisibleIds.length})
                  </button>
                </div>
              </div>
            </div>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <input type="checkbox" aria-label="Select all products" checked={allVisibleSelected} onChange={toggleAllVisible} />
                    </th>
                    <th scope="col">Image</th>
                    <th scope="col">Product</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Unit</th>
                    <th scope="col">Price</th>
                    <th scope="col">Discount</th>
                    <th scope="col">Supplier stock</th>
                    <th scope="col">Quantity</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => {
                    const imageSrc = product.imageAssetId ? images[product.imageAssetId] : undefined;
                    return (
                      <tr key={product.catalogId}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Select ${product.catalogName}`}
                            checked={selectedIds.includes(product.catalogId)}
                            onChange={() => toggleProduct(product.catalogId)}
                          />
                        </td>
                        <td>
                          <div className="cart-thumb">
                            {imageSrc ? <img src={imageSrc} alt={product.catalogName} /> : <FileIcon />}
                          </div>
                        </td>
                        <td className="sila-cell-strong">{product.catalogName}</td>
                        <td>{product.sku || "—"}</td>
                        <td>{product.supplierName || "—"}</td>
                        <td>{product.unitOfMeasure || "—"}</td>
                        <td>{formatPrice(product.price, product.currency)}</td>
                        <td>{formatDiscount(product.discountPercent)}</td>
                        <td>{formatNumber(product.availableStock)}</td>
                        <td>
                          <input
                            className="sila-input cart-qty"
                            type="number"
                            min="0"
                            step="any"
                            aria-label={`Quantity of ${product.catalogName}`}
                            value={product.quantity}
                            onChange={(event) => setQuantity(product.catalogId, Number(event.target.value))}
                          />
                        </td>
                        <td>
                          <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" onClick={() => handleRemove([product.catalogId])}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {dialog?.target === "wishlist" && (
        <AddToWishlistDialog
          items={dialog.items}
          onClose={closeDialog}
          onAdded={() => {
            handleAdded();
            closeDialog();
          }}
        />
      )}
      {dialog?.target === "bucket" && (
        <AddToBucketDialog
          items={dialog.items}
          onClose={closeDialog}
          onAdded={handleAdded}
          onOpenWeeklyBucket={onOpenWeeklyBucket}
        />
      )}
    </>
  );
};

export default CartSection;
