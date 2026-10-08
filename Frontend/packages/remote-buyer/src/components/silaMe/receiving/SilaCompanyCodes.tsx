import React, { useCallback, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { deleteCompanyCode, getCompanyCodes, setCompanyCodeStatus, type SilaCompanyCode } from "../../../api/silaMe/silaMasterDataApi";
import type { SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaCompanyCodeForm from "./SilaCompanyCodeForm";
import SilaImportPanel from "./SilaImportPanel";
import SilaReceivingConfirm from "./SilaReceivingConfirm";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaCompanyCodesProps {
  /** MANAGE_SILA_MASTER_DATA: add, change, delete and import company codes. */
  canManage: boolean;
}

type Dialog =
  | { kind: "edit"; companyCode: SilaCompanyCode | null }
  | { kind: "delete"; companyCode: SilaCompanyCode }
  | { kind: "suspend"; companyCode: SilaCompanyCode };

/** Company Code Master: ERP APIs (SAP, Ariba) are configured per company code under Integration (entity code). */
const SilaCompanyCodes: React.FC<SilaCompanyCodesProps> = ({ canManage }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const term = useDebounced(search);
  const load = useCallback((page: SilaPage) => getCompanyCodes(term, page, status), [term, status]);
  const list = usePagedList(load, "Could not load the company codes.");
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [changing, setChanging] = useState<string | null>(null);

  const changeStatus = async (companyCode: SilaCompanyCode, active: boolean) => {
    setChanging(companyCode.id);
    try {
      await setCompanyCodeStatus(companyCode.id, active);
      toastService.success(`Company code ${companyCode.code} ${active ? "activated" : "suspended"}.`);
      setDialog(null);
      list.reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not change the company code status.");
    } finally {
      setChanging(null);
    }
  };

  const handleDelete = async (companyCode: SilaCompanyCode) => {
    setDeleting(true);
    try {
      await deleteCompanyCode(companyCode.id);
      toastService.success(`Company code ${companyCode.code} deleted.`);
      setDialog(null);
      list.reload();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not delete the company code.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader className="pud-page-header" title="Company codes" />
      {canManage && (
        <div className="srcv-actions">
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setDialog({ kind: "edit", companyCode: null })}>Add company code</button>
        </div>
      )}
      <SilaImportPanel kind="company-codes" noun="company codes" canManage={canManage} onImported={list.reload} />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-cc-search">Search</label>
            <input id="srcv-cc-search" className="sila-input" type="search" placeholder="Code or name" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-cc-status">Status</label>
            <select id="srcv-cc-status" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>
        </div>
        <PagedListBody list={list} noun="company codes" emptyTitle="No company codes" emptyDescription="Add or import the company codes the ERP posts under.">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Company code</th>
                  <th scope="col">Company name</th>
                  <th scope="col">Country</th>
                  <th scope="col">Currency</th>
                  <th scope="col">Status</th>
                  <th scope="col">Updated</th>
                  {canManage && <th scope="col"><span className="sila-visually-hidden">Actions</span></th>}
                </tr>
              </thead>
              <tbody>
                {list.rows.map((companyCode) => (
                  <tr key={companyCode.id}>
                    <td className="sila-cell-strong">{companyCode.code}</td>
                    <td>{companyCode.name}</td>
                    <td>{companyCode.country || "—"}</td>
                    <td>{companyCode.currency || "—"}</td>
                    <td>
                      <span className={receivingBadgeClass(companyCode.status ?? "ACTIVE")}>{receivingLabel(companyCode.status ?? "ACTIVE")}</span>
                    </td>
                    <td>{formatDateTime(companyCode.updatedOn)}</td>
                    {canManage && (
                      <td>
                        <div className="srcv-actions">
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Edit company code ${companyCode.code}`} onClick={() => setDialog({ kind: "edit", companyCode })}>Edit</button>
                          {companyCode.status === "INACTIVE" ? (
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Activate company code ${companyCode.code}`}
                              disabled={changing !== null} onClick={() => changeStatus(companyCode, true)}>
                              {changing === companyCode.id ? "Activating..." : "Activate"}
                            </button>
                          ) : (
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Suspend company code ${companyCode.code}`}
                              disabled={changing !== null} onClick={() => setDialog({ kind: "suspend", companyCode })}>
                              Suspend
                            </button>
                          )}
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Delete company code ${companyCode.code}`} onClick={() => setDialog({ kind: "delete", companyCode })}>Delete</button>
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
        <SilaCompanyCodeForm
          companyCode={dialog.companyCode}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            list.reload();
          }}
        />
      )}
      {dialog?.kind === "suspend" && (
        <SilaReceivingConfirm
          heading="Suspend company code"
          message={`Suspend company code ${dialog.companyCode.code}? It stays in the list as inactive and can be activated again.`}
          confirmText="Suspend"
          busy={changing !== null}
          onConfirm={() => changeStatus(dialog.companyCode, false)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "delete" && (
        <SilaReceivingConfirm
          heading="Delete company code"
          message={`Delete company code ${dialog.companyCode.code}? This is refused while an ERP API, a property or an open purchase order uses it.`}
          confirmText="Delete"
          busy={deleting}
          onConfirm={() => handleDelete(dialog.companyCode)}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
};

export default SilaCompanyCodes;
