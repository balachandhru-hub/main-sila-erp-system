import React, { useCallback, useState } from "react";
import { toastService } from "@vosox/shared-ui";
import { getInvoiceFile, getInvoices, type SilaInvoice, type SilaPage } from "../../api/silaMe/silaReceivingApi";
import { formatDate } from "../cart/lineFormat";
import PagedListBody from "../silaMe/receiving/PagedListBody";
import { useDebounced, usePagedList } from "../silaMe/receiving/usePagedList";
import { formatAmount, formatConfidence, openBlob, receivingBadgeClass, receivingLabel } from "../silaMe/receiving/receivingFormat";

const STATUSES = ["UPLOADED", "EXTRACTED", "OCR_FAILED", "REVIEWED", "GRN_POSTED"];

interface InvoiceDocumentsProps {
  /** Opens the SILA ME invoice screen, where invoices are uploaded, read and reviewed. */
  onOpenInvoices: () => void;
}

/** Supplier invoices uploaded to SILA ME, with their OCR extraction status; read-only, the file opens in a new tab. */
const InvoiceDocuments: React.FC<InvoiceDocumentsProps> = ({ onOpenInvoices }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const term = useDebounced(search);
  const load = useCallback((page: SilaPage) => getInvoices(term, status, page), [term, status]);
  const list = usePagedList<SilaInvoice>(load, "Could not load the invoices.");

  const openFile = async (invoice: SilaInvoice) => {
    setOpeningId(invoice.id);
    try {
      openBlob(await getInvoiceFile(invoice.id));
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not open the invoice file.");
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <>
      <div className="doc-filters">
        <div className="sila-field">
          <label className="sila-label" htmlFor="doc-invoice-search">Search</label>
          <input
            id="doc-invoice-search"
            className="sila-input"
            type="search"
            placeholder="Invoice number, supplier or file name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="doc-invoice-status">Extraction status</label>
          <select id="doc-invoice-status" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All</option>
            {STATUSES.map((code) => (
              <option key={code} value={code}>{receivingLabel(code)}</option>
            ))}
          </select>
        </div>
        <button type="button" className="sila-btn sila-btn--secondary" onClick={onOpenInvoices}>
          Open invoice workspace
        </button>
      </div>
      <PagedListBody list={list} noun="invoices" emptyTitle="No invoices uploaded yet">
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">File</th>
                <th scope="col">Invoice number</th>
                <th scope="col">Supplier</th>
                <th scope="col">Amount</th>
                <th scope="col">Uploaded</th>
                <th scope="col">Extraction</th>
                <th scope="col">OCR confidence</th>
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="sila-cell-strong">{invoice.fileName}</td>
                  <td>{invoice.invoiceNumber || "—"}</td>
                  <td>{invoice.supplierName || "—"}</td>
                  <td>{formatAmount(invoice.grossAmount, invoice.currency)}</td>
                  <td>{formatDate(invoice.uploadedOn)}</td>
                  <td><span className={receivingBadgeClass(invoice.status)}>{receivingLabel(invoice.status)}</span></td>
                  <td>{formatConfidence(invoice.ocrConfidence)}</td>
                  <td>
                    <button
                      type="button"
                      className="sila-btn sila-btn--secondary sila-btn--sm"
                      disabled={openingId === invoice.id}
                      aria-label={`Open the file ${invoice.fileName}`}
                      onClick={() => openFile(invoice)}
                    >
                      {openingId === invoice.id ? "Opening..." : "Open file"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </PagedListBody>
    </>
  );
};

export default InvoiceDocuments;
