import React, { useCallback, useEffect, useMemo, useState } from "react";
import { EmptyState, KpiCard, Loader, PageHeader } from "@vosox/shared-ui";
import {
  getReceivingDashboard,
  type SilaReceivingDashboard,
  type SilaReceivingException,
  type SilaReceivingTask,
  type SilaReceivingWorkbenchRow,
} from "../../../api/silaMe/silaReceivingApi";
import { formatDate, formatDateTime } from "../../cart/lineFormat";
import { formatQty } from "../../../api/silaMe/silaInventoryApi";
import SilaGoodsReceiptDialog from "./SilaGoodsReceiptDialog";
import SilaPurchaseOrderDialog from "./SilaPurchaseOrderDialog";
import SilaReceiveGoodsDialog, { type ReceivePrefill } from "./SilaReceiveGoodsDialog";
import { receivingBadgeClass, receivingLabel } from "./receivingFormat";
import "../silaMeTheme.css";
import "./SilaReceiving.css";

type WorkbenchTab = "EXPECTED_TODAY" | "PENDING" | "PARTIAL" | "OVERDUE" | "RECEIVED" | "EXCEPTIONS";

interface SilaReceivingDashboardProps {
  canPost: boolean;
  canReprocess: boolean;
  supervisor: boolean;
}

const TABS: { id: WorkbenchTab; label: string }[] = [
  { id: "EXPECTED_TODAY", label: "Expected Today" },
  { id: "PENDING", label: "Pending" },
  { id: "PARTIAL", label: "Partial" },
  { id: "OVERDUE", label: "Overdue" },
  { id: "RECEIVED", label: "Received" },
  { id: "EXCEPTIONS", label: "Exceptions" },
];

