import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, toastService } from "@vosox/shared-ui";
import {
  deletePersonalWishlist,
  deletePersonalWishlistItem,
  getPersonalWishlist,
  setPersonalWishlistItemQuantity,
  updatePersonalWishlist,
  type PersonalWishlist,
  type PersonalWishlistItem,
} from "../../api/personalWishlistApi";
import { useCartStore } from "../../store/useCartStore";
import QuantityInput from "../cart/QuantityInput";
import { formatDiscount, formatPrice } from "../cart/lineFormat";

interface PersonalWishlistDetailProps {
  wishlistId: string;
  onBack: () => void;
  onOpenCart?: () => void;
}

/** One personal wishlist: rename, delete, change its items, and send items to the cart. */
const PersonalWishlistDetail: React.FC<PersonalWishlistDetailProps> = ({ wishlistId, onBack, onOpenCart }) => {
  const cartCount = useCartStore((state) => state.products.length);
  const addWishlistItems = useCartStore((state) => state.addWishlistItems);

  const [wishlist, setWishlist] = useState<PersonalWishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const load = useCallback(async (showLoader: boolean) => {
    if (showLoader) setLoading(true);
    setError(null);
    try {
      setWishlist(await getPersonalWishlist(wishlistId));
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Could not load this wishlist.";
      // A failed refresh keeps the list on screen; a failed first load has nothing to show.
      if (showLoader) setError(message);
      else toastService.error(message);
    } finally {
      if (showLoader) setLoading(false);
    }
  }, [wishlistId]);

  useEffect(() => {
    load(true);
  }, [load]);

  const closeDelete = useCallback(() => setConfirmingDelete(false), []);

  if (loading) return <Loader size={24} message="Loading wishlist..." />;
  if (error || !wishlist) {
    return (
      <>
        <PageHeader className="pud-page-header" title="Wishlist" onBack={onBack} backLabel="Back to wishlists" />
        <section className="sila-card">
          <EmptyState
            variant="error"
            title="Couldn't load this wishlist"
            description={error ?? undefined}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={() => load(true)}>Try again</button>}
          />
        </section>
      </>
    );
  }

  const items = wishlist.items;
  const selectedItems = items.filter((item) => selectedIds.includes(item.id));
  const allSelected = items.length > 0 && selectedItems.length === items.length;

  const toggleItem = (itemId: string) => {
    setSelectedIds((current) => (current.includes(itemId) ? current.filter((id) => id !== itemId) : [...current, itemId]));
  };

  const run = async (action: () => Promise<void>, fallback: string) => {
    setBusy(true);
    try {
      await action();
      await load(false);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toastService.error("Enter a wishlist name.");
      return;
    }
    await run(async () => {
      await updatePersonalWishlist(wishlist.id, { name: name.trim(), description: wishlist.description ?? null });
      toastService.success("Wishlist renamed.");
      setRenaming(false);
    }, "Could not update the wishlist.");
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deletePersonalWishlist(wishlist.id);
      toastService.success("Wishlist deleted.");
      onBack();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not delete the wishlist.");
      setBusy(false);
      setConfirmingDelete(false);
    }
  };

  const handleRemoveItem = (item: PersonalWishlistItem) =>
    run(async () => {
      await deletePersonalWishlistItem(wishlist.id, item.id);
      setSelectedIds((current) => current.filter((id) => id !== item.id));
    }, "Could not remove the product.");

  const handleAddToCart = (cartItems: PersonalWishlistItem[]) => {
    addWishlistItems(cartItems);
    toastService.success(`${cartItems.length} product${cartItems.length === 1 ? "" : "s"} added to cart.`);
  };

  return (
    <>
      <PageHeader
        className="pud-page-header"
        title={wishlist.name}
        onBack={onBack}
        backLabel="Back to wishlists"
        actions={(
          <div className="sila-btn-group">
            <button
              type="button"
              className="sila-btn sila-btn--secondary"
              disabled={busy || renaming}
              onClick={() => {
                setName(wishlist.name);
                setRenaming(true);
              }}
            >
              Rename
            </button>
            <button type="button" className="sila-btn sila-btn--danger" disabled={busy} onClick={() => setConfirmingDelete(true)}>
              Delete
            </button>
            {onOpenCart && (
              <button type="button" className="sila-btn sila-btn--primary" onClick={onOpenCart}>
                Cart ({cartCount})
              </button>
            )}
          </div>
        )}
      />

      {renaming && (
        <form className="sila-card" onSubmit={handleRename}>
          <div className="sila-card-body">
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="wishlist-rename">Name<span className="sila-required">*</span></label>
                <input
                  id="wishlist-rename"
                  className="sila-input"
                  value={name}
                  maxLength={200}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="sila-card-footer">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setRenaming(false)} disabled={busy}>Cancel</button>
            <button type="submit" className="sila-btn sila-btn--primary" disabled={busy}>
              {busy ? "Saving..." : "Save name"}
            </button>
          </div>
        </form>
      )}

      <section className="sila-card">
        {items.length === 0 ? (
          <EmptyState title="No products in this wishlist" description="Add products to it from the cart." />
        ) : (
          <>
            <div className="sila-toolbar">
              <span className="sila-help">{selectedItems.length} of {items.length} selected</span>
              <div className="sila-toolbar-group">
                <button
                  type="button"
                  className="sila-btn sila-btn--secondary"
                  disabled={selectedItems.length === 0}
                  onClick={() => handleAddToCart(selectedItems)}
                >
                  Add selected to cart ({selectedItems.length})
                </button>
                <button type="button" className="sila-btn sila-btn--primary" onClick={() => handleAddToCart(items)}>
                  Add all to cart
                </button>
              </div>
            </div>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">
                      <input
                        type="checkbox"
                        aria-label="Select all products"
                        checked={allSelected}
                        onChange={() => setSelectedIds(allSelected ? [] : items.map((item) => item.id))}
                      />
                    </th>
                    <th scope="col">Product</th>
                    <th scope="col">SKU</th>
                    <th scope="col">Supplier</th>
                    <th scope="col">Price</th>
                    <th scope="col">Discount</th>
                    <th scope="col">Quantity</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${item.productName}`}
                          checked={selectedIds.includes(item.id)}
                          onChange={() => toggleItem(item.id)}
                        />
                      </td>
                      <td className="sila-cell-strong">{item.productName}</td>
                      <td>{item.sku || "—"}</td>
                      <td>{item.supplierName || "—"}</td>
                      <td>{formatPrice(item.price, item.currency)}{item.unitOfMeasure ? ` / ${item.unitOfMeasure}` : ""}</td>
                      <td>{formatDiscount(item.discountPercent)}</td>
                      <td>
                        <QuantityInput
                          value={item.quantity}
                          label={`Quantity of ${item.productName}`}
                          disabled={busy}
                          onCommit={(quantity) =>
                            run(() => setPersonalWishlistItemQuantity(wishlist.id, item.id, quantity), "Could not update the quantity.")}
                        />
                      </td>
                      <td>
                        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" disabled={busy} onClick={() => handleRemoveItem(item)}>
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={confirmingDelete}
        onClose={closeDelete}
        variant="danger"
        size="sm"
        headerProps={{ heading: "Delete wishlist" }}
        bodyProps={{ content: `Delete "${wishlist.name}"?`, contentDescription: "This cannot be undone." }}
        footerProps={{
          secondaryButton: { text: "Cancel", onClick: closeDelete, disabled: busy },
          primaryButton: { text: "Delete", onClick: handleDelete, loading: busy },
        }}
      />
    </>
  );
};

export default PersonalWishlistDetail;
