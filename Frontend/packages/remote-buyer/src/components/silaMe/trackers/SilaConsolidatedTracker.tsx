import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, Loader, Modal, PageHeader, Pagination, toastService } from "@vosox/shared-ui";
import {
  getErpPostingFlow,
  getTracker,
  getTrackerDetail,
  reprocessTracker,
  type SilaInvoiceFlow,
  type SilaTrackerDetail,
  type SilaTrackerFlowStep,
  type SilaTrackerName,
  type SilaTrackerRow,
  type SilaTrackerSummary,
} from "../../../api/silaMe/silaTrackerApi";
import { getErpPostingPayload, reconcileErpPosting } from "../../../api/silaMe/silaReceivingApi";
import { formatDateTime } from "../../cart/lineFormat";
import "../silaMeTheme.css";
import "../receiving/SilaReceiving.css";
import "./SilaTracker.css";

const PAGE_SIZE = 25;

const TYPES = [
  "POS_SALE", "POS_POSITIVE_CORRECTION", "INTERNAL_TRANSFER_311", "PLANT_TRANSFER_301",
  "NEGATIVE_STOCK_ADJUSTMENT", "POSITIVE_STOCK_ADJUSTMENT", "PHYSICAL_COUNT_SHORTAGE", "PHYSICAL_COUNT_SURPLUS",
  "GOODS_ISSUE", "GRN", "INVOICE_POSTING", "PO_INVOICE", "NON_PO_INVOICE", "SUPPLIER_INVOICE_ATTACHMENT",
  "PO_CREATE", "SUPPLIER_SALES_ORDER_CREATE", "CONTRACT_CREATE",
  "GET_SUPPLIER", "GET_MATERIAL", "GET_PO", "GET_POS_SALE", "POST_SUPPLIER",
];

const STATUSES = ["SUCCESS", "PROCESSING", "REPROCESSING", "FAILED", "FAILED_LOCAL", "POSTING_UNKNOWN", "PARTIAL", "RECEIVED"];

const labelOf = (value?: string | null): string => {
  if (!value) return "—";
  const known: Record<string, string> = {
    SUCCESS: "Successful",
    FAILED: "Failed",
    FAILED_LOCAL: "Local failure",
    POSTING_UNKNOWN: "Needs reconciliation",
    PROCESSING: "Processing",
    REPROCESSING: "Reprocessing",
    RECEIVED: "Received",
    PARTIAL: "Partial",
    NOT_STARTED: "Not started",
    UNKNOWN: "Unknown",
    INBOUND: "Inbound",
    OUTBOUND: "Outbound",
    MASTER_DATA: "Master data",
    TRANSACTION_DATA: "Transaction",
    LOCAL: "Local finalization",
    ERP: "ERP processing",
    RECEIVE: "Receive",
    INVOICE: "Invoice posting",
    INVOICE_POSTING: "Invoice posting",
    PO_INVOICE: "PO Invoice",
    NON_PO_INVOICE: "Non-PO Invoice",
    SUPPLIER_INVOICE_ATTACHMENT: "Invoice attachment",
  };
  return known[value] ?? value.split("_").join(" ");
};

const prettyPayload = (value?: string | null): string => {
  const text = value?.trim();
  if (!text) return "";
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
};

