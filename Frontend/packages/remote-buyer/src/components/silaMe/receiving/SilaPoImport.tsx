import React, { useState } from "react";
import { PageHeader, toastService } from "@vosox/shared-ui";
import { pullPurchaseOrders, type SilaPullResult } from "../../../api/silaMe/silaMasterDataApi";
import SilaImportPanel from "./SilaImportPanel";
import SilaPullSummary from "./SilaPullSummary";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

interface SilaPoImportProps {
  /** MANAGE_SILA_MASTER_DATA: import purchase orders from Excel and pull them from the ERP. */
  canManage: boolean;
  /** Purchase orders were added or changed (e.g. to refresh the open purchase order list). */
  onChanged?: () => void;
}

/**
 * ERP purchase orders: synced from the ERP (GET_PO, one API per company code) or imported from Excel (one row per line).
 * Imports are all-or-nothing; received lines cannot be removed or reduced below the received quantity.
 */
const SilaPoImport: React.FC<SilaPoImportProps> = ({ canManage, onChanged }) => {
  const [pulling, setPulling] = useState(false);
  const [result, setResult] = useState<SilaPullResult | null>(null);

  const handlePull = async () => {
    setPulling(true);
    try {
      const pulled = await pullPurchaseOrders();
      setResult(pulled);
      toastService.success(`${pulled.created} new and ${pulled.updated} updated purchase orders read from the ERP.`);
      onChanged?.();
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "Could not read the purchase orders from the ERP.");
    } finally {
      setPulling(false);
    }
  };

  return (
    <div className="sila-me srcv-page">
      <PageHeader className="pud-page-header" title="Purchase order import" />
      {canManage ? (
        <>
          <div className="srcv-actions">
            <button type="button" className="sila-btn sila-btn--secondary" disabled={pulling} onClick={handlePull}>
              {pulling ? "Reading from ERP..." : "Pull POs from ERP"}
            </button>
          </div>
          {result && <SilaPullSummary result={result} noun="purchase orders" />}
          <SilaImportPanel kind="purchase-orders" noun="purchase order lines" canManage={canManage} onImported={() => onChanged?.()} />
        </>
      ) : (
        <div className="sila-alert sila-alert--success" role="status">You can view purchase orders under Open purchase orders; importing them needs the master data permission.</div>
      )}
    </div>
  );
};

export default SilaPoImport;
