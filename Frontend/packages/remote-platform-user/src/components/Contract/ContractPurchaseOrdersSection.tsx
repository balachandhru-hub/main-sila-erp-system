import React, { useEffect, useState } from 'react';
import { Button, EmptyState, Loader, StatusBadge, toastService } from '@vosox/shared-ui';
import type { ContractRecord } from './contractApi';
import { formatContractAmount, formatContractDate } from './contractApi';
import { fetchContractPurchaseOrders, retryPurchaseOrderErpSync } from './contractPurchaseOrderApi';
import type { ContractPurchaseOrderDto } from './contractPurchaseOrderApi';

/** Create Purchase Order state of the contract detail; supplied only by the Buyer Admin contract page. */
export interface ContractDetailPurchaseOrderActions {
  /** True while the create request for this contract is running. */
  creating: boolean;
  onCreate: (record: ContractRecord) => void;
  /** Changes after a purchase order was created, so the list is read again. */
  refreshKey: number;
  /** Read the contract and its purchase orders again. */
  onRefresh: () => void;
}

interface ContractPurchaseOrdersSectionProps {
  contract: ContractRecord;
  actions: ContractDetailPurchaseOrderActions;
}

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="ctrd-info-field">
    <dt className="ctrd-info-label">{label}</dt>
    <dd className="ctrd-info-value">{value || '—'}</dd>
  </div>
);

/** The purchase orders of one contract: the figures, whether another one can be created, and the orders so far. */
const ContractPurchaseOrdersSection: React.FC<ContractPurchaseOrdersSectionProps> = ({ contract, actions }) => {
  const [orders, setOrders] = useState<ContractPurchaseOrderDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const summary = contract.purchaseOrderSummary;

  // Reprocess: sends a purchase order whose ERP call failed, or that was created before an API was configured, to the ERP.
  const handleReprocess = async (order: ContractPurchaseOrderDto) => {
    if (reprocessingId) return;
    setReprocessingId(order.id);
    try {
      const result = await retryPurchaseOrderErpSync(order.id);
      if (result.erpSyncStatus === 'SYNCED') toastService.success('Purchase order sent to the ERP.');
      else toastService.warning('The ERP did not accept the purchase order. See the ERP sync status for the reason.');
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : 'Failed to send the purchase order to the ERP.');
    } finally {
      setReprocessingId(null);
      actions.onRefresh();
    }
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchContractPurchaseOrders(contract.id)
      .then((data) => {
        if (!cancelled) setOrders(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setOrders([]);
          setError(err instanceof Error ? err.message : 'Failed to load the purchase orders of this contract.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contract.id, actions.refreshKey]);

  return (
    <section>
      <h3 className="ctrd-section-title">
        Purchase Orders
        {summary && summary.purchaseOrderCount > 0 && (
          <span className="ctrd-section-count">{summary.purchaseOrderCount}</span>
        )}
      </h3>

      <dl className="ctrd-info-grid">
        <Field label="Supplier" value={contract.supplierName} />
        <Field label="Contract Amount" value={formatContractAmount(contract.amount)} />
        <Field label="PO Count" value={summary ? String(summary.purchaseOrderCount) : null} />
        <Field label="PO Total" value={summary ? formatContractAmount(summary.purchaseOrderTotal) : null} />
        <Field label="Remaining Amount" value={summary ? formatContractAmount(summary.remainingAmount) : null} />
        <Field
          label="Latest PO"
          value={summary?.latestPurchaseOrder ? <span className="sila-ref">{summary.latestPurchaseOrder.poNumber}</span> : null}
        />
      </dl>

      <div className="ctrd-po-actions">
        <Button variant="primary" loading={actions.creating} onClick={() => actions.onCreate(contract)}>
          Create Purchase Order
        </Button>
        <span className="ctrd-po-hint">
          {summary?.canCreatePurchaseOrder === false && summary.createBlockedReason
            ? `Right now: ${summary.createBlockedReason}`
            : 'Creates a purchase order against this contract.'}
        </span>
      </div>

      {loading ? (
        <Loader size={24} message="Loading purchase orders..." />
      ) : error ? (
        <EmptyState variant="error" title="Couldn't load the purchase orders" description={error} />
      ) : orders.length === 0 ? (
        <EmptyState title="No Purchase Order created" />
      ) : (
        <div className="sila-table-wrap ctrd-po-table">
          <table className="sila-table">
            <thead>
              <tr>
                <th scope="col">PO Number</th>
                <th scope="col">ERP Purchase Order ID</th>
                <th scope="col">PO Status</th>
                <th scope="col">ERP Sync</th>
                <th scope="col">Total</th>
                <th scope="col">Order Date</th>
                <th scope="col"><span className="sila-visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="sila-cell-strong"><span className="sila-ref">{order.poNumber}</span></td>
                  <td>{order.erpPurchaseOrderId || '—'}</td>
                  <td><StatusBadge status={order.status} size="sm" /></td>
                  <td>
                    <StatusBadge status={order.erpSyncStatus} size="sm" />
                    {order.erpSyncError && <span className="ctrd-po-error">{order.erpSyncError}</span>}
                  </td>
                  <td>{formatContractAmount(order.totalAmount, order.currency ?? undefined)}</td>
                  <td>{formatContractDate(order.orderDate)}</td>
                  <td>
                    {!order.erpPurchaseOrderId && ['FAILED', 'UNKNOWN', 'NOT_CONFIGURED'].includes(order.erpSyncStatus) && (
                      <Button variant="secondary" loading={reprocessingId === order.id} onClick={() => handleReprocess(order)}>
                        Reprocess
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

export default ContractPurchaseOrdersSection;
