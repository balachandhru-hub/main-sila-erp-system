import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import { getAllItemMasters, type ItemMasterDto } from "../../api/Buyerapi";
import { setCatalogMaterialMapping } from "../../api/propertyApi";
import type { WeeklyBucketItem } from "../../api/weeklyBucketApi";

interface MapMaterialDialogProps {
  buyerId: string;
  /** The bucket line whose product is mapped, or mapped again, to a material. */
  item: WeeklyBucketItem;
  /** Must be a stable callback: the dialog re-focuses itself whenever it changes. */
  onClose: () => void;
  onMapped: () => void;
}

const PAGE_SIZE = 20;

// The item-master endpoint has answered with a bare array and with the array wrapped in `data`.
const toItemMasters = (result: unknown): ItemMasterDto[] => {
  const outer = (result as { data?: unknown } | null)?.data;
  const inner = (outer as { data?: unknown } | null)?.data;
  const rows = inner ?? outer ?? result;
  return Array.isArray(rows) ? (rows as ItemMasterDto[]) : [];
};

/** Reviewer: maps the product of a bucket line to a material of the buyer's Item Master. */
const MapMaterialDialog: React.FC<MapMaterialDialogProps> = ({ buyerId, item, onClose, onMapped }) => {
  const [search, setSearch] = useState("");
  const [materials, setMaterials] = useState<ItemMasterDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Search runs on the server, shortly after the user stops typing.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      try {
        const result: unknown = await getAllItemMasters(buyerId, 0, PAGE_SIZE, search.trim() || undefined);
        if (active) setMaterials(toItemMasters(result));
      } catch (err: unknown) {
        if (active) setError(err instanceof Error ? err.message : "Could not load the Item Master.");
      } finally {
        if (active) setLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [buyerId, search]);

  const handleMap = async (material: ItemMasterDto) => {
    setSavingId(material.id);
    try {
      await setCatalogMaterialMapping(item.catalogId, material.id);
      toastService.success(`Mapped to ${material.materialCode}.`);
      onMapped();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not map the material.");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      headerProps={{ heading: "Map material", subHeading: item.productName }}
      footerProps={{ secondaryButton: { text: "Close", onClick: onClose, disabled: savingId !== null } }}
    >
      <div className="sila-root wb-dialog">
        <div className="sila-field">
          <label className="sila-label" htmlFor="wb-material-search">Search Item Master</label>
          <input
            id="wb-material-search"
            className="sila-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        {loading ? (
          <Loader size={24} message="Loading materials..." />
        ) : error ? (
          <EmptyState variant="error" title="Couldn't load the Item Master" description={error} />
        ) : materials.length === 0 ? (
          <EmptyState title="No materials found" />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Material</th>
                  <th scope="col">Description</th>
                  <th scope="col">Unit</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {materials.map((material) => (
                  <tr key={material.id}>
                    <td className="sila-cell-strong">{material.materialCode}</td>
                    <td>{material.description || "—"}</td>
                    <td>{material.orderUnitOfMeasure || material.baseUnitOfMeasure || "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        disabled={savingId !== null}
                        onClick={() => handleMap(material)}
                      >
                        {savingId === material.id ? "Mapping..." : "Map"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default MapMaterialDialog;