const SilaReceivingDashboard: React.FC<SilaReceivingDashboardProps> = ({ canPost, canReprocess, supervisor }) => {
  const [locationId, setLocationId] = useState("");
  const [supplier, setSupplier] = useState("");
  const [query, setQuery] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [tab, setTab] = useState<WorkbenchTab>("PENDING");
  const [data, setData] = useState<SilaReceivingDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poId, setPoId] = useState<string | null>(null);
  const [grnId, setGrnId] = useState<string | null>(null);
  const [receive, setReceive] = useState<ReceivePrefill | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(supplier.trim()), 350);
    return () => window.clearTimeout(timer);
  }, [supplier]);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    getReceivingDashboard({ locationId: locationId || undefined, supplier: query || undefined })
      .then(setData)
      .catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Could not load the receiving dashboard."))
      .finally(() => setLoading(false));
  }, [locationId, query]);

  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    const workbench = (data?.workbench ?? []).filter((row) => !expectedDate || (row.expectedDate || "").slice(0, 10) === expectedDate);
    if (tab === "EXCEPTIONS") return [];
    if (tab === "EXPECTED_TODAY") return workbench.filter((row) => row.receiptStatus === "EXPECTED_TODAY");
    if (tab === "PARTIAL") return workbench.filter((row) => row.receiptStatus === "PARTIAL");
    if (tab === "OVERDUE") return workbench.filter((row) => row.receiptStatus === "OVERDUE");
    if (tab === "RECEIVED") return [];
    return workbench;
  }, [data, tab, expectedDate]);

  const openTask = (task: SilaReceivingTask | SilaReceivingException | SilaReceivingWorkbenchRow) => {
    if ("goodsReceiptId" in task && task.goodsReceiptId && (task.action === "REVIEW" || "exception" in task)) {
      setGrnId(task.goodsReceiptId);
      return;
    }
    const purchaseOrderId = "purchaseOrderId" in task ? task.purchaseOrderId : undefined;
    if (purchaseOrderId && canPost && (task.action === "RECEIVE" || task.action === "RECEIVE_BALANCE")) {
      setReceive({ purchaseOrderId });
      return;
    }
    if (purchaseOrderId) setPoId(purchaseOrderId);
  };

  const kpis = data?.kpis;
  const receiverKpis: { label: string; value: number; tab: WorkbenchTab; tone?: "primary" | "warning" | "danger" | "success" }[] = [
    { label: "Expected Today", value: kpis?.expectedToday ?? 0, tab: "EXPECTED_TODAY", tone: "primary" },
    { label: "Pending Receipt", value: kpis?.pendingReceipt ?? 0, tab: "PENDING" },
    { label: "Partially Received", value: kpis?.partiallyReceived ?? 0, tab: "PARTIAL", tone: "warning" },
    { label: "Received Today", value: kpis?.receivedToday ?? 0, tab: "RECEIVED", tone: "success" },
    { label: "Attention Required", value: kpis?.attentionRequired ?? 0, tab: "EXCEPTIONS", tone: (kpis?.attentionRequired ?? 0) > 0 ? "danger" : undefined },
  ];
  const supervisorKpis = [
    ...receiverKpis.slice(0, 4),
    { label: "Overdue Receipts", value: kpis?.overdue ?? 0, tab: "OVERDUE" as WorkbenchTab, tone: "warning" as const },
    { label: "GRN Posting Failed", value: kpis?.grnPostingFailed ?? 0, tab: "EXCEPTIONS" as WorkbenchTab, tone: "danger" as const },
    { label: "Reversals Today", value: kpis?.reversalsToday ?? 0, tab: "RECEIVED" as WorkbenchTab },
    receiverKpis[4],
  ];

  return (
    <div className="sila-me srcv-page">
      <PageHeader
        className="pud-page-header"
        title="Receiving Dashboard"
        description={supervisor
          ? "Expected receipts, exceptions and today's receiving activity across your locations."
          : "What you are expected to receive, what is pending, and what needs your action."}
        actions={canPost ? (
          <button type="button" className="sila-btn sila-btn--primary" onClick={() => setReceive({ purchaseOrderId: "" })}>Receive / Scan</button>
        ) : undefined}
      />

      <div className="srcv-filters">
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-dash-location">Location</label>
          <select id="srcv-dash-location" className="sila-input" value={locationId} onChange={(event) => setLocationId(event.target.value)}>
            <option value="">All my locations</option>
            {(data?.locations ?? []).map((location) => (
              <option key={location.id} value={location.id}>
                {location.locationName}{location.propertyName ? ` · ${location.propertyName}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="sila-field">
          <label className="sila-label" htmlFor="srcv-dash-supplier">Supplier / PO</label>
          <input id="srcv-dash-supplier" className="sila-input" value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="Filter by supplier or PO" />
        </div>
        {supervisor && (
          <>
            <div className="sila-field">
              <label className="sila-label" htmlFor="srcv-dash-status">Status</label>
              <select id="srcv-dash-status" className="sila-input" value={tab} onChange={(event) => setTab(event.target.value as WorkbenchTab)}>
                {TABS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </div>
            <div className="sila-field">
              <label className="sila-label" htmlFor="srcv-dash-date">Expected date</label>
              <input id="srcv-dash-date" className="sila-input" type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
            </div>
          </>
        )}
      </div>

      {loading && <Loader size={24} message="Loading receiving work…" />}
      {error && <p className="srcv-error" role="alert">{error}</p>}

      {!loading && data && (
        <>
          <div className="sila-kpi-grid">
            {(supervisor ? supervisorKpis : receiverKpis).map((card) => (
              <KpiCard
                key={card.label}
                label={card.label}
                value={card.value}
                tone={card.tone}
                onClick={() => setTab(card.tab)}
              />
            ))}
          </div>

          <section className="sila-card">
            <h2 className="sila-form-section-title">Attention Required</h2>
            {(data.exceptions ?? []).length === 0 ? (
              <EmptyState title="No items require your attention." description="You're all caught up." />
            ) : (
              <ul className="srcv-task-list">
                {data.exceptions.map((row, index) => (
                  <li key={`${row.document}-${index}`} className="srcv-task">
                    <span className={`srcv-priority srcv-priority--${row.severity.toLowerCase()}`}>{row.severity === "CRITICAL" ? "Critical" : "Action required"}</span>
                    <div>
                      <strong>{row.exception}</strong>
                      <span className="srcv-sub">{row.document}{row.supplierName ? ` · ${row.supplierName}` : ""}{row.locationName ? ` · ${row.locationName}` : ""} · {row.age}</span>
                      {row.message && <span className="srcv-sub">{row.message}</span>}
                    </div>
                    <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => openTask(row)}>{row.action === "REVIEW" ? "Review" : row.action === "RECEIVE_BALANCE" ? "Receive balance" : "Receive"}</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {supervisor && (
            <section className="sila-card">
              <h2 className="sila-form-section-title">Receiving Workbench</h2>
              <div className="sila-btn-group srcv-tabs">
                {TABS.map((item) => (
                  <button key={item.id} type="button" className={`sila-btn sila-btn--sm ${tab === item.id ? "sila-btn--primary" : "sila-btn--secondary"}`} onClick={() => setTab(item.id)}>
                    {item.label}
                  </button>
                ))}
              </div>
              {tab === "EXCEPTIONS" ? (
                (data.exceptions ?? []).length === 0
                  ? <EmptyState title="No exceptions." description="Failed postings and overdue receipts appear here." />
                  : (
                    <div className="sila-table-wrap">
                      <table className="sila-table">
                        <thead>
                          <tr>
                            <th>Severity</th><th>Exception</th><th>Document</th><th>Supplier</th><th>Location</th><th>Age</th><th>Status</th><th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.exceptions.map((row, index) => (
                            <tr key={`${row.document}-ex-${index}`}>
                              <td>{row.severity === "CRITICAL" ? "Critical" : "Action required"}</td>
                              <td>{row.exception}</td>
                              <td>{row.document}</td>
                              <td>{row.supplierName || "—"}</td>
                              <td>{row.locationName || "—"}</td>
                              <td>{row.age || "—"}</td>
                              <td>{row.status ? <span className={receivingBadgeClass(row.status)}>{receivingLabel(row.status)}</span> : "—"}</td>
                              <td><button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => openTask(row)}>Review</button></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
              ) : tab === "RECEIVED" ? (
                (data.activity ?? []).filter((item) => item.action.startsWith("Posted") || item.action.startsWith("Reversed")).length === 0
                  ? <EmptyState title="No receipts completed today." description="Goods receipts posted or reversed today appear here." />
                  : (
                    <ul className="srcv-activity">
                      {data.activity.filter((item) => item.action.startsWith("Posted") || item.action.startsWith("Reversed")).map((item) => (
                        <li key={`${item.document}-${item.occurredOn}`}>
                          <button type="button" className="srcv-activity-btn" onClick={() => item.goodsReceiptId ? setGrnId(item.goodsReceiptId) : undefined}>
                            <span>{formatDateTime(item.occurredOn)}</span>
                            <strong>{item.document}</strong>
                            <span>{item.action}</span>
                            {item.status && <span className={receivingBadgeClass(item.status)}>{receivingLabel(item.status)}</span>}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
              ) : rows.length === 0 ? (
                <EmptyState title={emptyTitle(tab)} description={emptyDetail(tab)} />
              ) : (
                <div className="sila-table-wrap">
                  <table className="sila-table">
                    <thead>
                      <tr>
                        <th>PO</th><th>Supplier</th><th>Expected</th><th>Property / Plant</th><th>Items</th><th>Open qty</th><th>Status</th><th>Latest GRN</th><th>ERP</th><th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.purchaseOrderId}>
                          <td><span className="sila-cell-strong">{row.poNumber}</span></td>
                          <td>{row.supplierName || "—"}</td>
                          <td>{row.expectedDate ? formatDate(row.expectedDate) : "—"}</td>
                          <td>{row.propertyName || row.plantCode || "—"}{row.storageLocation ? <span className="srcv-sub">{row.storageLocation}</span> : null}</td>
                          <td>{row.openLineCount} / {row.lineCount}</td>
                          <td>{formatQty(row.openQty)} of {formatQty(row.orderedQty)}</td>
                          <td><span className={receivingBadgeClass(row.receiptStatus)}>{receivingLabel(row.receiptStatus)}</span></td>
                          <td>{row.latestGrnNumber || "—"}</td>
                          <td>{row.erpStatus ? <span className={receivingBadgeClass(row.erpStatus)}>{receivingLabel(row.erpStatus)}</span> : "—"}</td>
                          <td className="srcv-actions">
                            <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setPoId(row.purchaseOrderId)}>View</button>
                            {canPost && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => setReceive({ purchaseOrderId: row.purchaseOrderId })}>{row.action === "RECEIVE_BALANCE" ? "Receive balance" : "Receive"}</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {!supervisor && (
            <>
              <section className="sila-card">
                <h2 className="sila-form-section-title">Pending receiving</h2>
                {(data.workbench ?? []).filter((row) => row.receiptStatus !== "PARTIAL").length === 0
                  ? <EmptyState title="No pending receipts." description="Open purchase orders with quantity still to receive appear here." />
                  : (
                    <ul className="srcv-task-list">
                      {data.workbench.filter((row) => row.receiptStatus !== "PARTIAL").slice(0, 12).map((row) => (
                        <li key={row.purchaseOrderId} className="srcv-task">
                          <div>
                            <strong>{row.poNumber}</strong>
                            <span className="srcv-sub">{row.supplierName || "—"} · {row.expectedDate ? formatDate(row.expectedDate) : "No expected date"} · {row.openLineCount} open items</span>
                          </div>
                          {canPost && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => setReceive({ purchaseOrderId: row.purchaseOrderId })}>Receive</button>}
                          <button type="button" className="sila-btn sila-btn--secondary sila-btn--sm" onClick={() => setPoId(row.purchaseOrderId)}>View PO</button>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
              <section className="sila-card">
                <h2 className="sila-form-section-title">Partial receipts</h2>
                {(data.workbench ?? []).filter((row) => row.receiptStatus === "PARTIAL").length === 0
                  ? <EmptyState title="No partial receipts." description="Orders with remaining quantity after a goods receipt appear here." />
                  : (
                    <ul className="srcv-task-list">
                      {data.workbench.filter((row) => row.receiptStatus === "PARTIAL").slice(0, 12).map((row) => (
                        <li key={`partial-${row.purchaseOrderId}`} className="srcv-task">
                          <div>
                            <strong>{row.poNumber}</strong>
                            <span className="srcv-sub">{row.supplierName || "—"}{row.latestGrnNumber ? ` · Last GRN ${row.latestGrnNumber}` : ""}</span>
                            <span className="srcv-sub">Ordered {formatQty(row.orderedQty)} · Received {formatQty(row.receivedQty)} · Open {formatQty(row.openQty)}</span>
                          </div>
                          {canPost && <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => setReceive({ purchaseOrderId: row.purchaseOrderId })}>Receive balance</button>}
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            </>
          )}

          <section className="sila-card">
            <h2 className="sila-form-section-title">My Tasks</h2>
            {(data.tasks ?? []).length === 0
              ? <EmptyState title="You're all caught up." description="No receiving tasks in your scope." />
              : (
                <ul className="srcv-task-list">
                  {data.tasks.map((task, index) => (
                    <li key={`${task.type}-${task.poNumber}-${index}`} className="srcv-task">
                      <span className={`srcv-priority srcv-priority--${task.priority.toLowerCase()}`}>{task.priority === "CRITICAL" ? "Critical" : "Action required"}</span>
                      <div>
                        <strong>{task.title}</strong>
                        <span className="srcv-sub">
                          {task.poNumber}{task.grnNumber ? ` · ${task.grnNumber}` : ""}{task.supplierName ? ` · ${task.supplierName}` : ""}
                          {task.openLineCount != null ? ` · ${task.openLineCount} items` : ""}
                          {task.expectedDate ? ` · ${formatDate(task.expectedDate)}` : ""}
                        </span>
                      </div>
                      <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" onClick={() => openTask(task)}>
                        {task.action === "REVIEW" ? "Review" : task.action === "RECEIVE_BALANCE" ? "Receive balance" : "Receive"}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
          </section>

          {supervisor && (
            <section className="sila-card">
              <h2 className="sila-form-section-title">Today's activity</h2>
              <div className="srcv-team">
                <span>Receipts {data.team.receiptsCompleted}</span>
                <span>GRNs posted {data.team.grnsPosted}</span>
                <span>Partials {data.team.partialReceipts}</span>
                <span>Reversals {data.team.reversals}</span>
                <span>Failures {data.team.failures}</span>
              </div>
              <p className="srcv-sub">Aging: under 1 day {data.aging.pendingUnderOneDay} · 1–2 days {data.aging.pendingOneToTwoDays} · 3+ days {data.aging.pendingThreePlusDays}</p>
            </section>
          )}

          <section className="sila-card">
            <h2 className="sila-form-section-title">Recent Activity</h2>
            {(data.activity ?? []).length === 0
              ? <EmptyState title="No recent receiving activity." description="Posted and reversed goods receipts appear here." />
              : (
                <ul className="srcv-activity">
                  {data.activity.map((item) => (
                    <li key={`${item.document}-${item.occurredOn}`}>
                      <button type="button" className="srcv-activity-btn" onClick={() => item.goodsReceiptId ? setGrnId(item.goodsReceiptId) : item.purchaseOrderId ? setPoId(item.purchaseOrderId) : undefined}>
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
        </>
      )}

      {poId && (
        <SilaPurchaseOrderDialog
          purchaseOrderId={poId}
          onClose={() => setPoId(null)}
          onReceive={canPost ? (id) => { setPoId(null); setReceive({ purchaseOrderId: id }); } : undefined}
        />
      )}
      {grnId && (
        <SilaGoodsReceiptDialog
          goodsReceiptId={grnId}
          onClose={() => setGrnId(null)}
          canReverse={canPost}
          canReprocess={canReprocess}
        />
      )}
      {receive && (
        <SilaReceiveGoodsDialog
          prefill={receive.purchaseOrderId ? receive : null}
          onClose={() => setReceive(null)}
          onPosted={(id) => { setReceive(null); setGrnId(id); load(); }}
        />
      )}
    </div>
  );
};

const emptyTitle = (tab: WorkbenchTab): string => {
  if (tab === "EXPECTED_TODAY") return "No receipts expected today.";
  if (tab === "PARTIAL") return "No partial receipts.";
  if (tab === "OVERDUE") return "No overdue receipts.";
  if (tab === "RECEIVED") return "No receipts completed in recent activity.";
  return "No pending receipts.";
};

const emptyDetail = (tab: WorkbenchTab): string => {
  if (tab === "EXPECTED_TODAY") return "Purchase orders with today's expected delivery date appear here.";
  if (tab === "PARTIAL") return "Orders with remaining quantity after a goods receipt appear here.";
  return "Open purchase orders in this filter appear here.";
};

export default SilaReceivingDashboard;
