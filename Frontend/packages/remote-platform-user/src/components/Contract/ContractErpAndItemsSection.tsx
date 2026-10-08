import React, { useState } from 'react';
import { Button, EmptyState, StatusBadge, toastService } from '@vosox/shared-ui';
import type { ContractRecord } from './contractApi';
import { formatContractAmount } from './contractApi';
import { retryContractErpSync } from './contractPurchaseOrderApi';

interface ContractErpAndItemsSectionProps {
  contract: ContractRecord;
  /** Read the contract again after a retry. */
  onRefresh: () => void;
}

const Field: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="ctrd-info-field">
    <dt className="ctrd-info-label">{label}</dt>
    <dd className="ctrd-info-value">{value || '—'}</dd>
  </div>
);

/** The contract's ERP id, how its hand-off to the ERP went, and the items that were awarded. */
const ContractErpAndItemsSection: React.FC<ContractErpAndItemsSectionProps> = ({ contract, onRefresh }) => {
  const [retrying, setRetrying] = useState(false);
  const items = contract.items ?? [];
  // Also while no contract API is configured: once one is added, Reprocess sends the contract to it.
  const canRetry = !contract.erpContractId && ['FAILED', 'UNKNOWN', 'NOT_CONFIGURED'].includes(contract.erpSyncStatus ?? 'NOT_CONFIGURED');

  const handleRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const result = await retryContractErpSync(contract.id);
      if (result.erpSyncStatus === 'SYNCED') toastService.success('Contract sent to the ERP.');
      else if (result.erpSyncStatus === 'NOT_CONFIGURED') toastService.warning('No contract API is configured yet. Add one under Integrations, then reprocess.');
      else toastService.warning('The ERP did not accept the contract. See the ERP sync status for the reason.');
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : 'Failed to send the contract to the ERP.');
    } finally {
      setRetrying(false);
      onRefresh();
    }
  };

  return (
    <>
      <section>
        <h3 className="ctrd-section-title">ERP</h3>
        <dl className="ctrd-info-grid">
          <Field label="ERP Contract ID" value={contract.erpContractId} />
          <Field
            label="ERP Sync"
            value={contract.erpSyncStatus ? <StatusBadge status={contract.erpSyncStatus} size="sm" /> : null}
          />
        </dl>
        {contract.erpSyncError && <p className="ctrd-po-hint">{contract.erpSyncError}</p>}
        {canRetry && (
          <div className="ctrd-po-actions">
            <Button variant="secondary" loading={retrying} onClick={handleRetry}>
              Reprocess
            </Button>
          </div>
        )}
      </section>

      <section>
        <h3 className="ctrd-section-title">
          Items
          {items.length > 0 && <span className="ctrd-section-count">{items.length}</span>}
        </h3>
        {items.length === 0 ? (
          <EmptyState title="No items for this contract." />
        ) : (
          <div className="sila-table-wrap">
            <table className="sila-table">
              <thead>
                <tr>
                  <th scope="col">Line</th>
                  <th scope="col">Material</th>
                  <th scope="col">Description</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Unit</th>
                  <th scope="col">Unit Price</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Cost Center</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.lineNumber}>
                    <td>{item.lineNumber}</td>
                    <td>{item.materialCode || '—'}</td>
                    <td>{item.description}</td>
                    <td>{item.quantity}</td>
                    <td>{item.unitOfMeasure || '—'}</td>
                    <td>{formatContractAmount(item.unitPrice)}</td>
                    <td>{formatContractAmount(item.lineAmount)}</td>
                    <td>{item.costCenter || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
};

export default ContractErpAndItemsSection;
