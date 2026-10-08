import React, { useCallback, useEffect, useState } from "react";
import { Button, Input, PageHeader, Table, toastService } from "@vosox/shared-ui";
import type { TableColumn } from "@vosox/shared-ui";
import {
  createPersonalWishlist,
  getPersonalWishlists,
  type PersonalWishlistListItem,
} from "../../api/personalWishlistApi";
import { formatDate } from "../cart/lineFormat";
import PersonalWishlistDetail from "./PersonalWishlistDetail";
import "./WishlistSection.css";

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

  const columns: TableColumn<PersonalWishlistListItem>[] = [
    { id: "name", header: "Name", accessorKey: "name", width: "40%", className: "sila-cell-strong" },
    { id: "items", header: "Items", accessorKey: "itemCount", width: "15%" },
    { id: "updated", header: "Updated", width: "25%", cell: ({ row }) => formatDate(row.dateUpdated || row.dateCreated) },
    {
      id: "actions",
      header: "Actions",
      width: "20%",
      align: "center",
      cell: ({ row }) => (
        <Button type="button" variant="secondary" size="sm" onClick={(event) => {
          event.stopPropagation();
          setOpenId(row.id);
        }}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <div className="sila-card">
      <div className="sila-card-body pud-wishlist-body">
      <PageHeader
        className="pud-page-header"
        title="Wishlists"
        description="Your saved lists of catalog products. Open a list to review its items or move them to the cart."
        actions={!creating ? (
          <Button type="button" variant="primary" onClick={() => setCreating(true)}>
            New wishlist
          </Button>
        ) : undefined}
      />

      {creating && (
        <form className="sila-card" onSubmit={handleCreate}>
          <div className="sila-card-body">
            <div className="sila-form-grid">
              <Input
                id="wishlist-new-name"
                label="Name"
                required
                autoFocus
                value={name}
                maxLength={200}
                onChange={(event) => setName(event.target.value)}
              />
            </div>
          </div>
          <div className="sila-card-footer">
            <Button type="button" variant="secondary" onClick={() => setCreating(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" loading={saving}>
              {saving ? "Saving..." : "Create wishlist"}
            </Button>
          </div>
        </form>
      )}

        <Table<PersonalWishlistListItem>
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          onRowClick={(row) => setOpenId(row.id)}
          loading={loading}
          loadingLabel="Loading wishlists..."
          error={error ?? undefined}
          errorAction={<Button type="button" variant="secondary" onClick={load}>Try again</Button>}
          emptyState={{ title: "No wishlists yet", description: 'Use "New wishlist", or add products to one from the cart.' }}
          bordered
        />
      </div>
    </div>
  );
};

export default WishlistSection;