const downloadPayload = (detail: SilaTrackerDetail) => {
  const text = prettyPayload(detail.technicalDetail);
  if (!text) return;
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const name = (detail.businessReference || detail.id).replace(/[^\w.-]+/g, "_");
  link.href = url;
  link.download = `${name}-payload.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const isInvoiceTxn = (type?: string | null): boolean =>
  type === "INVOICE" || type === "INVOICE_POSTING" || type === "PO_INVOICE" || type === "NON_PO_INVOICE"
  || type === "INVOICE_ATTACHMENT" || type === "SUPPLIER_INVOICE_ATTACHMENT";

const resultSummary = (row: SilaTrackerRow): { label: "SUCCESS" | "FAILURE" | "—"; detail: string; ok: boolean } => {
  const detail = row.lastError?.trim()
    || (isInvoiceTxn(row.transactionType) && row.erpReference && (row.overallStatus === "SUCCESS" || row.erpStatus === "SUCCESS")
      ? `Successful. SAP invoice ${row.erpReference}.`
      : "");
  if (!detail) {
    if (row.overallStatus === "SUCCESS" || row.erpStatus === "SUCCESS") {
      return { label: "SUCCESS", detail: row.erpReference ? `SAP ${row.erpReference}` : "Successful.", ok: true };
    }
    if (row.overallStatus === "FAILED" || row.overallStatus === "FAILED_LOCAL" || row.erpStatus === "FAILED") {
      return { label: "FAILURE", detail: "Failed.", ok: false };
    }
    return { label: "—", detail: "", ok: false };
  }
  const ok = detail.startsWith("Successful.") || row.overallStatus === "SUCCESS" || row.erpStatus === "SUCCESS";
  return { label: ok ? "SUCCESS" : "FAILURE", detail, ok };
};

const erpInvoiceId = (row: SilaTrackerRow): string =>
  isInvoiceTxn(row.transactionType) ? (row.erpReference || "—") : "—";

const badgeClass = (status?: string | null): string => {
  switch (status) {
    case "SUCCESS":
      return "sila-badge sila-badge--success";
    case "FAILED":
    case "FAILED_LOCAL":
      return "sila-badge sila-badge--danger";
    case "POSTING_UNKNOWN":
    case "UNKNOWN":
    case "REPROCESSING":
    case "PARTIAL":
    case "PROCESSING":
      return "sila-badge sila-badge--warning";
    default:
      return "sila-badge sila-badge--info";
  }
};

const day = (offset: number): string => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
};

interface SilaConsolidatedTrackerProps {
  tracker: SilaTrackerName;
  canReprocess: boolean;
}

const emptySummary: SilaTrackerSummary = { total: 0, processing: 0, successful: 0, failed: 0, reprocessing: 0, needsAttention: 0 };

const SilaConsolidatedTracker: React.FC<SilaConsolidatedTrackerProps> = ({ tracker, canReprocess }) => {
  const title = tracker === "PURCHASING" ? "Purchasing Transactions" : "SILA ME Transactions";
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [transactionType, setTransactionType] = useState("");
  const [direction, setDirection] = useState("");
  const [from, setFrom] = useState(day(-30));
  const [to, setTo] = useState(day(0));
  const [companyCode, setCompanyCode] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [dataClass, setDataClass] = useState("");
  const [stage, setStage] = useState("");
  const [plant, setPlant] = useState("");
  const [storageLocation, setStorageLocation] = useState("");
  const [material, setMaterial] = useState("");
  const [integration, setIntegration] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<SilaTrackerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState<SilaTrackerSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<SilaTrackerDetail | null>(null);
  const [flow, setFlow] = useState<SilaInvoiceFlow | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<SilaTrackerRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setAppliedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getTracker(tracker, {
        search: appliedSearch,
        transactionType,
        direction,
        from,
        to,
        companyCode,
        status,
        userId: /^[0-9a-fA-F-]{36}$/.test(userId.trim()) ? userId.trim() : undefined,
        dataClass,
        stage,
        plant,
        storageLocation,
        material,
        integration,
        index: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      setRows(result.rows ?? []);
      setTotal(result.total ?? 0);
      setSummary(result.summary ?? emptySummary);
      setSelected([]);
    } catch (err: unknown) {
      setRows([]);
      setTotal(0);
      setSummary(emptySummary);
      setError(err instanceof Error ? err.message : "Could not load the transaction tracker.");
    } finally {
      setLoading(false);
    }
  }, [tracker, appliedSearch, transactionType, direction, from, to, companyCode, status, userId, dataClass, stage, plant, storageLocation, material, integration, page]);

  useEffect(() => {
    load();
  }, [load]);

  const open = async (row: SilaTrackerRow) => {
    setDetailError(null);
    setFlow(null);
    const withPayload = async (detail: SilaTrackerDetail): Promise<SilaTrackerDetail> => {
      if (!row.erpPostingId) return detail;
      if (detail.technicalDetail?.trim() && detail.erpMessage?.trim()) return detail;
      const payload = await getErpPostingPayload(row.erpPostingId);
      if (!payload) return detail;
      return {
        ...detail,
        technicalDetail: detail.technicalDetail?.trim() ? detail.technicalDetail : payload.technicalDetail,
        erpMessage: detail.erpMessage?.trim() ? detail.erpMessage : payload.erpMessage,
        erpHttpStatus: detail.erpHttpStatus != null ? detail.erpHttpStatus : payload.erpHttpStatus,
      };
    };
    try {
      const loaded = await getTrackerDetail(tracker, row.id);
      const opened = await withPayload(loaded ?? { ...row, attempts: [] });
      const invoiceFlow = opened.flow?.length
        ? { steps: opened.flow, erpInvoiceId: opened.erpReference, message: opened.lastError }
        : row.erpPostingId && isInvoiceTxn(row.transactionType)
          ? await getErpPostingFlow(row.erpPostingId)
          : null;
      if (invoiceFlow?.message) opened.lastError = invoiceFlow.message;
      if (!opened.erpReference && invoiceFlow?.erpInvoiceId) opened.erpReference = invoiceFlow.erpInvoiceId;
      setFlow(invoiceFlow && invoiceFlow.steps.length > 0 ? invoiceFlow : null);
      setDetail(opened);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : "Could not open the transaction.");
      setDetail(await withPayload({ ...row, attempts: [] }));
    }
  };

  const eligibleSelected = useMemo(
    () => rows.filter((row) => selected.includes(row.id) && row.action === "REPROCESS"),
    [rows, selected],
  );

  const runReprocess = async (items: SilaTrackerRow[]) => {
    setBusy(true);
    try {
      const result = await reprocessTracker(items);
      const skipped = selected.length - items.length;
      toastService.success(`${result.completed} reprocessed. ${result.ineligible + skipped} not eligible.`);
      setConfirming(null);
      setDetail(null);
      await load();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reprocess the transactions.");
    } finally {
      setBusy(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromLabel = confirming?.[0]?.reprocessFrom;

  return (
    <div className="sila-me srcv-page">
      <PageHeader
        className="pud-page-header"
        title="Transaction Tracker"
        description={title}
      />
      <section className="strk-kpis" aria-label="Tracker summary">
        <Kpi label="Total" value={summary.total} />
        <Kpi label="Processing" value={summary.processing} />
        <Kpi label="Successful" value={summary.successful} />
        <Kpi label="Failed" value={summary.failed} />
        <Kpi label="Reprocessing" value={summary.reprocessing} />
        <Kpi label="Needs attention" value={summary.needsAttention} />
      </section>
      <section className="sila-card">
        <div className="srcv-filters">
          <Field id="strk-search" label="Search">
            <input id="strk-search" className="sila-input" type="search" placeholder="Invoice, reference, PO, GRN, transfer, POS" value={search} onChange={(event) => setSearch(event.target.value)} />
          </Field>
          <Field id="strk-type" label="Transaction type">
            <select id="strk-type" className="sila-select" value={transactionType} onChange={(event) => { setTransactionType(event.target.value); setPage(1); }}>
              <option value="">All</option>
              {TYPES.map((type) => <option key={type} value={type}>{labelOf(type)}</option>)}
            </select>
          </Field>
          <Field id="strk-direction" label="Direction">
            <select id="strk-direction" className="sila-select" value={direction} onChange={(event) => { setDirection(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="INBOUND">Inbound</option>
              <option value="OUTBOUND">Outbound</option>
            </select>
          </Field>
          <Field id="strk-from" label="From">
            <input id="strk-from" className="sila-input" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-to" label="To">
            <input id="strk-to" className="sila-input" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-company" label="Company code">
            <input id="strk-company" className="sila-input" value={companyCode} onChange={(event) => { setCompanyCode(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-status" label="Status">
            <select id="strk-status" className="sila-select" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All</option>
              {STATUSES.map((item) => <option key={item} value={item}>{labelOf(item)}</option>)}
            </select>
          </Field>
          <Field id="strk-user" label="User">
            <input id="strk-user" className="sila-input" placeholder="User id" value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-class" label="Data">
            <select id="strk-class" className="sila-select" value={dataClass} onChange={(event) => { setDataClass(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="MASTER_DATA">Master data</option>
              <option value="TRANSACTION_DATA">Transaction</option>
            </select>
          </Field>
          <Field id="strk-stage" label="Processing stage">
            <select id="strk-stage" className="sila-select" value={stage} onChange={(event) => { setStage(event.target.value); setPage(1); }}>
              <option value="">All</option>
              <option value="RECEIVE">Receive</option>
              <option value="ERP">ERP</option>
              <option value="LOCAL">Local</option>
            </select>
          </Field>
          <Field id="strk-plant" label="Plant">
            <input id="strk-plant" className="sila-input" value={plant} onChange={(event) => { setPlant(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-storage" label="Storage location">
            <input id="strk-storage" className="sila-input" value={storageLocation} onChange={(event) => { setStorageLocation(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-material" label="Material">
            <input id="strk-material" className="sila-input" value={material} onChange={(event) => { setMaterial(event.target.value); setPage(1); }} />
          </Field>
          <Field id="strk-api" label="API / integration">
            <input id="strk-api" className="sila-input" value={integration} onChange={(event) => { setIntegration(event.target.value); setPage(1); }} />
          </Field>
        </div>
        {canReprocess && (
          <div className="strk-actions" style={{ padding: "0 1rem 0.75rem" }}>
            <button type="button" className="sila-btn sila-btn--primary" disabled={eligibleSelected.length === 0 || busy} onClick={() => setConfirming(eligibleSelected)}>
              Reprocess selected ({eligibleSelected.length})
            </button>
            <span className="srcv-sub">{selected.length - eligibleSelected.length} selected row{selected.length - eligibleSelected.length === 1 ? "" : "s"} cannot be retried, including unknown ERP results.</span>
          </div>
        )}
        {loading && rows.length === 0 ? (
          <Loader size={24} message="Loading transactions..." />
        ) : error ? (
          <EmptyState variant="error" title="Couldn't load transactions" description={error} action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>} />
        ) : rows.length === 0 ? (
          <EmptyState title="No transactions match" description="Adjust the filters. The default view is the last 30 days." />
        ) : (
          <>
            <div className="sila-table-wrap">
              <table className="sila-table">
                <thead>
                  <tr>
                    <th scope="col"><span className="sila-visually-hidden">Select</span></th>
                    <th scope="col">Date / time</th>
                    <th scope="col">Transaction ID</th>
                    <th scope="col">Data</th>
                    <th scope="col">Direction</th>
                    <th scope="col">Company / plant</th>
                    <th scope="col">Reference</th>
                    <th scope="col">ERP invoice ID</th>
                    <th scope="col">Receive</th>
                    <th scope="col">ERP</th>
                    <th scope="col">Local</th>
                    <th scope="col">Overall</th>
                    <th scope="col">Retries</th>
                    <th scope="col">Result</th>
                    <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${row.businessReference || row.id}`}
                          checked={selected.includes(row.id)}
                          disabled={!canReprocess || row.action !== "REPROCESS"}
                          onChange={(event) => setSelected((current) => event.target.checked ? [...current, row.id] : current.filter((id) => id !== row.id))}
                        />
                      </td>
                      <td>{formatDateTime(row.occurredOn)}</td>
                      <td>
                        <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => open(row)}>{row.id}</button>
                        <span className="srcv-sub">{labelOf(row.transactionType)}</span>
                      </td>
                      <td>{labelOf(row.dataClass)}</td>
                      <td>{labelOf(row.direction)}</td>
                      <td>
                        {row.companyCode || "—"}
                        <span className="srcv-sub">{[row.propertyName, row.plant, row.storageLocation].filter(Boolean).join(" · ") || row.sourceSystem}</span>
                      </td>
                      <td>
                        {row.businessReference || "—"}
                        {row.integrationName && <span className="srcv-sub">{row.integrationName}{row.movementType ? ` · ${row.movementType}` : ""}</span>}
                      </td>
                      <td>{erpInvoiceId(row)}</td>
                      <td><span className={badgeClass(row.receiveStatus)}>{labelOf(row.receiveStatus)}</span></td>
                      <td><span className={badgeClass(row.erpStatus)}>{labelOf(row.erpStatus)}</span></td>
                      <td><span className={badgeClass(row.localStatus)}>{labelOf(row.localStatus)}</span></td>
                      <td><span className={badgeClass(row.overallStatus)}>{labelOf(row.overallStatus)}</span></td>
                      <td>{row.retryCount}</td>
                      <td className="strk-result">
                        <ResultCell row={row} />
                      </td>
                      <td>
                        {canReprocess && row.action === "REPROCESS" && (
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setConfirming([row])}>Reprocess</button>
                        )}
                        {canReprocess && row.action === "RECONCILE" && row.erpPostingId && (
                          <Reconcile postingId={row.erpPostingId} reference={row.businessReference || row.id} onDone={load} />
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
              summary={`${total} transaction${total === 1 ? "" : "s"}`}
              disabled={loading}
            />
          </>
        )}
      </section>
      {detail && (
        <section className="sila-card strk-detail">
          <div className="strk-actions">
            <button type="button" className="sila-btn sila-btn--secondary" onClick={() => { setDetail(null); setFlow(null); }}>Back to list</button>
            <h2 className="sila-section-title">{labelOf(detail.transactionType)}</h2>
            {canReprocess && detail.action === "REPROCESS" && (
              <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={busy} onClick={() => setConfirming([detail])}>
                Reprocess
              </button>
            )}
          </div>
          {detailError && <p className="srcv-error">{detailError}</p>}
          <dl className="srcv-facts">
            <Fact label="Transaction ID" value={detail.id} />
            <Fact label="Type" value={labelOf(detail.transactionType)} />
            <Fact label="Created" value={formatDateTime(detail.occurredOn)} />
            <Fact label="Reference" value={detail.businessReference} />
            <Fact label="Company code" value={detail.companyCode} />
            <Fact label="Direction" value={labelOf(detail.direction)} />
            <Fact label="Source" value={detail.sourceSystem} />
            <Fact label="Target" value={detail.targetSystem} />
            <Fact label="API" value={detail.integrationName} />
            <Fact label="Status" value={labelOf(detail.overallStatus)} />
            <Fact label="ERP" value={labelOf(detail.erpStatus)} />
            {isInvoiceTxn(detail.transactionType) ? <Fact label="ERP invoice ID" value={detail.erpReference} /> : detail.erpReference ? <Fact label="ERP reference" value={detail.erpReference} /> : null}
            {detail.erpHttpStatus != null ? <Fact label="HTTP status" value={String(detail.erpHttpStatus)} /> : null}
            {detail.retryCount > 0 ? <Fact label="Retries" value={String(detail.retryCount)} /> : null}
            {(detail.localReference ?? "").includes("PO ") ? <Fact label="Supplier, PO, GRN" value={detail.localReference} /> : null}
          </dl>
          {detail.overallStatus === "FAILED_LOCAL" && (
            <p>SAP already created {detail.erpReference || "the material document"}. Reprocessing resumes from local finalization and will not call SAP again.</p>
          )}
          {detail.lastError && (
            <div className={detail.lastError.startsWith("Successful.") ? "strk-result strk-result--ok" : "srcv-error"}>
              {detail.lastError.startsWith("Successful.") ? (
                <>
                  <span className="strk-result-main">{detail.lastError.split(/(?<=\.)\s+/)[0]}</span>
                  {detail.lastError.split(/(?<=\.)\s+/).slice(1).join(" ") && (
                    <span className="strk-result-sub">{detail.lastError.split(/(?<=\.)\s+/).slice(1).join(" ")}</span>
                  )}
                </>
              ) : detail.lastError}
            </div>
          )}
          {detail.localError && detail.localError !== detail.lastError && <p className="srcv-error">{detail.localError}</p>}
          {flow && flow.steps.length > 0 ? (
            <FlowChain steps={flow.steps} />
          ) : (
            <PayloadIcons
              request={detail.technicalDetail}
              response={detail.erpMessage}
              onDownloadRequest={detail.technicalDetail?.trim() ? () => downloadPayload(detail) : undefined}
            />
          )}
        </section>
      )}
      {confirming && (
        <Modal
          isOpen
          onClose={busy ? () => undefined : () => setConfirming(null)}
          size="md"
          headerProps={{ heading: confirming.length === 1 ? "Reprocess transaction" : `Reprocess ${confirming.length} transactions` }}
          footerProps={{
            primaryButton: { text: "Reprocess", onClick: () => runReprocess(confirming), loading: busy, disabled: busy },
            secondaryButton: { text: "Cancel", onClick: () => setConfirming(null), disabled: busy },
          }}
        >
          <div className="sila-root sila-me srcv-stack">
            {confirming.length === 1 ? (
              <>
                <p>Transaction ID: {confirming[0].id}</p>
                <p>Transaction type: {labelOf(confirming[0].transactionType)}</p>
                <p>Failed stage: {labelOf(confirming[0].reprocessFrom)}</p>
                <p>Last error: {confirming[0].lastError || "—"}</p>
              </>
            ) : (
              <p>{confirming.length} eligible transactions will continue from their own failed stage. Unknown ERP results stay out of this batch.</p>
            )}
            <p>
              <strong>Reprocessing from: {labelOf(fromLabel)}</strong>
            </p>
            {fromLabel === "LOCAL" && <p>ERP has already processed this transaction successfully. SAP will not be called again.</p>}
            {fromLabel === "ERP" && <p>Receive is already complete. Only the ERP call, then local finalization, will run.</p>}
            {fromLabel === "RECEIVE" && <p>Processing continues from the received transaction. SAP is not called unless the ERP stage is reached and has not already succeeded.</p>}
          </div>
        </Modal>
      )}
    </div>
  );
};

