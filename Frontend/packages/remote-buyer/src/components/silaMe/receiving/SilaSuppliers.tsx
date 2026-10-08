import React, { useCallback, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { deleteSupplier, getSuppliers, pullSuppliers, type SilaPullResult, type SilaSupplier } from "../../../api/silaMe/silaMasterDataApi";
import type { SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaImportPanel from "./SilaImportPanel";
import SilaPullSummary from "./SilaPullSummary";
import SilaReceivingConfirm from "./SilaReceivingConfirm";
import SilaSupplierForm from "./SilaSupplierForm";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaSuppliersProps {
  /** MANAGE_SILA_MASTER_DATA: add, change, delete, import and pull suppliers. */
  canManage: boolean;
}

type Dialog = { kind: "edit"; supplier: SilaSupplier | null } | { kind: "delete"; supplier: SilaSupplier };

/** Supplier Master: the suppliers invoices are matched to; kept by hand, from Excel or from the ERP (GET_SUPPLIER). */
const SilaSuppliers: React.FC<SilaSuppliersProps> = ({ canManage }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const term = useDebounced(search);
  const load = useCallback((page: SilaPage) => getSuppliers(term, status, page), [term, status]);
  const list = usePagedList(load, "Could not load the suppliers.");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<SilaPullResult | null>(null);

  const handleDelete = async (supplier: SilaSupplier) => {
    setDeleting(true);
    try {
      await deleteSupplier(supplier.id);
      toastService.success(`Supplier ${supplier.supplierCode} deleted.`);
      setDialog(null);
      list.reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not delete the supplier.");
    } finally {
      setDeleting(false);
    }
  };

  const handlePull = async () => {
    setPulling(true);
    try {
      const result = await pullSuppliers();
      setPullResult(result);
      toastService.success(`${result.created} new and ${result.updated} updated suppliers read from the ERP.`);
      list.reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not read the suppliers from the ERP.");
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader className="pud-page-header" title="Suppliers" description="Supplier identity used by invoice review, PO selection, and ERP receiving." />
      {canManage && (
        <div className="srcv-actions">
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setDialog({ kind: "edit", supplier: null })}>Add supplier</button>
          <button type="button" className="sila-btn sila-btn--secondary" disabled={pulling} onClick={handlePull}>
            {pulling ? "Reading from ERP..." : "Pull from ERP"}
          </button>
        </div>
      )}
      {pullResult && <SilaPullSummary result={pullResult} noun="suppliers" />}
      <SilaImportPanel kind="suppliers" noun="suppliers" canManage={canManage} onImported={list.reload} />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-sup-search">Search</label>
            <input id="srcv-sup-search" className="sila-input" type="search" placeholder="Code, name, TRN or alias" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-sup-filter-status">Status</label>
            <select id="srcv-sup-filter-status" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>
        <PagedListBody list={list} noun="suppliers" emptyTitle="No suppliers found" emptyDescription="Import or add a supplier before matching invoices.">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col">TRN</th>
                  <th scope="col">Location</th>
                  <th scope="col">Aliases</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  {canManage && <th scope="col"><span className="sila-visually-hidden">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {list.rows.map((supplier) => (
                  <tr key={supplier.id}>
                    <td>
                      <span className="sila-cell-strong">{supplier.supplierCode}</span>
                      <span className="srcv-sub">{supplier.name}</span>
                      {supplier.legalName && supplier.legalName !== supplier.name && <span className="srcv-sub">{supplier.legalName}</span>}
                    </td>
                    <td>{supplier.trn || supplier.taxNumber || "—"}</td>
                    <td>
                      {[supplier.city, supplier.country].filter(Boolean).join(", ") || "—"}
                      {supplier.address && <span className="srcv-sub">{supplier.address}</span>}
                      {supplier.currency && <span className="srcv-sub">Currency {supplier.currency}</span>}
                    </td>
                    <td>{supplier.aliases.length > 0 ? supplier.aliases.join(", ") : "—"}</td>
                    <td>
                      <span className={receivingBadgeClass(supplier.status)}>{receivingLabel(supplier.status)}</span>
                    </td>
                    <td>{formatDateTime(supplier.updatedOn)}</td>
                    {canManage && (
                      <td>
                        <div className="srcv-actions">
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Edit supplier ${supplier.supplierCode}`} onClick={() => setDialog({ kind: "edit", supplier })}>Edit</button>
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Delete supplier ${supplier.supplierCode}`} onClick={() => setDialog({ kind: "delete", supplier })}>Delete</button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
      {dialog?.kind === "edit" && (
        <SilaSupplierForm
          supplier={dialog.supplier}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            list.reload();
          }}
        />
      )}
      {dialog?.kind === "delete" && (
        <SilaReceivingConfirm
          heading="Delete supplier"
          message={`Delete supplier ${dialog.supplier.supplierCode} (${dialog.supplier.name})? Invoices already matched keep their supplier name.`}
          confirmText="Delete"
          busy={deleting}
          onConfirm={() => handleDelete(dialog.supplier)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default SilaSuppliers;
