import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, KpiCard, Loader, PageHeader, Pagination, toastService } from "@vosox/shared-ui";
import {
  downloadShortageExcel,
  getAllShortageLines,
  getShortageReport,
  type SilaShortageFilter,
  type SilaShortageReport as ShortageReportData,
} from "../../../api/silaMe/silaControlApi";
import { getLocations, type SilaLocation } from "../../../api/silaMe/silaInventoryApi";
import { SILA_JUSTIFICATION_CATEGORIES } from "../../../api/silaMe/silaStockCountApi";
import { formatMoney, scLabel } from "../stockCount/stockCountFormat";
import { ShortageGroupTable, ShortageLinesTable } from "./ShortageLinesTable";
import { PAGE_SIZE, categoryLabel, daysAgo } from "./controlFormat";
import ShortageSendDialog from "./ShortageSendDialog";
import { downloadShortagePdf } from "./shortagePdf";
import "../silaMeTheme.css";
import "../stockCount/StockCount.css";
import "./SilaControl.css";

export interface SilaShortageReportProps {
  /** Opens a stock count from a report line (e.g. SilaStockCounts with initialCountId). */
  onOpenCount?: (stockCountId: string) => void;
}

const ENQUIRY_STATUSES = ["SENT", "RESPONDED", "MORE_INFORMATION_REQUIRED", "ACCEPTED", "REJECTED"];
const SAP_STATUSES = ["NOT_POSTED", "PENDING", "POSTED", "FAILED", "UNKNOWN", "SKIPPED"];

const initialFilter = (): SilaShortageFilter => ({ from: daysAgo(30), to: daysAgo(0) });

