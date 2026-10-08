import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Pagination, toastService } from "@vosox/shared-ui";
import {
  deleteItemMapping,
  downloadPosTemplate,
  getItemMappings,
  type SilaPosItemMapping,
  type SilaPosPage,
} from "../../../api/silaMe/silaPosMasterApi";
import SilaPosItemMappingForm from "./SilaPosItemMappingForm";
import SilaPosMappingImport from "./SilaPosMappingImport";
import { SilaPosConfirm, SilaPosSourceGate, SilaPosSourceSelect, defaultSourceId, type SilaPosSourceTabProps } from "./SilaPosShared";
import { errorText, posLabel } from "./posFormat";

const PAGE_SIZE = 25;

type Dialog = { kind: "edit"; mapping: SilaPosItemMapping | null } | { kind: "delete"; mapping: SilaPosItemMapping } | { kind: "import" };

/** POS item code → recipe, per POS source. Sales are consumed with the recipe's approved version. */
const SilaPosItemMappings: React.FC<SilaPosSourceTabProps> = (props) => {
  const { sources, canManage, onReloadSources } = props;
  const [sourceId, setSourceId] = useState(() => defaultSourceId(sources));
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SilaPosPage<SilaPosItemMapping> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!sources.some((source) => source.id === sourceId)) setSourceId(defaultSourceId(sources));
  }, [sources, sourceId]);

  const load = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getItemMappings(sourceId, appliedSearch, (page - 1) * PAGE_SIZE, PAGE_SIZE));
    } catch (err: unknown) {
      setData(null);
      setError(errorText(err, "Could not load the item mappings."));
    } finally {
      setLoading(false);
    }
  }, [sourceId, appliedSearch, page]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const afterChange = () => {
    setDialog(null);
    load();
    onReloadSources();
  };

  const handleDelete = async (mapping: SilaPosItemMapping) => {
    setDeleting(true);
    try {
      await deleteItemMapping(sourceId, mapping.id);
      toastService.success(`Mapping of POS item ${mapping.posItemCode} deleted.`);
      afterChange();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not delete the item mapping."));
    } finally {
      setDeleting(false);
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadPosTemplate("ITEMS");
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not download the template."));
    }
  };

  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <SilaPosSourceGate {...props} subject="item mappings">
      <div className="srec-stack">
        <div className="srec-filters spos-toolbar">
          <SilaPosSourceSelect id="spos-item-source" sources={sources} value={sourceId} onChange={(id) => { setSourceId(id); setPage(1); }} />
          <div className="sila-field srec-grow">
            <label className="sila-label" htmlFor="spos-item-search">Search</label>
            <input
              id="spos-item-search"
              className="sila-input"
              type="search"
              placeholder="POS item or recipe"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {canManage && (
            <div className="srec-actions">
              <button type="button" className="sila-btn sila-btn--ghost" onClick={handleTemplate}>Template</button>
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setDialog({ kind: "import" })}>Import Excel</button>
              <button type="button" className="sila-btn sila-btn--primary" onClick={() => setDialog({ kind: "edit", mapping: null })}>New mapping</button>
            </div>
          )}
        </div>

        {loading && !data ? (
          <Loader size={24} message="Loading item mappings..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the item mappings"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No item mappings" description="Unmapped POS items match the recipe with the same POS code." />
        ) : (
          <>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">POS item</th>
                    <th scope="col">Recipe</th>
                    <th scope="col">Recipe status</th>
                    <th scope="col">Sold version</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((mapping) => (
                    <tr key={mapping.id}>
                      <td>
                        <span className="sila-cell-strong">{mapping.posItemCode}</span>
                        {mapping.posItemDescription && <span className="srec-sub">{mapping.posItemDescription}</span>}
                      </td>
                      <td>
                        {mapping.recipeCode ?? "—"}
                        {mapping.recipeName && <span className="srec-sub">{mapping.recipeName}</span>}
                      </td>
                      <td>{posLabel(mapping.recipeStatus)}</td>
                      <td>
                        {mapping.recipeActiveVersion > 0 ? (
                          `Version ${mapping.recipeActiveVersion}`
                        ) : (
                          <span className="sila-badge sila-badge--warning sila-badge--sm">Not approved</span>
                        )}
                      </td>
                      <td>
                        {canManage && (
                          <div className="srec-actions">
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Edit mapping of POS item ${mapping.posItemCode}`} onClick={() => setDialog({ kind: "edit", mapping })}>
                              Edit
                            </button>
                            <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-label={`Delete mapping of POS item ${mapping.posItemCode}`} onClick={() => setDialog({ kind: "delete", mapping })}>
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onPrevious={() => setPage((current) => Math.max(1, current - 1))}
              onNext={() => setPage((current) => Math.min(totalPages, current + 1))}
              summary={`${data?.total ?? 0} mapping${data?.total === 1 ? "" : "s"}`}
              disabled={loading}
            />
          </>
        )}

        {dialog?.kind === "edit" && (
          <SilaPosItemMappingForm sourceId={sourceId} mapping={dialog.mapping} onClose={() => setDialog(null)} onSaved={afterChange} />
        )}
        {dialog?.kind === "import" && (
          <SilaPosMappingImport sourceId={sourceId} kind="ITEMS" onClose={() => setDialog(null)} onImported={afterChange} />
        )}
        {dialog?.kind === "delete" && (
          <SilaPosConfirm
            heading="Delete item mapping"
            content={`Delete the mapping of POS item ${dialog.mapping.posItemCode}?`}
            description="New sales of this POS item then match only a recipe with the same POS code."
            confirmText="Delete"
            busy={deleting}
            onConfirm={() => handleDelete(dialog.mapping)}
            onClose={() => setDialog(null)}
          />
        )}
      </div>
    </SilaPosSourceGate>
  );
};

export default SilaPosItemMappings;
