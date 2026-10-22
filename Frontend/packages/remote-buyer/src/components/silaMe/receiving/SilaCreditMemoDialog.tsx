import React, { useEffect, useState } from "react";
import { EmptyState, Loader, Modal, toastService } from "@vosox/shared-ui";
import {
  createCreditMemo,
  creditMemoAmountTextForQuantity,
  creditMemoDraftFromLine,
  creditMemoExcludeDraft,
  creditMemoHeaderText,
  creditMemoIncludeDraft,
  getCreditMemo,
  getCreditMemoLines,
  lookupCreditMemoInvoice,
  mergeCreditMemoEligibleLines,
  retryCreditMemo,
  submitCreditMemo,
  updateCreditMemo,
  type SilaCreditMemoDetail,
  type SilaCreditMemoEligibleLine,
  type SilaCreditMemoReferenceInvoice,
} from "../../../api/silaMe/silaReceivingApi";
import { formatAmount, receivingBadgeClass, receivingLabel } from "./receivingFormat";
import SilaDocumentTrackPanel from "./SilaDocumentTrack";

interface SilaCreditMemoDialogProps {
  invoiceId?: string | null;
  creditMemoId?: string | null;
  showKindToggle?: boolean;
  onSelectInvoice?: () => void;
  onClose: () => void;
  onChanged?: () => void;
}

const today = (): string => new Date().toISOString().slice(0, 10);

interface LineDraft {
  invoiceLineId: string;
  included: boolean;
  quantity: string;
  amount: string;
  reason: string;
}