const ResultCell: React.FC<{ row: SilaTrackerRow }> = ({ row }) => {
  const result = resultSummary(row);
  const [open, setOpen] = useState(false);
  if (result.label === "—") {
    return <span className="strk-result-label">—</span>;
  }
  return (
    <span className={`strk-result-chip${result.ok ? " strk-result-chip--ok" : " strk-result-chip--bad"}`}>
      <span className="strk-result-label">{result.label}</span>
      {result.detail && (
        <span className="strk-result-info-wrap">
          <button
            type="button"
            className="strk-result-info"
            aria-label="Result details"
            aria-expanded={open}
            title={result.detail}
            onClick={(event) => {
              event.stopPropagation();
              setOpen((current) => !current);
            }}
            onBlur={() => setOpen(false)}
          >
            i
          </button>
          {open && (
            <span className="strk-result-tip" role="tooltip">
              {result.detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
};

const Kpi: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="strk-kpi">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const Field: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div className="sila-field">
    <label className="sila-label" htmlFor={id}>{label}</label>
    {children}
  </div>
);

const flowTone = (status?: string | null): string => {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "FAILED":
    case "FAILED_LOCAL":
      return "failed";
    case "POSTING_UNKNOWN":
    case "UNKNOWN":
    case "REPROCESSING":
    case "PROCESSING":
    case "PARTIAL":
      return "processing";
    case "NOT_STARTED":
      return "pending";
    default:
      return "pending";
  }
};

const flowGlyph = (status?: string | null): string => {
  switch (flowTone(status)) {
    case "success":
      return "✓";
    case "failed":
      return "!";
    case "processing":
      return "…";
    default:
      return "○";
  }
};

const downloadText = (text: string, fileName: string) => {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const FlowChain: React.FC<{ steps: SilaTrackerFlowStep[] }> = ({ steps }) => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const open = openIndex == null ? null : steps[openIndex] ?? null;
  const request = prettyPayload(open?.request);
  const response = prettyPayload(open?.response);
  return (
    <div className="strk-flow-wrap">
      <p className="strk-flow-hint">Process flow — click a step icon to show its payload.</p>
      <ol className="strk-flow">
        {steps.map((step, index) => {
          const tone = flowTone(step.status);
          const hasPayload = Boolean(step.request?.trim() || step.response?.trim());
          return (
            <li key={`${step.name}-${index}`} className="strk-flow-node">
              {index > 0 && <span className={`strk-flow-connector strk-flow-connector--${tone === "failed" ? "bad" : tone === "success" ? "ok" : ""}`} aria-hidden />}
              <button
                type="button"
                className={`strk-flow-step${openIndex === index ? " strk-flow-step--open" : ""}`}
                disabled={!hasPayload && !step.detail}
                aria-expanded={openIndex === index}
                aria-label={`${step.name}, ${labelOf(step.status)}. ${hasPayload ? "Show payload" : "No payload"}`}
                onClick={() => setOpenIndex((current) => (current === index ? null : index))}
              >
                <span className={`strk-flow-icon strk-flow-icon--${tone}`}>{flowGlyph(step.status)}</span>
                <span className="strk-flow-name">{step.name}</span>
                <span className={`strk-flow-status ${badgeClass(step.status)}`}>{labelOf(step.status)}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {open && (
        <div className="strk-flow-panel" role="region" aria-label={`${open.name} payload`}>
          <div className="strk-actions">
            <h3 className="sila-section-title">{open.name}</h3>
            <span className={badgeClass(open.status)}>{labelOf(open.status)}</span>
            {request && (
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => downloadText(request, `${open.name.replace(/[^\w.-]+/g, "_")}-request.json`)}>
                Download request
              </button>
            )}
            {response && (
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => downloadText(response, `${open.name.replace(/[^\w.-]+/g, "_")}-response.json`)}>
                Download response
              </button>
            )}
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setOpenIndex(null)}>Hide</button>
          </div>
          {open.detail && <p>{open.detail}</p>}
          {request ? (
            <>
              <h4 className="sila-section-title">Request</h4>
              <pre className="strk-tech">{request}</pre>
            </>
          ) : (
            <p className="strk-flow-hint">No request payload was stored for this step.</p>
          )}
          {response ? (
            <>
              <h4 className="sila-section-title">Response</h4>
              <pre className="strk-tech">{response}</pre>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

const PayloadIcons: React.FC<{
  request?: string | null;
  response?: string | null;
  onDownloadRequest?: () => void;
}> = ({ request, response, onDownloadRequest }) => {
  const [open, setOpen] = useState<"request" | "response" | null>(null);
  const requestText = prettyPayload(request);
  const responseText = prettyPayload(response);
  if (!requestText && !responseText) {
    return <p className="strk-flow-hint">No submitted payload was stored for this transaction.</p>;
  }
  return (
    <div className="strk-flow-wrap">
      <p className="strk-flow-hint">Process flow — click an icon to show the payload.</p>
      <ol className="strk-flow">
        {requestText && (
          <li className="strk-flow-node">
            <button
              type="button"
              className={`strk-flow-step${open === "request" ? " strk-flow-step--open" : ""}`}
              aria-expanded={open === "request"}
              onClick={() => setOpen((current) => (current === "request" ? null : "request"))}
            >
              <span className="strk-flow-icon strk-flow-icon--processing">↗</span>
              <span className="strk-flow-name">Request</span>
              <span className="strk-flow-status sila-badge sila-badge--info">Payload</span>
            </button>
          </li>
        )}
        {requestText && responseText && <span className="strk-flow-connector" aria-hidden />}
        {responseText && (
          <li className="strk-flow-node">
            <button
              type="button"
              className={`strk-flow-step${open === "response" ? " strk-flow-step--open" : ""}`}
              aria-expanded={open === "response"}
              onClick={() => setOpen((current) => (current === "response" ? null : "response"))}
            >
              <span className="strk-flow-icon strk-flow-icon--success">↙</span>
              <span className="strk-flow-name">Response</span>
              <span className="strk-flow-status sila-badge sila-badge--info">Payload</span>
            </button>
          </li>
        )}
      </ol>
      {open === "request" && requestText && (
        <div className="strk-flow-panel">
          <div className="strk-actions">
            <h3 className="sila-section-title">Submitted payload</h3>
            {onDownloadRequest && <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={onDownloadRequest}>Download payload</button>}
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setOpen(null)}>Hide</button>
          </div>
          <pre className="strk-tech">{requestText}</pre>
        </div>
      )}
      {open === "response" && responseText && (
        <div className="strk-flow-panel">
          <div className="strk-actions">
            <h3 className="sila-section-title">ERP message</h3>
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setOpen(null)}>Hide</button>
          </div>
          <pre className="strk-tech">{responseText}</pre>
        </div>
      )}
    </div>
  );
};

const Fact: React.FC<{ label: string; value?: string | null }> = ({ label, value }) => (
  <div>
    <dt>{label}</dt>
    <dd>{value || "—"}</dd>
  </div>
);

const Reconcile: React.FC<{ postingId: string; reference: string; onDone: () => void }> = ({ postingId, reference, onDone }) => {
  const [openDialog, setOpenDialog] = useState(false);
  const [posted, setPosted] = useState<"yes" | "no" | "">("");
  const [erpReference, setErpReference] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!posted) return;
    setSaving(true);
    try {
      await reconcileErpPosting(postingId, posted === "yes", posted === "yes" ? erpReference : "");
      toastService.success(posted === "yes" ? `${reference} marked as posted.` : `${reference} can be sent after you confirm it was not posted.`);
      setOpenDialog(false);
      onDone();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not reconcile the posting.");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setOpenDialog(true)}>Reconcile</button>
      {openDialog && (
        <Modal
          isOpen
          onClose={saving ? () => undefined : () => setOpenDialog(false)}
          size="md"
          headerProps={{ heading: `Reconcile ${reference}` }}
          footerProps={{
            primaryButton: { text: "Save", onClick: save, loading: saving, disabled: saving || !posted },
            secondaryButton: { text: "Cancel", onClick: () => setOpenDialog(false), disabled: saving },
          }}
        >
          <div className="sila-root sila-me srcv-stack">
            <p>SAP did not confirm this document. Check the ERP, then record whether it exists. It is not sent again until you say it does not.</p>
            <label htmlFor="strk-yes"><input id="strk-yes" type="radio" checked={posted === "yes"} onChange={() => setPosted("yes")} /> Yes, it was posted</label>
            <label htmlFor="strk-no"><input id="strk-no" type="radio" checked={posted === "no"} onChange={() => setPosted("no")} /> No, it was not posted</label>
            {posted === "yes" && (
              <input className="sila-input" aria-label="ERP document number" value={erpReference} onChange={(event) => setErpReference(event.target.value)} />
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

export default SilaConsolidatedTracker;
