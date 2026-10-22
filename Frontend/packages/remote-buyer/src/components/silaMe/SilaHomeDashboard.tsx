import React, { useCallback, useEffect, useState } from "react";
import { EmptyState, KpiCard, Loader, PageHeader } from "@vosox/shared-ui";
import { formatQty, getInventoryHome, type SilaInventoryHome } from "../../api/silaMe/silaInventoryApi";
import { getPurchaseRecommendations, type SilaPurchaseRecommendationList } from "../../api/silaMe/silaInventoryControlApi";
import {
  getReceivingDashboard,
  type SilaHomeApproval,
  type SilaReceivingActivity,
  type SilaReceivingDashboard,
  type SilaReceivingException,
  type SilaReceivingTask,
} from "../../api/silaMe/silaReceivingApi";
import { formatDate, formatDateTime } from "../cart/lineFormat";
import {
  implementedHomePersonas,
  personaLabel,
  silaHomeSectionOrder,
  type SilaHomeCapabilities,
  type SilaHomePersona,
  type SilaHomeSection,
} from "./silaHomeCapabilities";
import { queueSilaCreditMemoSearch } from "./receiving/SilaCreditMemos";
import { receivingBadgeClass, receivingLabel } from "./receiving/receivingFormat";
import "./silaMeTheme.css";
import "./receiving/SilaReceiving.css";

interface SilaHomeDashboardProps {
  capabilities: SilaHomeCapabilities;
  /** Super Admin UI composition only. Does not change session, role, token, or tenant. */
  previewPersona?: SilaHomePersona;
  onPreviewPersona?: (persona: SilaHomePersona) => void;
  onNavigate: (key: string) => void;
  /** Preview is read-only: no receive / post / add-to-PO. */
  readOnly?: boolean;
}

