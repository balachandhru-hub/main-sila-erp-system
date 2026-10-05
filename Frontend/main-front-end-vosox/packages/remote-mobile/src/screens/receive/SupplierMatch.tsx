import React, { useEffect, useState } from 'react';
import {
  getSupplierCandidates,
  matchInvoiceSupplier,
  type SilaInvoiceDetail,
  type SilaSupplierCandidate,
} from '../../../../remote-buyer/src/api/silaMe/silaReceivingApi';
import { errorText } from '../../useLoad';

export interface MatchedSupplier {
  supplierId: string | null;
  silaSupplierId: string | null;
  supplierCode: string | null;
  name: string;
}

interface SupplierMatchProps {
  invoiceId: string;
  /** Supplier name and TRN the OCR read. */
  ocrName: string | null;
  ocrTaxNumber: string | null;
  matched: MatchedSupplier | null;
  onMatched: (supplier: MatchedSupplier | null, invoice?: SilaInvoiceDetail) => void;
  disabled?: boolean;
}

/** "Supplier": what the OCR read, and the supplier chosen from the Supplier Master (ranked candidates). */
const SupplierMatch: React.FC<SupplierMatchProps> = ({ invoiceId, ocrName, ocrTaxNumber, matched, onMatched, disabled }) => {
  const [search, setSearch] = useState<string>('');
  const [candidates, setCandidates] = useState<SilaSupplierCandidate[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (matched) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      getSupplierCandidates(invoiceId, search)
        .then((found) => {
          if (active) setCandidates(found.slice(0, 8));
        })
        .catch((caught: unknown) => {
          if (active) setError(errorText(caught));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [invoiceId, search, matched]);

  const choose = async (candidate: SilaSupplierCandidate) => {
    setSaving(true);
    setError(null);
    try {
      const invoice = await matchInvoiceSupplier(invoiceId, { silaSupplierId: candidate.silaSupplierId, supplierId: candidate.supplierId });
      onMatched(
        {
          supplierId: invoice.supplierId ?? candidate.supplierId ?? null,
          silaSupplierId: invoice.silaSupplierId ?? candidate.silaSupplierId ?? null,
          supplierCode: invoice.supplierCode ?? candidate.supplierCode ?? null,
          name: invoice.supplierName ?? candidate.name,
        },
        invoice,
      );
    } catch (caught: unknown) {
      setError(errorText(caught));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="sm-card" aria-labelledby="sm-inv-supplier">
      <h2 id="sm-inv-supplier" className="sm-label">
        Supplier
      </h2>
      <span className="sm-label">OCR supplier</span>
      <p className="sm-meta">
        {ocrName || 'Not read'}
        {ocrTaxNumber ? ` · TRN ${ocrTaxNumber}` : ''}
      </p>
      <span className="sm-label">Supplier name</span>
      {matched ? (
        <div className="sm-row">
          <span>
            <strong className="sm-title">{matched.name}</strong>
            <br />
            <span className="sm-meta">Supplier ID {matched.supplierCode ?? '—'}</span>
          </span>
          <button type="button" className="sm-link" disabled={disabled || saving} onClick={() => onMatched(null)}>
            CHANGE SUPPLIER
          </button>
        </div>
      ) : (
        <>
          <p className="sm-meta sm-required">Not selected</p>
          <input
            className="sm-input"
            type="search"
            aria-label="Search supplier"
            placeholder="Search supplier name, ID, TRN, or alias"
            value={search}
            disabled={disabled}
            onChange={(event) => setSearch(event.target.value)}
          />
          {loading && <p className="sm-muted" role="status">Searching suppliers…</p>}
          {error && <p className="sm-notice sm-notice--error" role="alert">{error}</p>}
          {!loading && !error && candidates.length === 0 && <p className="sm-muted">No active supplier matched that search.</p>}
          <ul className="sm-list">
            {candidates.map((candidate) => (
              <li key={`${candidate.silaSupplierId ?? ''}-${candidate.supplierId ?? ''}-${candidate.name}`}>
                <button type="button" className="sm-list-btn" disabled={disabled || saving} onClick={() => choose(candidate)}>
                  <strong>{candidate.name}</strong>
                  <span className="sm-meta">
                    {[candidate.supplierCode, candidate.taxNumber ? `TRN ${candidate.taxNumber}` : null].filter(Boolean).join(' · ') || '—'}
                  </span>
                  <span className="sm-meta">
                    {candidate.reason} · {Math.round(candidate.score)}%
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
};

export default SupplierMatch;
