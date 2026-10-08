import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Pagination, toastService } from "@vosox/shared-ui";
import {
  deleteOutletMapping,
  downloadPosTemplate,
  getOutletMappings,
  type SilaPosOutletMapping,
  type SilaPosPage,
} from "../../../api/silaMe/silaPosMasterApi";
import SilaPosMappingImport from "./SilaPosMappingImport";
import SilaPosOutletMappingForm from "./SilaPosOutletMappingForm";
import SilaPosOutletMenu from "./SilaPosOutletMenu";
import { SilaPosConfirm, SilaPosSourceGate, SilaPosSourceSelect, defaultSourceId, type SilaPosSourceTabProps } from "./SilaPosShared";
import { errorText } from "./posFormat";

const PAGE_SIZE = 25;

type Dialog = { kind: "edit"; mapping: SilaPosOutletMapping | null } | { kind: "delete"; mapping: SilaPosOutletMapping } | { kind: "import" };

/** POS outlet code → SILA outlet location, per POS source, with the property, SAP plant and storage location. */
const SilaPosOutletMappings: React.FC<SilaPosSourceTabProps> = (props) => {
  const { sources, canManage, onReloadSources } = props;
  const [sourceId, setSourceId] = useState(() => defaultSourceId(sources));
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<SilaPosPage<SilaPosOutletMapping> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [menuOutlet, setMenuOutlet] = useState<SilaPosOutletMapping | null>(null);

  useEffect(() => {
    if (!sources.some((source) => source.id === sourceId)) setSourceId(defaultSourceId(sources));
  }, [sources, sourceId]);

  const load = useCallback(async () => {
    if (!sourceId) return;
    setLoading(true);
    setError(null);
    try {
      setData(await getOutletMappings(sourceId, appliedSearch, (page - 1) * PAGE_SIZE, PAGE_SIZE));
    } catch (err: unknown) {
      setData(null);
      setError(errorText(err, "Could not load the outlet mappings."));
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

  const handleDelete = async (mapping: SilaPosOutletMapping) => {
    setDeleting(true);
    try {
      await deleteOutletMapping(sourceId, mapping.id);
      toastService.success(`Mapping of POS outlet ${mapping.posOutletCode} deleted.`);
      afterChange();
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not delete the outlet mapping."));
    } finally {
      setDeleting(false);
    }
  };

  const handleTemplate = async () => {
    try {
      await downloadPosTemplate("OUTLETS");
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not download the template."));
    }
  };

  const rows = data?.items ?? [];
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <SilaPosSourceGate {...props} subject="outlet mappings">
      <div className="srec-stack">
        <div className="srec-filters spos-toolbar">
          <SilaPosSourceSelect id="spos-outlet-source" sources={sources} value={sourceId} onChange={(id) => { setSourceId(id); setPage(1); }} />
          <div className="sila-field srec-grow">
            <label className="sila-label" htmlFor="spos-outlet-search">Search</label>
            <input
              id="spos-outlet-search"
              className="sila-input"
              type="search"
              placeholder="POS outlet or location"
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
          <Loader size={24} message="Loading outlet mappings..." />
        ) : error ? (
          <EmptyState
            variant="error"
            title="Couldn't load the outlet mappings"
            description={error}
            action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
          />
        ) : rows.length === 0 ? (
          <EmptyState title="No outlet mappings" description="Unmapped POS outlets match an outlet location with the same code." />
        ) : (
          <>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col">POS outlet</th>
                    <th scope="col">Location</th>
                    <th scope="col">Property</th>
                    <th scope="col">Plant</th>
                    <th scope="col">Storage location</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((mapping) => (
                    <tr key={mapping.id}>
                      <td>
                        <span className="sila-cell-strong">{mapping.posOutletCode}</span>
                        {mapping.posOutletName && <span className="srec-sub">{mapping.posOutletName}</span>}
                      </td>
                      <td>
                        {mapping.locationName ?? "—"}
                        {mapping.locationCode && <span className="srec-sub">{mapping.locationCode}</span>}
                        {!mapping.locationActive && <span className="sila-badge sila-badge--danger sila-badge--sm">Inactive location</span>}
                      </td>
                      <td>{mapping.propertyName ?? "—"}</td>
                      <td>{mapping.plantCode || "—"}</td>
                      <td>{mapping.storageLocationCode || "—"}</td>
                      <td>
                        <div className="srec-actions">
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Menu items of POS outlet ${mapping.posOutletCode}`} onClick={() => setMenuOutlet(mapping)}>
                            Menu
                          </button>
                        {canManage && (
                          <>
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Edit mapping of POS outlet ${mapping.posOutletCode}`} onClick={() => setDialog({ kind: "edit", mapping })}>
                              Edit
                            </button>
                            <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-label={`Delete mapping of POS outlet ${mapping.posOutletCode}`} onClick={() => setDialog({ kind: "delete", mapping })}>
                              Delete
                            </button>
                          </>
                        )}
                        </div>
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

        {menuOutlet && menuOutlet.posSourceId === sourceId && (
          <SilaPosOutletMenu sourceId={sourceId} outlet={menuOutlet} onClose={() => setMenuOutlet(null)} />
        )}

        {dialog?.kind === "edit" && (
          <SilaPosOutletMappingForm sourceId={sourceId} mapping={dialog.mapping} onClose={() => setDialog(null)} onSaved={afterChange} />
        )}
        {dialog?.kind === "import" && (
          <SilaPosMappingImport sourceId={sourceId} kind="OUTLETS" onClose={() => setDialog(null)} onImported={afterChange} />
        )}
        {dialog?.kind === "delete" && (
          <SilaPosConfirm
            heading="Delete outlet mapping"
            content={`Delete the mapping of POS outlet ${dialog.mapping.posOutletCode}?`}
            description="New sales of this POS outlet then match only an outlet location with the same code."
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

export default SilaPosOutletMappings;
