import React, { useEffect, useMemo, useState } from "react";
import { toastService } from "@vosox/shared-ui";
import {
  getCompanyCodes,
  pullPurchaseOrdersScoped,
  type SilaCompanyCode,
  type SilaPullResult,
} from "../../../api/silaMe/silaMasterDataApi";
import SilaSearchableSelect from "../SilaSearchableSelect";
import SilaPullSummary from "./SilaPullSummary";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaPoErpPullPanelProps {
  /** Called after a confirmed pull wrote purchase orders. */
  onPulled: () => void;
}

const todayIso = () => new Date().toISOString().slice(0, 10);
const daysAgoIso = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
};

/** Pull POs from FIVE S4 - GET PO by company code and date range; DB updates only after confirmation. */
const SilaPoErpPullPanel: React.FC<SilaPoErpPullPanelProps> = ({ onPulled }) => {
  const [companyCodes, setCompanyCodes] = useState<SilaCompanyCode[]>([]);
  const [companyCode, setCompanyCode] = useState("");
  const [fromDate, setFromDate] = useState(daysAgoIso(30));
  const [toDate, setToDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<SilaPullResult | null>(null);

  useEffect(() => {
    let active = true;
    getCompanyCodes("", { index: 0, size: 200 }, "ACTIVE")
      .then((rows) => {
        if (!active) return;
        setCompanyCodes(rows);
        if (rows.length > 0) setCompanyCode((current) => current || rows[0].code);
      })
      .catch(() => {
        if (active) setCompanyCodes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => companyCodes.map((row) => ({ value: row.code, label: `${row.code} — ${row.name}` })),
    [companyCodes],
  );

  const canRun = Boolean(companyCode.trim() && fromDate && toDate && fromDate <= toDate);

  const run = async (commit: boolean) => {
    if (!canRun) {
      toastService.error(fromDate > toDate ? "The to date must be on or after the from date." : "Company code and date range are required.");
      return;
    }
    setBusy(true);
    try {
      const result = await pullPurchaseOrdersScoped({
        companyCode,
        fromDate,
        toDate,
        commit,
      });
      setPreview(result);
      if (commit) {
        toastService.success(
          `${result.created} new and ${result.updated} updated purchase orders written from ${result.configurationName || "the ERP"}.`,
        );
        onPulled();
      } else {
        toastService.success(
          `Preview: ${result.read} PO header(s) from ${result.configurationName || "GET_PO"} — confirm to update the database.`,
        );
      }
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not read purchase orders from the ERP.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Pull from ERP</h2>
        <p className="sila-help">Uses FIVE S4 - GET PO. Preview the headers and items, then confirm to update the database.</p>
      </div>
      <div className="srcv-filters">
        <div className="sila-field" style={{ minWidth: "16rem" }}>
          <SilaSearchableSelect
            label="Company code"
            required
            value={companyCode}
            options={options}
            placeholder="Select company code"
            onChange={(value) => {
              setCompanyCode(value);
              setPreview(null);
            }}
          />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-po-pull-from">From order date *</label>
          <input
            id="srcv-po-pull-from"
            className="sila-input"
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setPreview(null);
            }}
          />
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-po-pull-to">To order date *</label>
          <input
            id="srcv-po-pull-to"
            className="sila-input"
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setPreview(null);
            }}
          />
        </div>
        <div className="srcv-actions">
          <button type="button" className="sila-btn sila-btn--secondary" disabled={busy || !canRun} onClick={() => run(false)}>
            {busy && !preview?.committed ? "Reading..." : "Preview"}
          </button>
          <button
            type="button"
            className="sila-btn sila-btn--primary"
            disabled={busy || !preview || preview.committed === true}
            onClick={() => run(true)}
          >
            {busy && preview && !preview.committed ? "Updating..." : "Confirm update"}
          </button>
        </div>
      </div>
      {preview && (
        <div className="srcv-stack" style={{ padding: "0 var(--sila-space-4) var(--sila-space-4)" }}>
          {!preview.committed && (
            <div className="sila-alert sila-alert--warning" role="status">
              Preview only — nothing was written. Confirm update to save these purchase orders.
            </div>
          )}
          <SilaPullSummary result={preview} noun="purchase orders" />
        </div>
      )}
    </section>
  );
};

export default SilaPoErpPullPanel;
