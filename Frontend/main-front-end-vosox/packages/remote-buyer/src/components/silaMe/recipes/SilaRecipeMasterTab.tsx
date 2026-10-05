import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  confirmRecipeMasterImport,
  deleteRecipeMaster,
  downloadRecipeMasterTemplate,
  exportRecipeMasters,
  getRecipeMasters,
  previewRecipeMasterImport,
  saveRecipeMaster,
  type SilaRecipeMaster,
  type SilaRecipeMasterKind,
} from "../../../api/silaMe/silaRecipeToolsApi";
import SilaRecipeExcelPanel from "./SilaRecipeExcelPanel";

interface SilaRecipeMasterTabProps {
  kind: SilaRecipeMasterKind;
  canManage: boolean;
}

interface FormState {
  id?: string;
  code: string;
  name: string;
  description: string;
}

const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_./-]*$/;

/** The list of one master (families or categories) with search, create/edit form, delete and Excel. */
const SilaRecipeMasterTab: React.FC<SilaRecipeMasterTabProps> = ({ kind, canManage }) => {
  const noun = kind === "families" ? "family" : "category";
  const [rows, setRows] = useState<SilaRecipeMaster[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<SilaRecipeMaster | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await getRecipeMasters(kind, "", status));
    } catch (err: unknown) {
      setRows([]);
      setError(err instanceof Error ? err.message : "Could not load the list.");
    } finally {
      setLoading(false);
    }
  }, [kind, status]);

  useEffect(() => {
    load();
  }, [load]);

  const term = search.trim().toLowerCase();
  const visible = term ? rows.filter((row) => row.code.toLowerCase().includes(term) || row.name.toLowerCase().includes(term)) : rows;

  const formProblem = (value: FormState): string | null => {
    const code = value.code.trim();
    if (!code || code.length > 50 || !CODE_PATTERN.test(code)) return "Enter a code of up to 50 letters, digits or _ . / - characters.";
    if (!value.name.trim() || value.name.trim().length > 200) return "Enter a name of up to 200 characters.";
    if (value.description.length > 1000) return "Keep the description within 1000 characters.";
    return null;
  };

  const handleSave = async () => {
    if (!form) return;
    const problem = formProblem(form);
    if (problem) {
      toastService.error(problem);
      return;
    }
    setBusy(true);
    try {
      await saveRecipeMaster(kind, { code: form.code.trim(), name: form.name.trim(), description: form.description.trim() || null }, form.id);
      toastService.success(form.id ? "Saved." : `The ${noun} was created.`);
      setForm(null);
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteRecipeMaster(kind, toDelete.id);
      toastService.success(`${toDelete.code} was deleted.`);
      setToDelete(null);
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="srec-filters">
        <div className="sila-field srec-grow">
          <label className="sila-label" htmlFor={`srec-master-search-${kind}`}>Search</label>
          <input id={`srec-master-search-${kind}`} className="sila-input" type="search" placeholder="Code or name" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor={`srec-master-status-${kind}`}>Status</label>
          <select id={`srec-master-status-${kind}`} className="sila-select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ALL">All</option>
          </select>
        </div>
        <SilaRecipeExcelPanel
          noun={noun}
          canImport={canManage}
          onTemplate={() => downloadRecipeMasterTemplate(kind)}
          onExport={() => exportRecipeMasters(kind)}
          onPreview={(file) => previewRecipeMasterImport(kind, file)}
          onConfirm={(file) => confirmRecipeMasterImport(kind, file)}
          onImported={load}
        />
        {canManage && (
          <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => setForm({ code: "", name: "", description: "" })}>
            New {noun}
          </button>
        )}
      </div>

      {loading ? (
        <Loader size={24} message="Loading..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the list"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : visible.length === 0 ? (
        <EmptyState title={term ? "Nothing matches" : `No ${kind} yet`} />
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Code</th>
                <th scope="col">Name</th>
                <th scope="col">Description</th>
                <th scope="col" className="srec-num">Recipes</th>
                <th scope="col">Status</th>
                {canManage && <th scope="col"><span className="sila-visually-hidden">Actions</span></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="sila-cell-strong">{row.code}</td>
                  <td>{row.name}</td>
                  <td className="srec-message">{row.description || "—"}</td>
                  <td className="srec-num">{row.recipeCount}</td>
                  <td>
                    <span className={row.status === "INACTIVE" ? "sila-badge sila-badge--danger" : "sila-badge sila-badge--success"}>
                      {row.status === "INACTIVE" ? "Inactive" : "Active"}
                    </span>
                  </td>
                  {canManage && row.status === "INACTIVE" && <td>—</td>}
                  {canManage && row.status !== "INACTIVE" && (
                    <td>
                      <span className="srec-actions">
                        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-label={`Edit ${row.code}`}
                          onClick={() => setForm({ id: row.id, code: row.code, name: row.name, description: row.description ?? "" })}>
                          Edit
                        </button>
                        <button type="button" className="sila-btn sila-btn--ghost sila-btn--sm" aria-label={`Delete ${row.code}`}
                          disabled={row.recipeCount > 0} title={row.recipeCount > 0 ? "Used by active recipes" : undefined}
                          onClick={() => setToDelete(row)}>
                          Delete
                        </button>
                      </span>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Modal
          isOpen
          onClose={() => setForm(null)}
          headerProps={{ heading: form.id ? `Edit ${noun} ${form.code}` : `New ${noun}` }}
          footerProps={{
            secondaryButton: { text: "Cancel", onClick: () => setForm(null), disabled: busy },
            primaryButton: { text: "Save", onClick: handleSave, loading: busy },
          }}
        >
          <div className="sila-root sila-me sila-form-grid">
            <div className="sila-field">
              <label className="sila-label" htmlFor="srec-master-code">Code <span className="sila-required">*</span></label>
              <input id="srec-master-code" className="sila-input" maxLength={50} value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="srec-master-name">Name <span className="sila-required">*</span></label>
              <input id="srec-master-name" className="sila-input" maxLength={200} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="sila-field sila-field--full">
              <label className="sila-label" htmlFor="srec-master-description">Description</label>
              <textarea id="srec-master-description" className="sila-textarea" rows={2} maxLength={1000} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        variant="danger"
        headerProps={{ heading: `Delete ${noun} ${toDelete?.code ?? ""}` }}
        footerProps={{
          secondaryButton: { text: "Cancel", onClick: () => setToDelete(null), disabled: busy },
          primaryButton: { text: "Delete", onClick: handleDelete, loading: busy },
        }}
      >
        <p className="sila-modal-text">{toDelete?.name} will no longer be offered for recipes.</p>
      </Modal>
    </>
  );
};

export default SilaRecipeMasterTab;
