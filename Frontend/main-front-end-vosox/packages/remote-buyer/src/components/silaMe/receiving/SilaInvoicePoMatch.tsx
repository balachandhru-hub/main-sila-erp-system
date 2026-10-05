import React, { useEffect, useState } from "react";
import { Loader, toastService } from "@vosox/shared-ui";
import {
  getPoCandidates,
  getPurchaseOrder,
  matchInvoiceLines,
  matchInvoicePurchaseOrder,
  type SilaInvoiceDetail,
  type SilaOpenPurchaseOrder,
  type SilaPurchaseOrderLine,
} from "../../../api/silaMe/silaReceivingApi";
import { formatAmount } from "./receivingFormat";
import { useDebounced } from "./usePagedList";

interface SilaInvoicePoMatchProps {
  invoice: SilaInvoiceDetail;
  disabled: boolean;
  onUpdated: (invoice: SilaInvoiceDetail) => void;
}

/** Open purchase orders of the invoice's supplier (link one: the lines are matched again), then invoice line to PO line. */
const SilaInvoicePoMatch: React.FC<SilaInvoicePoMatchProps> = ({ invoice, disabled, onUpdated }) => {
  const [search, setSearch] = useState("");
  const term = useDebounced(search);
  const [orders, setOrders] = useState<SilaOpenPurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [poLines, setPoLines] = useState<SilaPurchaseOrderLine[]>([]);
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getPoCandidates(invoice.id, term, { index: 0, limit: 20 })
      .then((rows) => active && setOrders(rows))
      .catch((err: unknown) => active && setError(err instanceof Error ? err.message : "Could not load the purchase orders."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [invoice.id, invoice.supplierId, invoice.silaSupplierId, term]);

  useEffect(() => {
    const initial: Record<string, string> = {};
    invoice.items.forEach((item) => {
      if (item.id) initial[item.id] = item.purchaseOrderItemId ?? "";
    });
    setMatches(initial);
    setPoLines([]);
    if (!invoice.purchaseOrderId) return undefined;
    let active = true;
    getPurchaseOrder(invoice.purchaseOrderId)
      .then((order) => active && setPoLines(order.lines))
      .catch((err: unknown) => toastService.error(err instanceof Error ? err.message : "Could not load the purchase order lines."));
    return () => {
      active = false;
    };
  }, [invoice]);

  const run = async (key: string, action: () => Promise<SilaInvoiceDetail>, success: string) => {
    setBusy(key);
    try {
      onUpdated(await action());
      toastService.success(success);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : "The action failed.");
    } finally {
      setBusy(null);
    }
  };

  const chosen = Object.values(matches).filter(Boolean);
  const duplicated = chosen.length !== new Set(chosen).size;
  const handleSaveLines = () => {
    if (duplicated) {
      toastService.error("Match each purchase order line to one invoice line only.");
      return;
    }
    const lines = Object.entries(matches).map(([invoiceItemId, purchaseOrderItemId]) => ({ invoiceItemId, purchaseOrderItemId: purchaseOrderItemId || null }));
    run("lines", () => matchInvoiceLines(invoice.id, lines), "Line matches saved.");
  };

  return (
    <section className="srcv-stack" aria-labelledby="srcv-match-po">
      <h3 id="srcv-match-po" className="sila-form-section-title">Purchase order</h3>
      <p>{invoice.poNumber ? `Linked to ${invoice.poNumber}` : "Not linked to a purchase order"}</p>
      <div className="sila-field">
        <label className="sila-label" htmlFor="srcv-match-po-search">Search purchase orders</label>
        <input id="srcv-match-po-search" className="sila-input" type="search" placeholder="PO number" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>
      {loading ? (
        <Loader size={20} message="Loading purchase orders..." />
      ) : error ? (
        <p className="srcv-error" role="alert">{error}</p>
      ) : orders.length === 0 ? (
        <p className="srcv-sub">No open purchase order of this supplier.</p>
      ) : (
        <div className="sila-table-wrap">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">Purchase order</th>
                <th scope="col">Order date</th>
                <th scope="col">Open lines</th>
                <th scope="col">Total</th>
                <th scope="col"><span className="sila-visually-hidden">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td>
                    <span className="sila-cell-strong">{order.poNumber}</span>
                    <span className="srcv-sub">{order.supplierName || "Supplier"}</span>
                  </td>
                  <td>{order.orderDate.slice(0, 10)}</td>
                  <td>{order.openLineCount} / {order.lineCount}</td>
                  <td>{formatAmount(order.totalAmount, order.currency)}</td>
                  <td>
                    {order.id === invoice.purchaseOrderId ? (
                      <span className="sila-badge sila-badge--success">Linked</span>
                    ) : (
                      <button
                        type="button"
                        className="sila-btn sila-btn--secondary sila-btn--sm"
                        aria-label={`Link purchase order ${order.poNumber}`}
                        disabled={disabled || busy !== null}
                        onClick={() => run(order.id, () => matchInvoicePurchaseOrder(invoice.id, order.id), `Linked to ${order.poNumber}; lines matched again.`)}
                      >
                        {busy === order.id ? "Linking..." : "Link"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {invoice.purchaseOrderId && invoice.items.length > 0 && (
        <div className="srcv-stack">
          <h3 className="sila-form-section-title">Line matching</h3>
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Invoice line</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Purchase order line</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items.filter((item) => item.id).map((item) => (
                  <tr key={item.id}>
                    <td>{item.description}</td>
                    <td>{item.quantity ?? "—"}</td>
                    <td>
                      <label className="sila-visually-hidden" htmlFor={`srcv-line-${item.id}`}>Purchase order line for {item.description}</label>
                      <select
                        id={`srcv-line-${item.id}`}
                        className="sila-select"
                        value={matches[item.id as string] ?? ""}
                        disabled={disabled || busy !== null}
                        onChange={(event) => setMatches((current) => ({ ...current, [item.id as string]: event.target.value }))}
                      >
                        <option value="">Not matched</option>
                        {poLines.map((line) => (
                          <option key={line.id} value={line.id}>{line.lineNumber} — {line.productName} ({line.openQty} {line.uom || ""} open)</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {duplicated && <p className="srcv-error" role="alert">A purchase order line is chosen twice.</p>}
          <div className="srcv-actions">
            <button type="button" className="sila-btn sila-btn--primary sila-btn--sm" disabled={disabled || busy !== null || duplicated} onClick={handleSaveLines}>
              {busy === "lines" ? "Saving..." : "Save line matches"}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default SilaInvoicePoMatch;