const SilaHomeDashboard: React.FC<SilaHomeDashboardProps> = ({
  capabilities: caps,
  previewPersona = "self",
  onPreviewPersona,
  onNavigate,
  readOnly = false,
}) => {
  const [data, setData] = useState<SilaReceivingDashboard | null>(null);
  const [inventory, setInventory] = useState<SilaInventoryHome | null>(null);
  const [recommendations, setRecommendations] = useState<SilaPurchaseRecommendationList | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const receiving = caps.viewReceiving || caps.viewInvoices || caps.viewCreditMemos || caps.approvals
      ? getReceivingDashboard()
      : Promise.resolve(null);
    const stock = caps.viewInventory ? getInventoryHome().catch(() => null) : Promise.resolve(null);
    const recs = caps.recommendation ? getPurchaseRecommendations().catch(() => null) : Promise.resolve(null);
    Promise.all([receiving, stock, recs])
      .then(([dashboard, home, rec]) => {
        setData(dashboard);
        setInventory(home);
        setRecommendations(rec);
      })
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load Home."))
      .finally(() => setLoading(false));
  }, [caps.viewReceiving, caps.viewInvoices, caps.viewCreditMemos, caps.approvals, caps.viewInventory, caps.recommendation]);

  useEffect(() => { load(); }, [load]);

  const go = (key: string) => {
    if (readOnly && (key.includes("grn/new") || key.includes("scan") || key.includes("retry") || key === "silaRecommendations")) {
      if (key === "silaRecommendations") { onNavigate(key); return; }
      return;
    }
    onNavigate(key);
  };

  const openCreditMemos = (intent: { status?: string; creditMemoId?: string } = {}) => {
    queueSilaCreditMemoSearch(intent);
    go("silaCreditMemos");
  };

  const openTask = (task: SilaReceivingTask | SilaReceivingException | SilaHomeApproval | SilaReceivingActivity) => {
    const creditMemoId = "creditMemoId" in task ? task.creditMemoId : undefined;
    const creditMemoTask = ("type" in task && task.type === "CREDIT_MEMO") || Boolean(creditMemoId);
    if (readOnly) {
      if (creditMemoTask) { openCreditMemos({ creditMemoId: creditMemoId ?? undefined }); return; }
      if ("invoiceId" in task && task.invoiceId) { go("silaInvoices"); return; }
      if ("goodsReceiptId" in task && task.goodsReceiptId) { go("silaGoodsReceipts"); return; }
      if ("purchaseOrderId" in task && task.purchaseOrderId) { go("silaPurchaseOrders"); return; }
      if ("transferId" in task && task.transferId) { go("silaTransfers"); return; }
      return;
    }
    if ("action" in task && task.action === "PROCESS_INVOICE") { go("silaInvoices"); return; }
    if (creditMemoTask) { openCreditMemos({ creditMemoId: creditMemoId ?? undefined }); return; }
    if ("goodsReceiptId" in task && task.goodsReceiptId && (("action" in task && task.action === "REVIEW") || "exception" in task)) {
      go("silaGoodsReceipts");
      return;
    }
    if ("invoiceId" in task && task.invoiceId) { go("silaInvoices"); return; }
    if ("transferId" in task && task.transferId) { go("silaTransfers"); return; }
    if ("purchaseOrderId" in task && task.purchaseOrderId) { go("silaPurchaseOrders"); }
  };

  const kpis = data?.kpis;
  const previewing = previewPersona !== "self";
  const title = caps.recommendation && !caps.receiving && !caps.invoice
    ? "Purchasing Home"
    : caps.processInvoices && !caps.receiving
      ? "Accounts Payable Home"
      : caps.approveInvoices && !caps.processInvoices && !caps.receiving
        ? "Finance Home"
        : caps.supervisor
          ? "Receiving Supervisor Home"
          : caps.receiving
            ? "Receiving Home"
            : "Home";
  const sections = silaHomeSectionOrder(previewPersona);

  const renderSection = (section: SilaHomeSection): React.ReactNode => {
    if (section === "kpis") {
      return (
        <div className="sila-kpi-grid" key="kpis">
          {caps.receiving && <KpiCard label="Expected Today" value={kpis?.expectedToday ?? 0} tone="primary" onClick={() => go("silaReceivingDashboard")} />}
          {caps.receiving && <KpiCard label="Pending Receipt" value={kpis?.pendingReceipt ?? 0} onClick={() => go("silaReceivingDashboard")} />}
          {caps.receiving && <KpiCard label="Partially Received" value={kpis?.partiallyReceived ?? 0} tone="warning" onClick={() => go("silaReceivingDashboard")} />}
          {caps.receiving && <KpiCard label="Received Today" value={kpis?.receivedToday ?? 0} tone="success" onClick={() => go("silaGoodsReceipts")} />}
          {caps.receiving && caps.supervisor && <KpiCard label="Overdue" value={kpis?.overdue ?? 0} tone="warning" onClick={() => go("silaReceivingDashboard")} />}
          {caps.receiving && caps.supervisor && <KpiCard label="GRN Posting Failed" value={kpis?.grnPostingFailed ?? 0} tone="danger" onClick={() => go("silaReceivingDashboard")} />}
          {caps.recommendation && <KpiCard label="Stock-out" value={recommendations?.stockOut ?? 0} tone={(recommendations?.stockOut ?? 0) > 0 ? "danger" : undefined} onClick={() => go("silaRecommendations")} />}
          {caps.recommendation && <KpiCard label="Below minimum" value={recommendations?.belowMinimum ?? 0} tone="warning" onClick={() => go("silaRecommendations")} />}
          {caps.recommendation && <KpiCard label="Recommended purchase" value={recommendations?.recommendedPurchase ?? 0} onClick={() => go("silaRecommendations")} />}
          {caps.invoice && <KpiCard label="Invoices ready" value={data?.invoice.readyForProcessing ?? 0} onClick={() => go("silaInvoices")} />}
          {caps.invoice && <KpiCard label="Invoice failed" value={data?.invoice.postingFailed ?? 0} tone="danger" onClick={() => go("silaInvoices")} />}
          {(caps.receiving || caps.invoice || caps.creditMemo) && (
            <KpiCard label="Attention Required" value={kpis?.attentionRequired ?? 0} tone={(kpis?.attentionRequired ?? 0) > 0 ? "danger" : undefined} onClick={() => go("silaReceivingDashboard")} />
          )}
        </div>
      );
    }

    if (section === "tasks") {
      const tasks = (data?.tasks ?? []).filter((task) => showTask(task, caps));
      return (
        <section className="sila-card" key="tasks">
          <h2 className="sila-form-section-title">My Tasks</h2>
          {tasks.length === 0
            ? <EmptyState title="You're all caught up." description="No tasks in your scope." />
            : (
              <ul className="srcv-task-list">
                {tasks.map((task, index) => (
                  <li key={`${task.type}-${index}`} className="srcv-task">
                    <span className={`srcv-priority srcv-priority--${task.priority.toLowerCase()}`}>{task.priority === "CRITICAL" ? "Critical" : "Action required"}</span>
                    <div>
                      <strong>{task.title}</strong>
                      <span className="srcv-sub">
                        {task.grnNumber || task.poNumber}
                        {task.supplierName ? ` · ${task.supplierName}` : ""}
                        {task.expectedDate ? ` · ${formatDate(task.expectedDate)}` : task.age ? ` · ${task.age}` : ""}
                      </span>
                    </div>
                    <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => openTask(task)}>
                      {taskLabel(task.action, readOnly)}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      );
    }

    if (section === "approvals") {
      if (!caps.approvals && !caps.invoice && !caps.creditMemo) return null;
      const rows = (data?.approvals ?? []).filter((row) => showApproval(row, caps));
      return (
        <section className="sila-card" key="approvals">
          <h2 className="sila-form-section-title">Pending Approvals</h2>
          {rows.length === 0
            ? <EmptyState title="No pending approvals." description="Approvals assigned to you in modules you can access appear here. PO approval and GRN reversal approval are not in the current engine." />
            : (
              <ul className="srcv-task-list">
                {rows.map((row, index) => (
                  <li key={`${row.document}-${index}`} className="srcv-task">
                    <div>
                      <strong>{row.type}</strong>
                      <span className="srcv-sub">{row.document}{row.supplierName ? ` · ${row.supplierName}` : ""}{row.amount != null ? ` · ${row.amount}` : ""} · {row.age}</span>
                    </div>
                    <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => openTask(row)}>Review</button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      );
    }

    if (section === "attention") {
      const rows = (data?.exceptions ?? []).filter((row) => showException(row, caps));
      return (
        <section className="sila-card" key="attention">
          <h2 className="sila-form-section-title">Attention Required</h2>
          {rows.length === 0
            ? <EmptyState title="No items require your attention." description="You're all caught up." />
            : (
              <ul className="srcv-task-list">
                {rows.map((row, index) => (
                  <li key={`${row.document}-${index}`} className="srcv-task">
                    <span className={`srcv-priority srcv-priority--${row.severity.toLowerCase()}`}>{row.severity === "CRITICAL" ? "Critical" : "Action required"}</span>
                    <div>
                      <strong>{row.exception}</strong>
                      <span className="srcv-sub">{row.document}{row.supplierName ? ` · ${row.supplierName}` : ""} · {row.age}</span>
                    </div>
                    <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => openTask(row)}>Review</button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      );
    }

    if (section === "receiving" && caps.receiving) {
      return (
        <React.Fragment key="receiving">
          {!caps.supervisor && (
            <>
              <section className="sila-card">
                <h2 className="sila-form-section-title">Pending receiving</h2>
                {(data?.workbench ?? []).filter((row) => row.receiptStatus !== "PARTIAL").length === 0
                  ? <EmptyState title="No pending receipts." description="Open purchase orders with quantity still to receive appear here." />
                  : (
                    <ul className="srcv-task-list">
                      {data!.workbench.filter((row) => row.receiptStatus !== "PARTIAL").slice(0, 8).map((row) => (
                        <li key={row.purchaseOrderId} className="srcv-task">
                          <div>
                            <strong>{row.poNumber}</strong>
                            <span className="srcv-sub">{row.supplierName || "—"} · {row.openLineCount} open items</span>
                          </div>
                          {!readOnly && caps.receive && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => go("silaPurchaseOrders")}>Receive</button>}
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
              <section className="sila-card">
                <h2 className="sila-form-section-title">Partial receipts</h2>
                {(data?.workbench ?? []).filter((row) => row.receiptStatus === "PARTIAL").length === 0
                  ? <EmptyState title="No partial receipts." description="Orders with remaining quantity after a goods receipt appear here." />
                  : (
                    <ul className="srcv-task-list">
                      {data!.workbench.filter((row) => row.receiptStatus === "PARTIAL").slice(0, 8).map((row) => (
                        <li key={`p-${row.purchaseOrderId}`} className="srcv-task">
                          <div>
                            <strong>{row.poNumber}</strong>
                            <span className="srcv-sub">Received {formatQty(row.receivedQty)} · Open {formatQty(row.openQty)}</span>
                          </div>
                          {!readOnly && caps.receive && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => go("silaPurchaseOrders")}>Receive balance</button>}
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            </>
          )}
          {caps.supervisor && (
            <section className="sila-card">
              <h2 className="sila-form-section-title">Receiving workbench</h2>
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => go("silaReceivingDashboard")}>Open receiving dashboard</button>
              {(data?.workbench ?? []).length === 0
                ? <EmptyState title="No pending receipts." description="Open purchase orders in your scope appear on the receiving dashboard." />
                : (
                  <div className="sila-table-wrap">
                    <table className="sila-table">
                      <thead>
                        <tr><th>PO</th><th>Supplier</th><th>Expected</th><th>Status</th><th>Open qty</th></tr>
                      </thead>
                      <tbody>
                        {data!.workbench.slice(0, 12).map((row) => (
                          <tr key={row.purchaseOrderId}>
                            <td>{row.poNumber}</td>
                            <td>{row.supplierName || "—"}</td>
                            <td>{row.expectedDate ? formatDate(row.expectedDate) : "—"}</td>
                            <td><span className={receivingBadgeClass(row.receiptStatus)}>{receivingLabel(row.receiptStatus)}</span></td>
                            <td>{formatQty(row.openQty)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          )}
        </React.Fragment>
      );
    }

    if (section === "invoices" && caps.invoice) {
      return (
        <section className="sila-card" key="invoices">
          <h2 className="sila-form-section-title">Invoices</h2>
          <div className="sila-kpi-grid">
            <KpiCard label="Ready for processing" value={data?.invoice.readyForProcessing ?? 0} onClick={() => go("silaInvoices")} />
            <KpiCard label="In progress" value={data?.invoice.inProgress ?? 0} onClick={() => go("silaInvoices")} />
            <KpiCard label="Pending approval" value={data?.invoice.pendingApproval ?? 0} onClick={() => go("silaInvoices")} />
            <KpiCard label="Posting failed" value={data?.invoice.postingFailed ?? 0} tone="danger" onClick={() => go("silaInvoices")} />
            <KpiCard label="Recently posted" value={data?.invoice.postedRecently ?? 0} tone="success" onClick={() => go("silaInvoices")} />
          </div>
          <div className="srcv-actions">
            {!readOnly && caps.processInvoices && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => go("silaInvoices")}>Process invoice</button>}
            {!readOnly && caps.processInvoices && <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => go("silaInvoices")}>Scan / upload</button>}
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => go("silaInvoices")}>Invoice history</button>
          </div>
        </section>
      );
    }

    if (section === "creditMemos" && caps.creditMemo) {
      return (
        <section className="sila-card" key="creditMemos">
          <h2 className="sila-form-section-title">Credit memos</h2>
          <div className="sila-kpi-grid">
            <KpiCard label="In progress" value={data?.creditMemo.inProgress ?? 0} onClick={() => openCreditMemos({ status: "IN_PROGRESS" })} />
            <KpiCard label="Pending approval" value={data?.creditMemo.pendingApproval ?? 0} onClick={() => openCreditMemos({ status: "PENDING_APPROVAL" })} />
            <KpiCard label="Failed / unknown" value={data?.creditMemo.postingFailed ?? 0} tone="danger" onClick={() => openCreditMemos({ status: "FAILED" })} />
            <KpiCard label="Recently posted" value={data?.creditMemo.postedRecently ?? 0} tone="success" onClick={() => openCreditMemos({ status: "POSTED" })} />
          </div>
          <div className="srcv-actions">
            {!readOnly && caps.processCreditMemos && <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => go("silaInvoices")}>Posted invoice → credit memo</button>}
            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => openCreditMemos()}>Credit memos</button>
          </div>
        </section>
      );
    }

    if (section === "recommendations" && caps.recommendation) {
      return (
        <section className="sila-card" key="recommendations">
          <h2 className="sila-form-section-title">Recommendations</h2>
          <div className="sila-kpi-grid">
            <KpiCard label="Stock-out" value={recommendations?.stockOut ?? 0} tone={(recommendations?.stockOut ?? 0) > 0 ? "danger" : undefined} />
            <KpiCard label="Below minimum" value={recommendations?.belowMinimum ?? 0} tone="warning" />
            <KpiCard label="Recommended purchase" value={recommendations?.recommendedPurchase ?? 0} />
            <KpiCard label="Estimated value" value={recommendations?.estimatedValue == null ? "—" : `${recommendations.estimatedCurrency ?? ""} ${recommendations.estimatedValue}`.trim()} />
          </div>
          {(recommendations?.items ?? []).length === 0
            ? <EmptyState title="No purchase recommendations." description="No material in your scope needs purchasing after current stock and open PO quantity." />
            : (
              <ul className="srcv-task-list">
                {recommendations!.items.slice(0, 8).map((row) => (
                  <li key={`${row.locationId}-${row.materialId}`} className="srcv-task">
                    <div>
                      <strong>{row.materialCode}</strong>
                      <span className="srcv-sub">{row.locationName} · {row.reason} · {formatQty(row.recommendedQty)} {row.purchaseUom}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          <div className="srcv-actions">
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => go("silaRecommendations")}>Review recommendations</button>
          </div>
        </section>
      );
    }

    if (section === "inventory" && caps.inventory) {
      return (
        <section className="sila-card" key="inventory">
          <h2 className="sila-form-section-title">Inventory</h2>
          <div className="sila-kpi-grid">
            <KpiCard label="Low / reorder" value={inventory?.lowStockItems ?? 0} tone="warning" onClick={() => go("silaAlerts")} />
            <KpiCard label="Stock-out" value={recommendations?.stockOut ?? 0} tone={(recommendations?.stockOut ?? 0) > 0 ? "danger" : undefined} onClick={() => caps.recommendation ? go("silaRecommendations") : go("silaAlerts")} />
            <KpiCard label="Open alerts" value={inventory?.openAlerts ?? 0} onClick={() => go("silaAlerts")} />
          </div>
        </section>
      );
    }

    if (section === "quick") {
      const hasQuick = caps.receive || caps.receiving || caps.processInvoices || caps.processCreditMemos || caps.inventory || caps.recommendation || caps.admin;
      if (!hasQuick) return null;
      return (
        <section className="sila-card" key="quick">
          <h2 className="sila-form-section-title">Quick actions</h2>
          <div className="srcv-actions">
            {!readOnly && caps.receive && <button type="button" className="sila-btn sila-btn--primary" onClick={() => go("silaPurchaseOrders")}>Receive</button>}
            {caps.receiving && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaPurchaseOrders")}>Find PO</button>}
            {caps.receiving && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaGoodsReceipts")}>GRN history</button>}
            {!readOnly && caps.processInvoices && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaInvoices")}>Scan / upload invoice</button>}
            {!readOnly && caps.processCreditMemos && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaCreditMemos")}>New credit memo</button>}
            {caps.recommendation && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaRecommendations")}>Review recommendations</button>}
            {caps.inventory && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaLiveInventory")}>Live stock</button>}
            {caps.admin && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaApprovalFlows")}>Approval setup</button>}
            {caps.erp && <button type="button" className="sila-btn sila-btn--secondary" onClick={() => go("silaMeTracker")}>Integration / ERP</button>}
          </div>
        </section>
      );
    }

    if (section === "activity") {
      const activity = (data?.activity ?? []).filter((item) => showActivity(item, caps));
      return (
        <section className="sila-card" key="activity">
          <h2 className="sila-form-section-title">Recent Activity</h2>
          {activity.length === 0
            ? <EmptyState title="No recent activity." description="Posted goods receipts, invoices and credit memos appear here." />
            : (
              <ul className="srcv-activity">
                {activity.map((item) => (
                  <li key={`${item.document}-${item.occurredOn}`}>
                    <button type="button" className="srcv-activity-btn" onClick={() => openTask(item)}>
                      <span>{formatDateTime(item.occurredOn)}</span>
                      <strong>{item.document}</strong>
                      <span>{item.action}</span>
                      {item.status && <span className={receivingBadgeClass(item.status)}>{receivingLabel(item.status)}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
        </section>
      );
    }

    return null;
  };

  return (
    <div className="sila-me srcv-page">
      {onPreviewPersona && (
        <section className="sila-card">
          <h2 className="sila-form-section-title">Role dashboard preview</h2>
          <p className="srcv-sub">Layout only. Your sign-in, permissions, tenant and token stay unchanged. Preview is read-only for transaction actions.</p>
          <div className="srcv-filters">
            {implementedHomePersonas.map((persona) => (
              <button
                key={persona.id}
                type="button"
                className={`sila-btn sila-btn--sm ${previewPersona === persona.id ? "sila-btn--primary" : "sila-btn--secondary"}`}
                onClick={() => onPreviewPersona(persona.id)}
              >
                {persona.label}
              </button>
            ))}
            {previewing && (
              <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => onPreviewPersona("self")}>Exit preview</button>
            )}
          </div>
        </section>
      )}

      {previewing && (
        <p className="srcv-error" role="status">
          PREVIEW MODE — {personaLabel(previewPersona)}. Exit preview to return to your Home.
        </p>
      )}

      <PageHeader
        className="pud-page-header"
        title={title}
        description="Tasks, approvals and exceptions for the applications and permissions you have."
      />

      {loading && <Loader size={24} message="Loading Home…" />}
      {error && <p className="srcv-error" role="alert">{error}</p>}

      {!loading && sections.map((section) => renderSection(section))}
    </div>
  );
};

const taskLabel = (action: string, readOnly: boolean): string => {
  if (readOnly) return "View";
  if (action === "PROCESS_INVOICE") return "Process invoice";
  if (action === "REVIEW") return "Review";
  if (action === "RECEIVE_BALANCE") return "Receive balance";
  return "Receive";
};

const showTask = (task: SilaReceivingTask, caps: SilaHomeCapabilities): boolean => {
  if (task.type === "PROCESS_INVOICE") return caps.processInvoices;
  if (task.type === "APPROVE_INVOICE") return caps.approveInvoices;
  if (task.type === "INVOICE") return caps.invoice;
  if (task.type === "CREDIT_MEMO") return caps.processCreditMemos || caps.viewCreditMemos;
  if (task.action === "REVIEW" && !caps.receiving) return false;
  return caps.receiving;
};

const showException = (row: SilaReceivingException, caps: SilaHomeCapabilities): boolean => {
  if (row.exception.toLowerCase().includes("invoice")) return caps.invoice;
  if (row.exception.toLowerCase().includes("credit memo")) return caps.creditMemo;
  return caps.receiving;
};

const showApproval = (row: SilaHomeApproval, caps: SilaHomeCapabilities): boolean => {
  if (row.type === "Invoice Approval") return caps.approveInvoices;
  if (row.type === "Credit Memo Approval") return caps.approveCreditMemos;
  if (row.type === "Transfer Approval") return caps.approveTransfer || caps.inventory;
  return caps.approvals;
};

const showActivity = (item: SilaReceivingActivity, caps: SilaHomeCapabilities): boolean => {
  if (item.creditMemoId) return caps.creditMemo;
  if (item.invoiceId) return caps.invoice;
  return caps.receiving;
};

export default SilaHomeDashboard;
