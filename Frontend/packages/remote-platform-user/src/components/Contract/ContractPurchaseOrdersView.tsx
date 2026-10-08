import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toastService } from '@vosox/shared-ui';
import type { ContractRecord } from './contractApi';
import { fetchContracts } from './contractApi';
import {
  createContractPurchaseOrder,
  fetchContractPurchaseOrderDraft,
  purchaseOrderCreatedToast,
} from './contractPurchaseOrderApi';
import type { ContractPurchaseOrderDraftDto, CreateContractPurchaseOrderRequest } from './contractPurchaseOrderApi';
import ContractTable from './ContractTable';
import ContractDetail from './ContractDetail';
import CreatePurchaseOrderDialog from './CreatePurchaseOrderDialog';

/** Rows per page of the contract list. ContractTable numbers its rows with the same size. */
const PAGE_SIZE = 10;

interface ContractPurchaseOrdersViewProps {
  /** Signed-in user's id, so an approver can still act on the contract from its detail. */
  currentUserId: string | null;
}

/** A purchase order waiting for the ERP details the buyer has to enter. */
interface PendingOrder {
  contract: ContractRecord;
  draft: ContractPurchaseOrderDraftDto;
}

/**
 * The Buyer Admin contract page (/contract): the contract list and detail with ERP ids, items, purchase order
 * figures and the Create Purchase Order action. The action is always available: it asks the backend what the order
 * needs, collects the ERP details only when the buyer has a purchase order API, and shows the backend's answer
 * (including why a contract cannot take an order) as a message.
 */
const ContractPurchaseOrdersView: React.FC<ContractPurchaseOrdersViewProps> = ({ currentUserId }) => {
  const [records, setRecords] = useState<ContractRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ContractRecord | null>(null);
  // The contract whose order is being prepared or created; drives the button's loading state.
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingOrder | null>(null);
  // Bumped after a create request or a retry, so the list and the open detail are read again.
  const [refreshKey, setRefreshKey] = useState(0);
  // State updates are asynchronous: the ref stops a second click before the first one has re-rendered.
  const busyRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchContracts((page - 1) * PAGE_SIZE, PAGE_SIZE)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load contracts.');
          setRecords([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [page, refreshKey]);

  const refresh = useCallback(() => setRefreshKey((key) => key + 1), []);

  // Creates the purchase order. A refusal (the contract cannot take an order, the ERP details are incomplete) is
  // shown as a message and the dialog, if open, stays so the details can be corrected.
  const createOrder = useCallback(async (record: ContractRecord, details?: CreateContractPurchaseOrderRequest) => {
    setCreatingId(record.id);
    try {
      const order = await createContractPurchaseOrder(record.id, details);
      const toast = purchaseOrderCreatedToast(order);
      if (toast.kind === 'warning') toastService.warning(toast.message);
      else toastService.success(toast.message);
      setPending(null);
    } catch (err: unknown) {
      toastService.error(err instanceof Error ? err.message : 'Failed to create the purchase order.');
    } finally {
      setCreatingId(null);
      // Read the figures again after a success and after a failure: another request may have changed them.
      refresh();
    }
  }, [refresh]);

  const handleCreate = useCallback(async (record: ContractRecord) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setCreatingId(record.id);
    try {
      const draft = await fetchContractPurchaseOrderDraft(record.id);
      if (draft.erpConfigured) {
        // The ERP needs details the contract does not hold: ask for them.
        setCreatingId(null);
        setPending({ contract: record, draft });
        return;
      }
      await createOrder(record);
    } catch (err: unknown) {
      setCreatingId(null);
      toastService.error(err instanceof Error ? err.message : 'Failed to create the purchase order.');
    } finally {
      busyRef.current = false;
    }
  }, [createOrder]);

  const handleSubmitDetails = useCallback(async (details: CreateContractPurchaseOrderRequest) => {
    if (busyRef.current || !pending) return;
    busyRef.current = true;
    try {
      await createOrder(pending.contract, details);
    } finally {
      busyRef.current = false;
    }
  }, [createOrder, pending]);

  return (
    <>
      {selected ? (
        <ContractDetail
          contract={selected}
          currentUserId={currentUserId}
          onBack={() => setSelected(null)}
          purchaseOrders={{
            creating: creatingId === selected.id,
            onCreate: handleCreate,
            refreshKey,
            onRefresh: refresh,
          }}
        />
      ) : (
        <ContractTable
          records={records}
          loading={loading}
          error={error}
          onRowClick={setSelected}
          page={page}
          onPreviousPage={() => setPage((p) => Math.max(1, p - 1))}
          onNextPage={() => setPage((p) => p + 1)}
          hasNextPage={records.length === PAGE_SIZE}
          purchaseOrders={{ creatingId, onCreate: handleCreate }}
        />
      )}
      {pending && (
        <CreatePurchaseOrderDialog
          contractNumber={pending.contract.contractNumber}
          draft={pending.draft}
          submitting={creatingId === pending.contract.id}
          onSubmit={handleSubmitDetails}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
};

export default ContractPurchaseOrdersView;
