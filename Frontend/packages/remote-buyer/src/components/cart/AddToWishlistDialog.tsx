import React, { useEffect, useState } from "react";
import { Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  addPersonalWishlistItems,
  createPersonalWishlist,
  getPersonalWishlists,
  type CatalogQuantity,
  type PersonalWishlistListItem,
} from "../../api/personalWishlistApi";

interface AddToWishlistDialogProps {
  /** The selected cart lines. */
  items: CatalogQuantity[];
  /** Must be a stable callback: the dialog re-focuses itself whenever it changes. */
  onClose: () => void;
  /** The lines are in the wishlist now. */
  onAdded: () => void;
}

const NEW_WISHLIST = "";

/** Cart → personal wishlist: a new wishlist (name required) or one of the user's existing ones. */
const AddToWishlistDialog: React.FC<AddToWishlistDialogProps> = ({ items, onClose, onAdded }) => {
  const [wishlists, setWishlists] = useState<PersonalWishlistListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targetId, setTargetId] = useState(NEW_WISHLIST);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getPersonalWishlists()
      .then((rows) => {
        if (active) setWishlists(rows);
      })
      .catch((err: unknown) => {
        // "New wishlist" stays available; the user is told why the existing ones are missing.
        if (active) setLoadError(err instanceof Error ? err.message : "Could not load wishlists.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async () => {
    if (targetId === NEW_WISHLIST && !name.trim()) {
      setError("Enter a wishlist name.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (targetId === NEW_WISHLIST) {
        await createPersonalWishlist({ name: name.trim(), description: null, items });
      } else {
        await addPersonalWishlistItems(targetId, items);
      }
      toastService.success("Added to the wishlist.");
      onAdded();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add the products to the wishlist.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="sm"
      headerProps={{ heading: "Add to Personal Wishlist", subHeading: `${items.length} product${items.length === 1 ? "" : "s"}` }}
      footerProps={{
        secondaryButton: { text: "Cancel", onClick: onClose, disabled: saving },
        primaryButton: { text: "Add to wishlist", onClick: handleSubmit, loading: saving, disabled: loading },
      }}
    >
      <div className="sila-root cart-dialog">
        {loading ? (
          <Loader size={24} message="Loading wishlists..." />
        ) : (
          <>
            {loadError && <div className="sila-alert sila-alert--warning" role="alert">{loadError}</div>}
            <div className="sila-field">
              <label className="sila-label" htmlFor="cart-wishlist-target">Wishlist</label>
              <select
                id="cart-wishlist-target"
                className="sila-select"
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value={NEW_WISHLIST}>New wishlist</option>
                {wishlists.map((wishlist) => (
                  <option key={wishlist.id} value={wishlist.id}>{wishlist.name}</option>
                ))}
              </select>
            </div>
            {targetId === NEW_WISHLIST && (
              <div className="sila-field">
                <label className="sila-label" htmlFor="cart-wishlist-name">Name<span className="sila-required">*</span></label>
                <input
                  id="cart-wishlist-name"
                  className="sila-input"
                  value={name}
                  maxLength={200}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            )}
            {error && <div className="sila-alert sila-alert--danger" role="alert">{error}</div>}
          </>
        )}
      </div>
    </Modal>
  );
};

export default AddToWishlistDialog;
