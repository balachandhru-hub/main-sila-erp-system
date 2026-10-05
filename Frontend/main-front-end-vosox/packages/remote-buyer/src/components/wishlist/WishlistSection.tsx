import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, PageHeader, toastService } from "@vosox/shared-ui";
import {
  createPersonalWishlist,
  getPersonalWishlists,
  type PersonalWishlistListItem,
} from "../../api/personalWishlistApi";
import { formatDate } from "../cart/lineFormat";
import PersonalWishlistDetail from "./PersonalWishlistDetail";

interface WishlistSectionProps {
  /** Opens the cart, where wishlist items go on their way to the weekly bucket. */
  onOpenCart?: () => void;
}

/** Personal wishlists: named lists of catalog products owned by the signed-in user. No approval, no purchasing. */
const WishlistSection: React.FC<WishlistSectionProps> = ({ onOpenCart }) => {
  const [rows, setRows] = useState<PersonalWishlistListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getPersonalWishlists());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not load wishlists.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (openId === null) load();
  }, [openId, load]);

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim()) {
      toastService.error("Enter a wishlist name.");
      return;
    }
    setSaving(true);
    try {
      await createPersonalWishlist({ name: name.trim(), description: null, items: [] });
      toastService.success("Wishlist created.");
      setCreating(false);
      setName("");
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not create the wishlist.");
    } finally {
      setSaving(false);
    }
  };

  if (openId) {
    return <PersonalWishlistDetail wishlistId={openId} onBack={() => setOpenId(null)} onOpenCart={onOpenCart} />;
  }

  return (
    <>
      <PageHeader
        className="pud-page-header"
        title="Wishlists"
        actions={!creating ? (
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setCreating(true)}>
            New wishlist
          </button>
        ) : undefined}
      />

      {creating && (
        <form className="sila-card" onSubmit={handleCreate}>
          <div className="sila-card-body">
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="wishlist-new-name">Name<span className="sila-required">*</span></label>
                <input
                  id="wishlist-new-name"
                  className="sila-input"
                  value={name}
                  maxLength={200}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="sila-card-footer">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="sila-btn sila-btn--primary" disabled={saving}>
              {saving ? "Saving..." : "Create wishlist"}
            </button>
          </div>
        </form>
      )}

      <section className="sila-card">
        {loading ? (
          <Loader size={24} message="Loading wishlists..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load wishlists"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No wishlists yet" description='Use "New wishlist", or add products to one from the cart.' />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Items</th>
                  <th scope="col">Updated</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="sila-cell-strong">{row.name}</td>
                    <td>{row.itemCount}</td>
                    <td>{formatDate(row.dateUpdated || row.dateCreated)}</td>
                    <td>
                      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setOpenId(row.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default WishlistSection;
