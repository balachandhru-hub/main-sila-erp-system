import React, { useEffect, useMemo, useRef, useState } from "react";
import "./ApprovalFlowDetail.css";
import { toastService } from "@vosox/shared-ui";
import ApprovalProcessDiagram, { type ApprovalStep } from "./ApprovalProcessDiagram";
import EditApprovalModal from "./EditApprovalModal";
import {
  fetchApprovalFlowUsers,
  updateApprovalFlow,
  type ApprovalFlowUser,
  type MasterApprovalFlow,
} from "./approvalManagementApi";

interface ApprovalFlowDetailProps {
  flow: MasterApprovalFlow;
  onBack: () => void;
  onFlowUpdated: (flow: MasterApprovalFlow) => void;
  /** View only: hides Edit and turns off approver reordering. */
  readOnly?: boolean;
}

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 15L7 10L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const EditIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);

const ApprovalFlowDetail: React.FC<ApprovalFlowDetailProps> = ({ flow: initialFlow, onBack, onFlowUpdated, readOnly = false }) => {
  const [flow, setFlow] = useState(initialFlow);
  const [approvers, setApprovers] = useState<ApprovalFlowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
 const [isEditing, setIsEditing] = useState(false);
  // Prevents the request from firing twice for the same approval (e.g. React StrictMode re-running effects).
  const fetchedIdRef = useRef<string | null>(null);

  const loadApprovers = () => {
    setLoading(true);
    setError(null);
    fetchApprovalFlowUsers(flow.id)
      .then(setApprovers)
      .catch((err: any) => setError(err.message || "Failed to load approvers."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (fetchedIdRef.current === flow.id) return;
    fetchedIdRef.current = flow.id;
    loadApprovers();
  }, [flow.id]);

  const getMappingId = (approver: ApprovalFlowUser) => approver.id || flow.id;

  const steps: ApprovalStep[] = useMemo(
    () =>
      approvers.map((approver) => ({
        id: `${approver.userId}-${approver.id ?? ""}`,
        title: approver.name || "Unknown user",
        description: approver.email || approver.userId,
      })),
    [approvers]
  );

  const handleReorder = async (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || savingOrder) return;
    const previous = approvers;
    const reordered = [...approvers];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    const renumbered = reordered.map((approver, i) => ({ ...approver, order: i + 1 }));
    setApprovers(renumbered);

    const changed = renumbered.filter((approver) => {
      const before = previous.find((p) => p === approver || (p.userId === approver.userId && p.id === approver.id));
      return before?.order !== approver.order;
    });
    if (changed.length === 0) return;

    setSavingOrder(true);
    try {
      await Promise.all(
        changed.map((approver) =>
          updateApprovalFlow(getMappingId(approver), {
            approvalCode: flow.approvalCode,
            approvalName: flow.approvalName,
            order: approver.order,
          })
        )
      );
      toastService.success("Approval order updated");
    } catch (err: any) {
      toastService.error(err.message || "Failed to update approval order");
      setApprovers(previous);
      loadApprovers();
    } finally {
      setSavingOrder(false);
    }
  };

  //const editingApprover = editingIndex !== null ? approvers[editingIndex] : null;

  return (
    <div className="afd-page">
      <div className="afd-header">
        <button type="button" className="afd-back sila-btn sila-btn--secondary sila-btn--icon" onClick={onBack} aria-label="Back to approval list">
          <IconBack />
        </button>
        <div className="afd-heading">
          <div className="afd-title-edit">
            <h1 className="afd-title">{flow.approvalName || "Approval Flow"}</h1>
            {!readOnly && (
              <button
                type="button"
                className="afd-edit-btn sila-btn sila-btn--ghost sila-btn--sm sila-btn--icon"
                title="Edit Approval Flow"
                aria-label="Edit Approval Flow"
                onClick={() => setIsEditing(true)}
              >
                <EditIcon />
              </button>
            )}
          </div>
          <div className="afd-meta">
            <span className="afd-code sila-ref">{flow.approvalCode || "—"}</span>
            {!loading && !error && (
              <span className="afd-count sila-badge sila-badge--neutral">
                {approvers.length} approver{approvers.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </div>
      </div>

      <ApprovalProcessDiagram
        steps={steps}
        loading={loading}
        error={error}
        onReorder={readOnly ? undefined : handleReorder}
        disabled={savingOrder}
      />

      {isEditing && (
        <EditApprovalModal
          mappingId={approvers[0]?.id || flow.id}
          approvalCode={flow.approvalCode}
          approvalName={flow.approvalName}
          order={approvers[0]?.order??flow.orderNumber?? flow.order?? 1}
          onClose={() => setIsEditing(false)}
          onSaved={(values) => {
            const updated = { ...flow, ...values };
            setFlow(updated);
            onFlowUpdated(updated);
            setIsEditing(false);
          }}
        />
      )}
    </div>
  );
};

export default ApprovalFlowDetail;
