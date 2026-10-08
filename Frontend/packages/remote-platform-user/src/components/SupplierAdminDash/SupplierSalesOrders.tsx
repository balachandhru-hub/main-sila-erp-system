import React, { useCallback } from "react";
import { Button, PageHeader, StatusBadge, Table } from "@vosox/shared-ui";
import type { TableColumn } from "@vosox/shared-ui";
import { getPurchaseOrders, type PurchaseOrderListItem } from "../../../../remote-buyer/src/api/purchaseOrderApi";
import type { SilaPage } from "../../../../remote-buyer/src/api/silaMe/silaReceivingApi";
import { formatDate, formatPrice } from "../../../../remote-buyer/src/components/cart/lineFormat";
import { usePagedList } from "../../../../remote-buyer/src/components/silaMe/receiving/usePagedList";
import "../../../../remote-buyer/src/components/purchasing/Purchasing.css";

const columns: TableColumn<PurchaseOrderListItem>[] = [
  {
    id: "poNumber",
    header: "PO number",
    className: "sila-cell-strong",
    cell: ({ row }) => <span className="sila-ref">{row.poNumber}</span>,
  },
  { id: "buyer", header: "Buyer", cell: ({ row }) => row.buyerName || "—" },
  { id: "source", header: "Contract / weekly bucket", cell: ({ row }) => row.contractNumber || row.bucketCode || "—" },
  { id: "orderDate", header: "Order date", cell: ({ row }) => formatDate(row.orderDate) },
  { id: "status", header: "Status", cell: ({ row }) => <StatusBadge status={row.status} size="sm" /> },
  { id: "items", header: "Items", accessorKey: "itemCount" },
  { id: "total", header: "Total", cell: ({ row }) => formatPrice(row.totalAmount, row.currency) },
  { id: "salesOrder", header: "Sales order number", cell: ({ row }) => row.supplierErpSalesOrderNumber || "—" },
  {
    id: "erpSync",
    header: "ERP sync",
    cell: ({ row }) => (
      <>
        {row.supplierErpSyncStatus ? <StatusBadge status={row.supplierErpSyncStatus} size="sm" /> : "—"}
        {row.supplierErpSyncError && <span className="pdash-po-error">{row.supplierErpSyncError}</span>}
      </>
    ),
  },
];

/** The purchase orders buyers placed with the signed-in supplier, newest first, paged. */
const SupplierSalesOrders: React.FC = () => {
  const load = useCallback((page: SilaPage) => getPurchaseOrders("supplier", page.limit, page.index), []);
  const list = usePagedList<PurchaseOrderListItem>(load, "Could not load sales orders.");

  return (
    <div className="pdash-page">
      <PageHeader title="Sales Orders" description="Purchase orders buyers placed with you, newest first." />
      <section className="sila-card">
        <Table<PurchaseOrderListItem>
          columns={columns}
          data={list.rows}
          getRowId={(order) => order.id}
          loading={list.loading}
          loadingLabel="Loading sales orders..."
          error={list.error ? "Couldn't load the sales orders" : undefined}
          errorDescription={list.error}
          errorAction={<Button type="button" variant="secondary" onClick={list.reload}>Try again</Button>}
          emptyState={{ title: "No sales orders yet" }}
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

export default SupplierSalesOrders;
