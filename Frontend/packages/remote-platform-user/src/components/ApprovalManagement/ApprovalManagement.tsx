import React, { useCallback, useEffect, useState } from "react";
import "./ApprovalManagement.css";
import { FaChevronRight, FaPlus, FaSearch } from "react-icons/fa";
import { Table, type TableColumn } from "@vosox/shared-ui";
import { useNetworkAdminAuthStore } from "../../store/useAuthStore";
import { getTokenClaims } from "../../api/platformApi";
import { fetchMasterApprovalFlows, type MasterApprovalFlow } from "./approvalManagementApi";
import CreateApprovalForm from "./CreateApprovalForm";
import ApprovalFlowDetail from "./ApprovalFlowDetail";

const PAGE_SIZE = 10;

const getOrderNumber = (flow: MasterApprovalFlow) => flow.orderNumber ?? flow.order;

const sortByOrderNumber = (flows: MasterApprovalFlow[]) =>
  flows
    .map((flow, apiIndex) => ({ flow, apiIndex }))
    .sort((a, b) => {
      const orderA = getOrderNumber(a.flow) ?? Number.MAX_SAFE_INTEGER;
      const orderB = getOrderNumber(b.flow) ?? Number.MAX_SAFE_INTEGER;
      return orderA - orderB || a.apiIndex - b.apiIndex;
    })
    .map(({ flow }) => flow);

interface ApprovalManagementProps {
  /** false = view only: no Create Approval, and an opened flow cannot be edited or reordered. */
  canCreate?: boolean;
}

const ApprovalManagement: React.FC<ApprovalManagementProps> = ({ canCreate = true }) => {
  const currentUser = useNetworkAdminAuthStore((state) => state.currentUser);
  const [buyerId, setBuyerId] = useState<string | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(currentUser?.organizationId || null);
  const [claimsError, setClaimsError] = useState<string | null>(null);

  const [flows, setFlows] = useState<MasterApprovalFlow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<MasterApprovalFlow | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);


  useEffect(() => {
    getTokenClaims()
      .then((claims) => {
        if (!claims?.buyerId) {
          setClaimsError("Buyer information is not available. Please log in again.");
          return;
        }
        setBuyerId(claims.buyerId);
        if (claims.organizationId) setOrganizationId(claims.organizationId);
      })
      .catch((err: any) => {
        setClaimsError(err?.response?.data?.message || err?.message || "Failed to load token claims.");
      });
  }, []);

  const loadPage = useCallback(async () => {
    if (!buyerId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMasterApprovalFlows({
        buyerId,
        index: (page - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });
      // The API has no total count, so an exactly-full previous page can lead to an empty one; step back.
      if (data.length === 0 && page > 1) {
        setPage(page - 1);
        return;
      }
      setFlows(sortByOrderNumber(data));
    } catch (err: any) {
      setError(err.message || "Failed to load approval flows.");
      setFlows([]);
    } finally {
      setLoading(false);
    }
  }, [buyerId, page]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  const handleCreated = () => {
    setShowCreate(false);
    if (page === 1) loadPage();
    else setPage(1);
  };

  if (selectedFlow) {
    return (
      <ApprovalFlowDetail
        flow={selectedFlow}
        readOnly={!canCreate}
        onBack={() => setSelectedFlow(null)}
        onFlowUpdated={(updated) => setFlows((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))}
      />
    );
  }

  const query = search.trim().toLowerCase();
  const visibleFlows = query
    ? flows.filter(
        (flow) =>
          (flow.approvalCode || "").toLowerCase().includes(query) ||
          (flow.approvalName || "").toLowerCase().includes(query) ||
          (flow.type || "").toLowerCase().includes(query)
      )
    : flows;

  const openFlow = (flow: MasterApprovalFlow) => {
    if (flow.id) setSelectedFlow(flow);
  };

  const columns: TableColumn<MasterApprovalFlow>[] = [
    {
      id: "sno",
      header: "S.No",
      headerClassName: "apl-col-sno",
      align: "right",
      className: "apl-sno",
      cell: ({ row }) => (page - 1) * PAGE_SIZE + flows.indexOf(row) + 1,
    },
    {
      id: "approvalCode",
      header: "Approval Code",
      cell: ({ row }) => <span className="apl-code sila-ref">{row.approvalCode || "—"}</span>,
    },
    {
      id: "approvalName",
      header: "Approval Name",
      className: "apl-name",
      cell: ({ row }) => row.approvalName || "—",
    },
    {
      id: "type",
      header: "Type",
      cell: ({ row }) => row.type || "—",
    },
    {
      id: "scope",
      header: "Applies to",
      cell: ({ row }) =>
        !row.scopeKind || row.scopeKind === "ALL"
          ? "All"
          : `${row.scopeKind.replace("_", " ").toLowerCase()}: ${row.scopeName || row.scopeCode || "—"}`,
    },
    {
      id: "open",
      header: <span className="sila-visually-hidden">Open</span>,
      headerClassName: "apl-col-open",
      className: "apl-open",
      cell: () => <FaChevronRight aria-hidden="true" />,
    },
  ];

  return (
    <div className="apl-card">
      <div className="apl-header">
        <div>
          <h1 className="apl-title">Approval Management</h1>
          <p className="apl-subtitle">
            Master approval flows configured for your organization. Click a row to view its approvers.
          </p>
        </div>
        {canCreate && (
          <button type="button" className="apl-create-btn sila-btn sila-btn--primary" onClick={() => setShowCreate(true)}>
            <FaPlus aria-hidden="true" /> Create Approval
          </button>
        )}
      </div>

      <Table<MasterApprovalFlow>
        columns={columns}
        data={visibleFlows}
        getRowId={(flow, idx) => flow.id || String(idx)}
        loading={!claimsError && (loading || !buyerId)}
        loadingLabel="Loading approval flows…"
        error={claimsError || error || undefined}
        emptyState={{ title: flows.length === 0 ? "No approval flows found." : "No approval flows match your search." }}
        onRowClick={openFlow}
        rowClassName="apl-row"
        className="apl-table"
        pagination={
          flows.length > 0
            ? {
                page,
                hasNext: flows.length === PAGE_SIZE,
                onPrevious: () => setPage((p) => Math.max(1, p - 1)),
                onNext: () => setPage((p) => p + 1),
                disabled: loading,
                summary: `Page ${page}`,
              }
            : undefined
        }
        headerComponent={
          <>
            <div className="apl-search sila-search" role="search">
              <FaSearch className="sila-search-icon" aria-hidden="true" />
              <input
                type="search"
                className="sila-input"
                placeholder="Search by code or name"
                aria-label="Search approval flows"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {!claimsError && !loading && buyerId && !error && flows.length > 0 && (
              <span className="apl-count">
                {visibleFlows.length} of {flows.length} flow{flows.length === 1 ? "" : "s"} on this page
              </span>
            )}
          </>
        }
      />

      {showCreate && (
        <CreateApprovalForm
          organizationId={organizationId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
};

export default ApprovalManagement;
