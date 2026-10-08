import React, { useCallback, useState } from "react";
import { Button, PageHeader, StatusBadge, Table, toastService } from "@vosox/shared-ui";
import type { TableColumn } from "@vosox/shared-ui";
import {
  getPurchaseOrders,
  reprocessPurchaseOrder,
  retryPurchaseOrderErpSync,
  type PurchaseOrderListItem,
} from "../../api/purchaseOrderApi";
import type { SilaPage } from "../../api/silaMe/silaReceivingApi";
import { formatDate, formatPrice } from "../cart/lineFormat";
import { usePagedList } from "../silaMe/receiving/usePagedList";
import "./Purchasing.css";

interface PurchaseOrderListProps {
  /**
   * Adds the ERP hand-off of orders created from a contract (ERP Purchase Order ID, ERP sync, Retry ERP Sync), and shows
   * the contract an order came from next to the weekly bucket. Only the Buyer Admin page turns it on.
   */
  contractView?: boolean;
}

/** ERP hand-offs that can be sent again: the ERP refused the order, or the call broke off before an answer. */
const canRetryErpSync = (order: PurchaseOrderListItem) =>
  !!order.contractId && (order.erpSyncStatus === "FAILED" || order.erpSyncStatus === "UNKNOWN");

/** The organization's purchase orders (created in the ERP from weekly buckets and RFQs, or from contracts), newest first, paged. */
const PurchaseOrderList: React.FC<PurchaseOrderListProps> = ({ contractView = false }) => {
  const load = useCallback((page: SilaPage) => getPurchaseOrders("buyer", page.limit, page.index), []);
  const list = usePagedList<PurchaseOrderListItem>(load, "Could not load purchase orders.");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (order: PurchaseOrderListItem) => {
    if (retryingId) return;
    setRetryingId(order.id);
    try {
      const result = await retryPurchaseOrderErpSync(order.id);
      if (result.erpSyncStatus === "SYNCED") toastService.success("Purchase Order synchronized with ERP.");
      else toastService.warning("ERP synchronization did not complete. See the ERP sync status for the reason.");
    } catch (error: unknown) {
      toastService.error(error instanceof Error ? error.message : "Could not send the purchase order to the ERP again.");
    } finally {
      setRetryingId(null);
      // Read the order again after a success and after a failure: the status and the error changed.
      list.reload();
    }
  };

  const handleReprocess = async (order: PurchaseOrderListItem) => {
    if (retryingId) return;
    setRetryingId(order.id);
    try {
      await reprocessPurchaseOrder(order.id);
      toastService.success(`Purchase order ${order.poNumber} reprocessed.`);
    } catch (error: unknown) {
      toastService.error(error instanceof Error ? error.message : "Could not reprocess the purchase order.");
    } finally {
      setRetryingId(null);
      list.reload();
    }
  };

  const columns: TableColumn<PurchaseOrderListItem>[] = [
    {
      id: "poNumber",
      header: "PO number",
      className: "sila-cell-strong",
      cell: ({ row }) => <span className="sila-ref">{row.poNumber}</span>,
    },
    { id: "supplier", header: "Supplier", cell: ({ row }) => row.supplierName || "—" },
    {
      id: "source",
      header: contractView ? "Contract / weekly bucket" : "Weekly bucket",
      cell: ({ row }) => (contractView && row.contractNumber) || row.bucketCode || "—",
    },
    { id: "plant", header: "Plant", cell: ({ row }) => row.plantCode || "—" },
    { id: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.orderDate) },
    { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.status} size="sm" /> },
    { id: "items", header: "Items", accessorKey: "itemCount" },
    { id: "total", header: "Total", cell: ({ row }) => formatPrice(row.totalAmount, row.currency) },
    {
      id: "reprocess",
      header: "Reprocess",
      cell: ({ row }) => (
        <Button
          size="sm"
          variant="secondary"
          className="pdash-po-reprocess"
          loading={retryingId === row.id}
          disabled={!!row.erpPurchaseOrderId || retryingId !== null}
          onClick={() => handleReprocess(row)}
        >
          Reprocess
        </Button>
      ),
    },
  ];

  if (contractView) {
    columns.push(
      { id: "erpPurchaseOrderId", header: "ERP Purchase Order ID", cell: ({ row }) => row.erpPurchaseOrderId || "—" },
      {
        id: "erpSync",
        header: "ERP sync",
        cell: ({ row }) => (
          <>
            {row.erpSyncStatus ? <StatusBadge status={row.erpSyncStatus} size="sm" /> : "—"}
            {row.erpSyncError && <span className="pdash-po-error">{row.erpSyncError}</span>}
          </>
        ),
      },
      {
        id: "action",
        header: "Action",
        cell: ({ row }) =>
          canRetryErpSync(row) ? (
            <Button
              size="sm"
              variant="secondary"
              loading={retryingId === row.id}
              disabled={retryingId !== null}
              onClick={() => handleRetry(row)}
            >
              Retry ERP Sync
            </Button>
          ) : (
            "—"
          ),
      },
    );
  }

  return (
    <div className="pdash-page">
      <PageHeader
        title="Purchase Orders"
        description={contractView ? "Orders created from contracts, weekly buckets and your ERP, newest first." : "Orders created in your ERP, newest first."}
      />
      <section className="sila-card">
        <Table<PurchaseOrderListItem>
          columns={columns}
          data={list.rows}
          getRowId={(order) => order.id}
          loading={list.loading}
          loadingLabel="Loading purchase orders..."
          error={list.error ? "Couldn't load the purchase orders" : undefined}
          errorDescription={list.error}
          errorAction={<Button type="button" variant="secondary" onClick={list.reload}>Try again</Button>}
          emptyState={{ title: "No purchase orders yet" }}
          pagination={
            list.page > 1 || list.hasNext
              ? {
                  page: list.page,
                  hasNext: list.hasNext,
                  onPrevious: () => list.setPage(Math.max(1, list.page - 1)),
                  onNext: () => list.setPage(list.page + 1),
                  disabled: list.loading,
                }
              : undefined
          }
        />
      </section>
    </div>
  );
};

export default PurchaseOrderList;