const SilaCreditMemoDialog: React.FC<SilaCreditMemoDialogProps> = ({
  invoiceId,
  creditMemoId,
  showKindToggle,
  onSelectInvoice,
  onClose,
  onChanged,
}) => {
  const locked = Boolean(invoiceId);
  const [searchInvoice, setSearchInvoice] = useState("");
  const [searchErp, setSearchErp] = useState("");
  const [looking, setLooking] = useState(false);
  const [matches, setMatches] = useState<SilaCreditMemoReferenceInvoice[]>([]);
  const [reference, setReference] = useState<SilaCreditMemoReferenceInvoice | null>(null);
  const [lines, setLines] = useState<SilaCreditMemoEligibleLine[]>([]);
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [headerText, setHeaderText] = useState("");
  const [documentDate, setDocumentDate] = useState(today);
  const [postingDate, setPostingDate] = useState(today);
  const [taxDate, setTaxDate] = useState(today);
  const [cmReference, setCmReference] = useState("");
  const [memo, setMemo] = useState<SilaCreditMemoDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadInvoice = async (id: string) => {
    setError(null);
    const found = await lookupCreditMemoInvoice({ invoiceId: id });
    const row = found[0];
    if (!row) {
      throw new Error("Only a successfully posted invoice can be used as the credit memo reference.");
    }
    const eligible = await getCreditMemoLines(row.id);
    setReference(row);
    setHeaderText(creditMemoHeaderText(row.invoiceNumber));
    setDocumentDate(today());
    setPostingDate(today());
    setTaxDate(today());
    setCmReference("");
    setLines(eligible);
    setDrafts(Object.fromEntries(eligible.map((line) => [line.invoiceLineId, { invoiceLineId: line.invoiceLineId, ...creditMemoDraftFromLine(line) }])));
  };

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        if (creditMemoId) {
          const data = await getCreditMemo(creditMemoId);
          if (!active) return;
          setMemo(data);
          setReference(data.referenceInvoice);
          setHeaderText(data.headerText || data.reason || creditMemoHeaderText(data.referenceSupplierInvoiceNumber));
          setDocumentDate((data.documentDate || today()).slice(0, 10));
          setPostingDate((data.postingDate || today()).slice(0, 10));
          setTaxDate((data.taxCalculationDate || today()).slice(0, 10));
          setCmReference(data.creditMemoReference || data.creditMemoNumber || "");
          const eligible = mergeCreditMemoEligibleLines(await getCreditMemoLines(data.referenceInvoiceId), data.lines);
          setLines(eligible);
          setDrafts(Object.fromEntries(eligible.map((line) => {
            const saved = data.lines.find((item) => item.referenceInvoiceLineId === line.invoiceLineId);
            return [line.invoiceLineId, { invoiceLineId: line.invoiceLineId, ...creditMemoDraftFromLine(line, saved) }];
          })));
          return;
        }
        if (invoiceId) await loadInvoice(invoiceId);
      } catch (caught: unknown) {
        if (active) setError(caught instanceof Error ? caught.message : "Could not open Credit Memo.");
      }
    };
    void start();
    return () => { active = false; };
  }, [invoiceId, creditMemoId]);

  const lookup = async () => {
    setLooking(true);
    setError(null);
    try {
      const rows = await lookupCreditMemoInvoice({ invoiceNumber: searchInvoice, erpInvoiceId: searchErp });
      setMatches(rows);
      if (rows.length === 1) {
        await loadInvoice(rows[0].id);
      }
      if (rows.length === 0) toastService.error("No posted invoice matched that reference.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not look up the invoice.");
    } finally {
      setLooking(false);
    }
  };

  const changeDraft = (line: SilaCreditMemoEligibleLine, patch: Partial<LineDraft>, recalcAmount = false) => {
    setDrafts((current) => {
      const previous = current[line.invoiceLineId] ?? { invoiceLineId: line.invoiceLineId, ...creditMemoDraftFromLine(line) };
      const next = { ...previous, ...patch };
      if (recalcAmount && patch.quantity != null) {
        const amount = creditMemoAmountTextForQuantity(line, patch.quantity);
        if (amount != null) next.amount = amount;
      }
      return { ...current, [line.invoiceLineId]: next };
    });
  };

  const writePayload = () => ({
    referenceInvoiceId: reference?.id,
    creditMemoReference: cmReference.trim() || null,
    documentDate,
    postingDate,
    taxCalculationDate: taxDate,
    headerText: headerText.trim() || creditMemoHeaderText(reference?.invoiceNumber),
    reason: headerText.trim() || null,
    lines: lines.map((line) => {
      const draft = drafts[line.invoiceLineId];
      const included = draft?.included !== false;
      return {
        invoiceLineId: line.invoiceLineId,
        quantity: included && draft?.quantity ? Number(draft.quantity) : 0,
        amount: included && draft?.amount ? Number(draft.amount) : 0,
        reason: included ? (draft?.reason?.trim() || null) : null,
      };
    }),
  });

  const run = async (label: string, work: () => Promise<SilaCreditMemoDetail>) => {
    setBusy(label);
    setError(null);
    try {
      const data = await work();
      setMemo(data);
      onChanged?.();
      toastService.success(label === "retry" ? "Credit memo posting retried from stored data." : label === "submit" ? "Credit memo submitted." : "Credit memo saved.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Credit memo action failed.");
    } finally {
      setBusy(null);
    }
  };

  const save = () => {
    if (!reference) {
      toastService.error("Resolve the original invoice before creating a credit memo.");
      return;
    }
    if (memo) return run("save", () => updateCreditMemo(memo.id, writePayload()));
    return run("save", () => createCreditMemo(writePayload()));
  };

  const submit = async () => {
    if (!reference) {
      toastService.error("Resolve the original invoice before creating a credit memo.");
      return;
    }
    setBusy("submit");
    setError(null);
    try {
      const current = memo ?? await createCreditMemo(writePayload());
      const posted = await submitCreditMemo(current.id);
      setMemo(posted);
      onChanged?.();
      toastService.success("Credit memo submitted.");
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : "Could not submit the credit memo.");
    } finally {
      setBusy(null);
    }
  };

  const unknown = memo?.status === "POSTING_UNKNOWN" || memo?.erpStatus === "UNKNOWN";
  const failed = memo?.canRetry;
  const posted = memo?.status === "POSTED";

  return (
    <Modal
      isOpen
      onClose={busy ? () => undefined : onClose}
      size="xl"
      headerProps={{ heading: "Credit Memo" }}
      footerProps={{
        primaryButton: posted || unknown ? undefined : { text: busy === "submit" ? "Submitting..." : "Post credit memo", onClick: submit, loading: busy === "submit", disabled: busy !== null || !reference },
        secondaryButton: { text: "Close", onClick: onClose, disabled: busy !== null },
      }}
    >
      <div className="sila-root sila-me srcv-dialog">
        {showKindToggle && (
          <div className="sila-btn-group">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={onSelectInvoice}>Invoice</button>
            <button type="button" className="sila-btn sila-btn--primary">Credit Memo</button>
          </div>
        )}
        {error && <p className="srcv-error" role="alert">{error}</p>}
        {!locked && !reference && (
          <section className="srcv-stack">
            <h3 className="sila-form-section-title">Reference Invoice</h3>
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-invoice">SILA / supplier invoice number</label>
                <input id="srcv-cm-invoice" className="sila-input" value={searchInvoice} onChange={(event) => setSearchInvoice(event.target.value)} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-erp">ERP / SAP invoice ID</label>
                <input id="srcv-cm-erp" className="sila-input" value={searchErp} onChange={(event) => setSearchErp(event.target.value)} />
              </div>
            </div>
            <button type="button" className="sila-btn sila-btn--secondary" disabled={looking} onClick={() => void lookup()}>
              {looking ? "Looking up..." : "Look up invoice"}
            </button>
            {matches.length > 1 && (
              <ul className="srcv-list">
                {matches.map((row) => (
                  <li key={row.id}>
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => void loadInvoice(row.id)}>
                      {row.invoiceNumber} · SAP {row.erpInvoiceId || "—"} · {row.supplierName}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        {!reference && locked && !error && <Loader size={20} message="Loading posted invoice..." />}
        {reference && (
          <>
            <section className="sila-alert sila-alert--info">
              <p><strong>Reference Invoice</strong> {locked ? "(locked)" : ""}</p>
              <p>Invoice Number: {reference.invoiceNumber || "—"}</p>
              <p>SAP Invoice: {reference.erpInvoiceId || "—"}</p>
              <p>Fiscal Year: {reference.fiscalYear || "—"}</p>
              <p>Supplier: {reference.supplierName || "—"}</p>
              <p>PO: {reference.poNumber || "—"}</p>
              <p>Company Code: {reference.companyCode || "—"}</p>
              <p>Currency: {reference.currency || "—"}</p>
              <p>Original Gross Amount: {formatAmount(reference.originalGrossAmount, reference.currency)}</p>
              <p>Status: {receivingLabel(reference.status)}</p>
            </section>
            {memo && <p><span className={receivingBadgeClass(memo.status)}>{receivingLabel(memo.status)}</span> Credit Memo {memo.creditMemoNumber}</p>}
            {failed && memo?.erpMessage && <p className="srcv-error">{memo.erpMessage}</p>}
            {unknown && <p className="sila-alert sila-alert--warning">Credit memo posting is unknown. Reconcile it. Do not retry blindly.</p>}
            <div className="sila-form-grid">
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-ref">Credit memo number</label>
                <input id="srcv-cm-ref" className="sila-input" value={memo?.creditMemoNumber || cmReference || "Assigned on save"} readOnly />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-header">Header text</label>
                <input id="srcv-cm-header" className="sila-input" value={headerText} onChange={(event) => setHeaderText(event.target.value)} disabled={posted} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-doc">Document date</label>
                <input id="srcv-cm-doc" className="sila-input" type="date" value={documentDate} onChange={(event) => setDocumentDate(event.target.value)} disabled={posted} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-post">Posting date</label>
                <input id="srcv-cm-post" className="sila-input" type="date" value={postingDate} onChange={(event) => setPostingDate(event.target.value)} disabled={posted} />
              </div>
              <div className="sila-field">
                <label className="sila-label" htmlFor="srcv-cm-tax">Tax calculation date</label>
                <input id="srcv-cm-tax" className="sila-input" type="date" value={taxDate} onChange={(event) => setTaxDate(event.target.value)} disabled={posted} />
              </div>
            </div>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th>Include</th>
                    <th>PO</th>
                    <th>PO Item</th>
                    <th>Material</th>
                    <th>Description</th>
                    <th>UOM</th>
                    <th>Tax</th>
                    <th>Original qty</th>
                    <th>Original amount</th>
                    <th>Previously credited qty</th>
                    <th>Previously credited amount</th>
                    <th>Remaining qty</th>
                    <th>Remaining amount</th>
                    <th>Credit quantity</th>
                    <th>Credit amount</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const draft = drafts[line.invoiceLineId] ?? { invoiceLineId: line.invoiceLineId, ...creditMemoDraftFromLine(line) };
                    return (
                      <tr key={line.invoiceLineId}>
                        <td>
                          <input
                            type="checkbox"
                            disabled={posted}
                            checked={draft.included}
                            onChange={(event) => changeDraft(line, event.target.checked
                              ? { invoiceLineId: line.invoiceLineId, ...creditMemoIncludeDraft(line, draft.reason) }
                              : { invoiceLineId: line.invoiceLineId, ...creditMemoExcludeDraft(draft.reason) })}
                          />
                        </td>
                        <td>{line.poNumber || reference.poNumber || "—"}</td>
                        <td>{line.poItem || line.lineNumber}</td>
                        <td>{line.material || "—"}</td>
                        <td>{line.description}</td>
                        <td>{line.uom || "—"}</td>
                        <td>{line.taxCode || "—"}</td>
                        <td>{line.originalQuantity}</td>
                        <td>{formatAmount(line.originalAmount, reference.currency)}</td>
                        <td>{line.previouslyCreditedQuantity}</td>
                        <td>{formatAmount(line.previouslyCreditedAmount, reference.currency)}</td>
                        <td>{line.remainingQuantity}</td>
                        <td>{formatAmount(line.remainingAmount, reference.currency)}</td>
                        <td>
                          <input className="sila-input" inputMode="decimal" disabled={posted || !draft.included} value={draft.quantity} onChange={(event) => changeDraft(line, { quantity: event.target.value }, true)} />
                        </td>
                        <td>
                          <input className="sila-input" inputMode="decimal" disabled={posted || !draft.included} value={draft.amount} onChange={(event) => changeDraft(line, { amount: event.target.value })} />
                        </td>
                        <td>
                          <input className="sila-input" disabled={posted || !draft.included} value={draft.reason} onChange={(event) => changeDraft(line, { reason: event.target.value })} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!posted && !unknown && (
              <div className="srcv-actions">
                <button type="button" className="sila-btn sila-btn--secondary" disabled={busy !== null} onClick={() => void save()}>
                  {busy === "save" ? "Saving..." : "Save draft"}
                </button>
                {failed && memo && (
                  <button type="button" className="sila-btn sila-btn--primary" disabled={busy !== null} onClick={() => void run("retry", () => retryCreditMemo(memo.id))}>
                    {busy === "retry" ? "Retrying..." : "Retry Credit Memo Posting"}
                  </button>
                )}
              </div>
            )}
            {memo && <EmptyState title={memo.creditMemoNumber || "Credit Memo"} description={`Status ${receivingLabel(memo.status)}${memo.erpReference ? ` · SAP ${memo.erpReference}` : ""}`} />}
            <SilaDocumentTrackPanel track={memo?.documentTrack} />
          </>
        )}
      </div>
    </Modal>
  );
};

export default SilaCreditMemoDialog;