/** Shortages found by stock counts: totals, by location, by justification and every line, with Excel and PDF download. */
const SilaShortageReport: React.FC<SilaShortageReportProps> = ({ onOpenCount }) => {
  const [draft, setDraft] = useState<SilaShortageFilter>(initialFilter);
  const [filter, setFilter] = useState<SilaShortageFilter>(initialFilter);
  const [page, setPage] = useState(1);
  const [report, setReport] = useState<ShortageReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locations, setLocations] = useState<SilaLocation[]>([]);
  const [exporting, setExporting] = useState<"excel" | "pdf" | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getLocations()
      .then(setLocations)
      .catch((err: unknown) => toastService.error(err instanceof Error ? err.message : "Could not load the locations."));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getShortageReport(filter, { index: (page - 1) * PAGE_SIZE, limit: PAGE_SIZE }));
    } catch (err: unknown) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Could not load the shortage report.");
    } finally {
      setLoading(false);
    }
  }, [filter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const apply = (event: React.FormEvent) => {
    event.preventDefault();
    if (draft.from && draft.to && draft.from > draft.to) {
      toastService.error("The From date must be on or before the To date.");
      return;
    }
    setPage(1);
    setFilter({ ...draft });
  };

  const locationName = locations.find((location) => location.id === filter.locationId)?.locationName ?? "All";

  const exportExcel = async () => {
    setExporting("excel");
    try {
      await downloadShortageExcel(filter);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not download the Excel file.");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!report) return;
    setExporting("pdf");
    try {
      const lines = await getAllShortageLines(filter, report.totalLines);
      downloadShortagePdf(report, lines, {
        location: locationName,
        category: filter.category ? categoryLabel(filter.category) : "All",
        enquiryStatus: filter.enquiryStatus ? scLabel(filter.enquiryStatus) : "All",
      });
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not create the PDF.");
    } finally {
      setExporting(null);
    }
  };

  const totalPages = report ? Math.max(1, Math.ceil(report.totalLines / PAGE_SIZE)) : 1;
  const totals = report?.totals;
  const money = (value?: number) => `${totals?.currency ? `${totals.currency} ` : ""}${formatMoney(value ?? 0)}`;

  return (
    <div className="sila-root sila-me sctl-stack">
      <PageHeader
        className="pud-page-header"
        title="Shortage Report"
        description="Shortages from physical counts, with their justification, review and posting."
      />

      <section className="sila-card">
        <form className="sila-card-body sctl-filters" onSubmit={apply}>
          <div className="sila-field">
            <label className="sila-label" htmlFor="ssr-from">From</label>
            <input id="ssr-from" type="date" className="sila-input" value={draft.from ?? ""} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="ssr-to">To</label>
            <input id="ssr-to" type="date" className="sila-input" value={draft.to ?? ""} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="ssr-location">Location</label>
            <select id="ssr-location" className="sila-select" value={draft.locationId ?? ""} onChange={(e) => setDraft({ ...draft, locationId: e.target.value })}>
              <option value="">All locations</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>{location.locationName}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="ssr-category">Justification</label>
            <select id="ssr-category" className="sila-select" value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              <option value="">All</option>
              <option value="NOT_JUSTIFIED">Not justified</option>
              {SILA_JUSTIFICATION_CATEGORIES.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="ssr-enquiry">Enquiry status</label>
            <select id="ssr-enquiry" className="sila-select" value={draft.enquiryStatus ?? ""} onChange={(e) => setDraft({ ...draft, enquiryStatus: e.target.value })}>
              <option value="">All</option>
              {ENQUIRY_STATUSES.map((value) => (
                <option key={value} value={value}>{scLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="sila-field">
            <label className="sila-label" htmlFor="ssr-sap">SAP status</label>
            <select id="ssr-sap" className="sila-select" value={draft.sapStatus ?? ""} onChange={(e) => setDraft({ ...draft, sapStatus: e.target.value })}>
              <option value="">All</option>
              {SAP_STATUSES.map((value) => (
                <option key={value} value={value}>{scLabel(value)}</option>
              ))}
            </select>
          </div>
          <div className="sctl-filter-actions">
            <button type="submit" className="sila-btn sila-btn--primary" disabled={loading}>Apply</button>
            <button type="button" className="sila-btn sila-btn--secondary" disabled={!report || exporting !== null} onClick={exportExcel}>
              {exporting === "excel" ? "Downloading..." : "Excel"}
            </button>
            <button type="button" className="sila-btn sila-btn--secondary" disabled={!report || exporting !== null} onClick={exportPdf}>
              {exporting === "pdf" ? "Creating..." : "PDF"}
            </button>
            <button type="button" className="sila-btn sila-btn--secondary" disabled={!report} onClick={() => setSending(true)}>
              Send report
            </button>
          </div>
        </form>
      </section>

      {loading && !report ? (
        <Loader size={24} message="Loading the shortage report..." />
      ) : error ? (
        <EmptyState
          variant="error"
          title="Couldn't load the shortage report"
          description={error}
          action={<button type="button" className="sila-btn sila-btn--secondary" onClick={load}>Try again</button>}
        />
      ) : report && totals ? (
        <>
          <div className="sila-kpi-grid">
            <KpiCard
              label="Shortage value"
              value={money(totals.shortageValue)}
              meta={`${totals.lines} lines · ${totals.locations ?? 0} locations · ${totals.materials ?? 0} materials`}
              tone={totals.lines > 0 ? "danger" : "neutral"}
            />
            <KpiCard
              label="Awaiting justification"
              value={formatMoney(totals.shortageValue - totals.justifiedValue)}
              meta={`${totals.lines - totals.justifiedLines} lines`}
              tone={totals.lines > totals.justifiedLines ? "warning" : "neutral"}
            />
            <KpiCard label="Justified" value={formatMoney(totals.justifiedValue)} meta={`${totals.justifiedLines} lines`} />
            <KpiCard label="Accepted" value={formatMoney(totals.acceptedValue)} meta={`${totals.acceptedLines} lines`} tone="success" />
            <KpiCard label="Rejected" value={formatMoney(totals.rejectedValue)} meta={`${totals.rejectedLines} lines`} tone="warning" />
            <KpiCard label="Posted" value={formatMoney(totals.postedValue)} meta={`${totals.postedLines} lines`} tone="primary" />
            <KpiCard label="Unresolved" value={money(totals.unresolvedValue)} meta="Not accepted or rejected" tone={(totals.unresolvedValue ?? 0) > 0 ? "warning" : "neutral"} />
            <KpiCard label="Approved" value={money(totals.approvedValue)} meta="Counts approved" />
            <KpiCard label="SAP pending" value={money(totals.sapPendingValue)} meta="Waiting for the ERP" tone={(totals.sapPendingValue ?? 0) > 0 ? "warning" : "neutral"} />
            <KpiCard label="SAP failed" value={money(totals.sapFailedValue)} meta="Reprocess in ERP postings" tone={(totals.sapFailedValue ?? 0) > 0 ? "danger" : "neutral"} />
          </div>

          <div className="sctl-groups">
            <ShortageGroupTable title="By location" groups={report.byLocation} label={(name) => name} totalValue={totals.shortageValue} />
            <ShortageGroupTable title="By justification" groups={report.byReason} label={categoryLabel} totalValue={totals.shortageValue} />
          </div>

          <section className="sila-card">
            <div className="sila-card-header">
              <h2 className="sila-card-title">Shortage lines ({report.totalLines})</h2>
            </div>
            {report.totalLines === 0 ? (
              <EmptyState title="No shortages in this period" />
            ) : (
              <>
                <ShortageLinesTable lines={report.lines} onOpenCount={onOpenCount} />
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                  onPrevious={() => setPage(Math.max(1, page - 1))}
                  onNext={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={loading}
                />
              </>
            )}
          </section>
        </>
      ) : null}

      {sending && <ShortageSendDialog filter={filter} onClose={() => setSending(false)} />}
    </div>
  );
};

export default SilaShortageReport;
