import React, { useEffect, useState } from "react";
import { Loader, toastService } from "@vosox/shared-ui";
import {
  getSupplierCandidates,
  matchInvoiceSupplier,
  type SilaInvoiceDetail,
  type SilaSupplierCandidate,
} from "../../../api/silaMe/silaReceivingApi";
import { useDebounced } from "./usePagedList";

interface SilaInvoiceSupplierMatchProps {
  invoice: SilaInvoiceDetail;
  disabled: boolean;
  onUpdated: (invoice: SilaInvoiceDetail) => void;
}

/** Suppliers the invoice may come from (Supplier Master by tax number, name or alias; purchase order suppliers); pick one. */
const SilaInvoiceSupplierMatch: React.FC<SilaInvoiceSupplierMatchProps> = ({ invoice, disabled, onUpdated }) => {
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [candidates, setCandidates] = useState<SilaSupplierCandidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getSupplierCandidates(invoice.id, term)
      .then((rows) => active && setCandidates(rows))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Could not load the supplier candidates."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [invoice.id, term]);

  const keyOf = (candidate: SilaSupplierCandidate): string => candidate.silaSupplierId ?? candidate.supplierId ?? candidate.name;
  const isCurrent = (candidate: SilaSupplierCandidate): boolean =>
    (candidate.silaSupplierId != null && candidate.silaSupplierId === invoice.silaSupplierId)
    || (candidate.silaSupplierId == null && candidate.supplierId != null && candidate.supplierId === invoice.supplierId);

  const handleUse = async (candidate: SilaSupplierCandidate) => {
    setSavingKey(keyOf(candidate));
    try {
      const updated = await matchInvoiceSupplier(invoice.id, candidate.silaSupplierId
        ? { silaSupplierId: candidate.silaSupplierId }
        : { supplierId: candidate.supplierId });
      onUpdated(updated);
      toastService.success(`Supplier set to ${candidate.name}.`);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not match the supplier.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <section className="srcv-stack" aria-labelledby="srcv-match-supplier">
      <h3 id="srcv-match-supplier" className="sila-form-section-title">Supplier</h3>
      <p>
        {invoice.supplierName || "No supplier yet"}
        {invoice.supplierCode && <span className="srcv-sub">Supplier Master {invoice.supplierCode}</span>}
      </p>
      <div className="sila-field">
        <label className="sila-label" htmlFor="srcv-match-sup-search">Search suppliers</label>
        <input id="srcv-match-sup-search" className="sila-input" type="search" placeholder={invoice.supplierName || "Supplier name"} value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {loading ? (
        <Loader size={20} message="Finding suppliers..." />
      ) : error ? (
        <p className="srcv-error" role="alert">{error}</p>
      ) : candidates.length === 0 ? (
        <p className="srcv-sub">No matching supplier. Add it under Suppliers, or search by another name.</p>
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Supplier</th>
                <th scope="col">Tax number</th>
                <th scope="col">Match</th>
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((candidate) => (
                <tr key={`${candidate.source}-${keyOf(candidate)}`}>
                  <td>
                    <span className="sila-cell-strong">{candidate.name}</span>
                    <span className="srcv-sub">{candidate.supplierCode ? `Supplier Master ${candidate.supplierCode}` : "From purchase orders"}</span>
                  </td>
                  <td>{candidate.taxNumber || "—"}</td>
                  <td>
                    {candidate.score}%<span className="srcv-sub">{candidate.reason}</span>
                  </td>
                  <td>
                    {isCurrent(candidate) ? (
                      <span className="sila-badge sila-badge--success">Matched</span>
                    ) : (
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Use supplier ${candidate.name}`}
                        disabled={disabled || savingKey !== null}
                        onClick={() => handleUse(candidate)}
                      >
                        {savingKey === keyOf(candidate) ? "Saving..." : "Use"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default SilaInvoiceSupplierMatch;
