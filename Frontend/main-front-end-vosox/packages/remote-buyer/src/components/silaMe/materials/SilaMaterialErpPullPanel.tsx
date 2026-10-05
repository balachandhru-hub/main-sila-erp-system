import React, { useEffect, useState } from "react";
import { Loader, toastService } from "@vosox/shared-ui";
import { getProperties } from "../../../api/propertyApi";
import {
  getMaterialErpRoute,
  pullMaterialsFromErp,
  type SilaMaterialErpPullResult,
  type SilaMaterialErpRoute,
} from "../../../api/silaMe/silaMaterialsApi";
import { formatDateTime } from "./materialFormat";
import "../silaMeTheme.css";
import "./SilaMaterials.css";

interface SilaMaterialErpPullPanelProps {
  /** Called after a pull changed the material master. */
  onPulled: () => void;
}

/** Pulls the materials of a company code from the ERP through its GET_MATERIAL API. */
const SilaMaterialErpPullPanel: React.FC<SilaMaterialErpPullPanelProps> = ({ onPulled }) => {
  const [companyCodes, setCompanyCodes] = useState<string[]>([]);
  const [companyCode, setCompanyCode] = useState("");
  const [route, setRoute] = useState<SilaMaterialErpRoute | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<SilaMaterialErpPullResult | null>(null);

  // Company codes of the properties, offered as suggestions; any code can be typed.
  useEffect(() => {
    let active = true;
    getProperties()
      .then((properties) => {
        if (!active) return;
        const codes = Array.from(new Set(properties.map((property) => property.companyCode?.trim().toUpperCase()).filter(Boolean)));
        setCompanyCodes(codes);
        if (codes.length > 0) setCompanyCode((current) => current || codes[0]);
      })
      .catch(() => {
        if (active) setCompanyCodes([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // The API a pull would use, shortly after the company code stops changing.
  useEffect(() => {
    const code = companyCode.trim();
    setResult(null);
    if (!code) {
      setRoute(null);
      return undefined;
    }
    let active = true;
    setRouteLoading(true);
    setRouteError(null);
    const timer = window.setTimeout(async () => {
      try {
        const found = await getMaterialErpRoute(code);
        if (active) setRoute(found);
      } catch (err: unknown) {
        if (active) {
          setRoute(null);
          setRouteError(err instanceof Error ? err.message : "Could not load the ERP material API.");
        }
      } finally {
        if (active) setRouteLoading(false);
      }
    }, 300);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [companyCode]);

  const handlePull = async () => {
    setPulling(true);
    try {
      const pulled = await pullMaterialsFromErp(companyCode);
      setResult(pulled);
      toastService.success(`${pulled.read} record(s) read: ${pulled.new} new, ${pulled.changed} changed, ${pulled.failed} failed.`);
      if (pulled.new > 0 || pulled.changed > 0) onPulled();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not pull the materials from the ERP.");
    } finally {
      setPulling(false);
    }
  };

  return (
    <section className="sila-card">
      <div className="sila-card-header">
        <h2 className="sila-card-title">Pull from ERP</h2>
      </div>
      <div className="smat-erp">
        <div className="smat-toolbar">
          <div className="sila-field">
            <label className="sila-label" htmlFor="smat-erp-company">Company code *</label>
            <input id="smat-erp-company" className="sila-input" list="smat-erp-company-codes" maxLength={20}
              value={companyCode} onChange={(event) => setCompanyCode(event.target.value.toUpperCase())} />
            <datalist id="smat-erp-company-codes">
              {companyCodes.map((code) => <option key={code} value={code} />)}
            </datalist>
          </div>
          <button type="button" className="sila-btn sila-btn--primary"
            disabled={pulling || routeLoading || !companyCode.trim() || !route?.configured} onClick={handlePull}>
            {pulling ? "Pulling..." : "Pull materials"}
          </button>
        </div>
        {routeLoading ? (
          <Loader size={20} message="Checking the ERP material API..." />
        ) : routeError ? (
          <div className="sila-alert sila-alert--danger" role="alert">{routeError}</div>
        ) : route && !route.configured ? (
          <div className="sila-alert sila-alert--warning" role="status">
            No GET_MATERIAL API is active for {companyCode} or ALL. Configure it under Integration first.
          </div>
        ) : route ? (
          <dl className="smat-facts">
            <div><dt>API</dt><dd>{route.configurationName || "—"}</dd></div>
            <div><dt>System</dt><dd>{route.systemName || "—"}</dd></div>
            <div><dt>Applies to</dt><dd>{route.entityCode || "—"}</dd></div>
            <div><dt>Last sync</dt><dd>{formatDateTime(route.lastSyncAt)}</dd></div>
          </dl>
        ) : null}
        {route?.lastError && !result && <span className="sila-help">Last error: {route.lastError}</span>}
        {result && (
          <>
            <div className="smat-counts">
              <span className="sila-badge sila-badge--neutral">{result.read} read</span>
              <span className="sila-badge sila-badge--success">{result.new} new</span>
              <span className="sila-badge sila-badge--info">{result.changed} changed</span>
              <span className="sila-badge sila-badge--neutral">{result.unchanged} unchanged</span>
              <span className={`sila-badge sila-badge--${result.failed > 0 ? "danger" : "neutral"}`}>{result.failed} failed</span>
              <span className="sila-badge sila-badge--warning">{result.priceChanges} price change(s) for approval</span>
            </div>
            {result.failures.length > 0 && (
              <ul className="smat-messages" aria-label="Pull messages">
                {result.failures.map((message, index) => <li key={`${index}-${message}`}>{message}</li>)}
              </ul>
            )}
          </>
        )}
      </div>
    </section>
  );
};

export default SilaMaterialErpPullPanel;
