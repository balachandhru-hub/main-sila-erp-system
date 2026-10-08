import React, { useCallback, useRef, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { getInvoices, uploadInvoice, type SilaPage } from "../../../api/silaMe/silaReceivingApi";
import { formatDate } from "../../cart/lineFormat";
import PagedListBody from "./PagedListBody";
import SilaInvoiceReviewDialog from "./SilaInvoiceReviewDialog";
import SilaReceiveGoodsDialog, { type ReceivePrefill } from "./SilaReceiveGoodsDialog";
import { formatAmount, formatConfidence, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import { useDebounced, usePagedList } from "./usePagedList";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaInvoicesProps {
  /** POST_SILA_GRN: may upload, read, review invoices and receive goods. */
  canPost: boolean;
}

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png";
const STATUSES = ["UPLOADED", "EXTRACTED", "REVIEW_REQUIRED", "OCR_FAILED", "REVIEWED", "GRN_POSTED"];

/** Supplier invoices: upload, OCR, review, and "Create GRN from invoice". */
const SilaInvoices: React.FC<SilaInvoicesProps> = ({ canPost }) => {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const term = useDebounced(search);
  const [openId, setOpenId] = useState<string | null>(null);
  const [receive, setReceive] = useState<ReceivePrefill | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const load = useCallback((page: SilaPage) => getInvoices(term, status, page), [term, status]);
  const list = usePagedList(load, "Could not load the invoices.");
  const closeReview = useCallback(() => setOpenId(null), []);
  const closeReceive = useCallback(() => setReceive(null), []);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toastService.error("Upload an invoice of at most 20 MB.");
      return;
    }
    setUploading(true);
    try {
      const id = await uploadInvoice(file);
      toastService.success("Invoice uploaded. Read it with OCR or type the fields.");
      list.reload();
      setOpenId(id);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not upload the invoice.");
    } finally {
      setUploading(false);
    }
  };

  const handleReceive = (prefill: ReceivePrefill) => {
    setOpenId(null);
    setReceive(prefill);
  };

  const handlePosted = () => {
    setReceive(null);
    list.reload();
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader
        className="pud-page-header"
        title="Invoices"
        description="A single control queue for uploaded documents, extraction, matching, and receipt readiness."
        actions={canPost ? (
          <>
            <input ref={fileInput} type="file" accept={ACCEPT} hidden aria-label="Invoice file" onChange={handleFile} />
            <button type="button" className="sila-btn sila-btn--primary" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? "Uploading..." : "Upload invoice"}
            </button>
          </>
        ) : undefined}
      />
      <section className="sila-card">
        <div className="srcv-filters">
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-inv-search">Search</label>
            <input id="srcv-inv-search" className="sila-input" type="search" placeholder="Invoice, supplier or PO" value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="srcv-inv-status">Status</label>
            <select id="srcv-inv-status" className="sila-select" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">All statuses</option>
              {STATUSES.map((code) => <option key={code} value={code}>{receivingLabel(code)}</option>)}
            </select>
          </div>
        </div>
        <PagedListBody list={list} noun="invoices" emptyTitle="No invoices yet" emptyDescription="Uploaded invoices will appear in this queue.">
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Invoice</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Date</th>
                  <th scope="col">PO reference</th>
                  <th scope="col">Gross</th>
                  <th scope="col">Type</th>
                  <th scope="col">Status</th>
                  <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {list.rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="sila-cell-strong">{row.invoiceNumber || row.fileName}</span>
                      <span className="srcv-sub">Uploaded {formatDate(row.uploadedOn)}</span>
                    </td>
                    <td>{row.supplierName || "Supplier pending"}</td>
                    <td>{row.invoiceDate ? formatDate(row.invoiceDate) : "—"}</td>
                    <td>{row.poNumber || "Not matched"}</td>
                    <td>
                      {formatAmount(row.grossAmount, row.currency)}
                      {(row.netAmount != null || row.taxAmount != null) && (
                        <span className="srcv-sub">Net {formatAmount(row.netAmount, row.currency)} · Tax {formatAmount(row.taxAmount, row.currency)}</span>
                      )}
                    </td>
                    <td>
                      {row.invoiceType ? receivingLabel(row.invoiceType) : "—"}
                      {row.goodsReceiptApplicable === false && <span className="srcv-sub">No goods receipt</span>}
                    </td>
                    <td>
                      <span className={receivingBadgeClass(row.status)}>{receivingLabel(row.status)}</span>
                      {row.ocrConfidence != null && <span className="srcv-sub">OCR {formatConfidence(row.ocrConfidence)}</span>}
                    </td>
                    <td>
                      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" aria-label={`Open invoice ${row.invoiceNumber || row.fileName}`} onClick={() => setOpenId(row.id)}>
                        Open
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PagedListBody>
      </section>
      {openId && (
        <SilaInvoiceReviewDialog invoiceId={openId} canPost={canPost} onClose={closeReview} onChanged={list.reload} onReceive={handleReceive} />
      )}
      {receive && <SilaReceiveGoodsDialog prefill={receive} onClose={closeReceive} onPosted={handlePosted} />}
    </div>
  );
};

export default SilaInvoices;
