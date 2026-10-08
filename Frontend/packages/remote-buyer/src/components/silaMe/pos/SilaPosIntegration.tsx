import React, { useCallback, useEffect, useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { pullPosSales, type SilaPosImportResult } from "../../../api/silaMe/silaPosApi";
import { getPosSources, type SilaPosSource } from "../../../api/silaMe/silaPosMasterApi";
import SilaPosBatches from "./SilaPosBatches";
import SilaPosImportSummary from "./SilaPosImportSummary";
import SilaPosItemMappings from "./SilaPosItemMappings";
import SilaPosOutletMappings from "./SilaPosOutletMappings";
import SilaPosSalesUpload from "./SilaPosSalesUpload";
import SilaPosSources from "./SilaPosSources";
import { errorText } from "./posFormat";
import "../silaMeTheme.css";
import "../recipes/SilaRecipes.css";
import "./SilaPos.css";

interface SilaPosIntegrationProps {
  /** Shows the write actions (sources, mappings, upload, process, pull). The backend checks MANAGE_SILA_POS. */
  canManage: boolean;
}

type PosTab = "sources" | "outlets" | "items" | "upload" | "batches";

const TABS: { key: PosTab; label: string }[] = [
  { key: "sources", label: "Sources" },
  { key: "outlets", label: "Outlet mapping" },
  { key: "items", label: "Item mapping" },
  { key: "upload", label: "Sales upload" },
  { key: "batches", label: "Upload history" },
];

/** POS integration: sources, outlet and item mappings, the two-step sales upload, and the received batches. */
const SilaPosIntegration: React.FC<SilaPosIntegrationProps> = ({ canManage }) => {
  const [tab, setTab] = useState<PosTab>("sources");
  const [sources, setSources] = useState<SilaPosSource[]>([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState<SilaPosImportResult | null>(null);
  const [batchesVersion, setBatchesVersion] = useState(0);

  const loadSources = useCallback(async () => {
    setSourcesLoading(true);
    setSourcesError(null);
    try {
      setSources(await getPosSources());
    } catch (err: unknown) {
      setSources([]);
      setSourcesError(errorText(err, "Could not load the POS sources."));
    } finally {
      setSourcesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handlePull = async () => {
    setPulling(true);
    try {
      const result = await pullPosSales();
      setPullResult(result);
      setBatchesVersion((current) => current + 1);
      toastService.success(`Batch ${result.batchNumber}: ${result.accepted} line${result.accepted === 1 ? "" : "s"} received.`);
    } catch (err: unknown) {
      toastService.error(errorText(err, "Could not pull the sales from the POS API."));
    } finally {
      setPulling(false);
    }
  };

  const sourceProps = { sources, sourcesLoading, sourcesError, onReloadSources: loadSources, canManage };

  return (
    <div className="sila-me srec-page">
      <PageHeader
        className="pud-page-header"
        title="POS integration"
        description="POS source, outlet and POS item mapping, and the sales upload: check the file first, then process the ready lines into inventory consumption."
        actions={
          canManage ? (
            <button type="button" className="sila-btn sila-btn--secondary" onClick={handlePull} disabled={pulling}>
              {pulling ? "Pulling..." : "Pull from POS API now"}
            </button>
          ) : undefined
        }
      />

      {pullResult && <SilaPosImportSummary result={pullResult} onClose={() => setPullResult(null)} />}

      <section className="sila-card">
        <div className="sila-tabs" role="tablist" aria-label="POS integration sections">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              id={`spos-tab-${item.key}`}
              aria-controls={`spos-panel-${item.key}`}
              className="sila-tab"
              aria-selected={tab === item.key}
              onClick={() => setTab(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id={`spos-panel-${tab}`} aria-labelledby={`spos-tab-${tab}`} className="spos-panel">
          {tab === "sources" && <SilaPosSources {...sourceProps} />}
          {tab === "outlets" && <SilaPosOutletMappings {...sourceProps} />}
          {tab === "items" && <SilaPosItemMappings {...sourceProps} />}
          {tab === "upload" && (
            <SilaPosSalesUpload
              sources={sources}
              canManage={canManage}
              onProcessed={() => setBatchesVersion((current) => current + 1)}
            />
          )}
          {tab === "batches" && <SilaPosBatches key={batchesVersion} canManage={canManage} />}
        </div>
      </section>
    </div>
  );
};

export default SilaPosIntegration;
