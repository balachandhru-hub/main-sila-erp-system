import { useEffect, useState } from "react";
import { isErrorResponse } from "@vosox/shared-ui";
import { INVITATION_STATUS, INVITATION_STATUS_BACKEND_MAP } from "../common";
import {
  fetchBuyerInvitations,
  fetchSupplierInvitations,
  fetchInvitationSummary,
  updateSupplierInvitationStatus,
} from "../api/supplierApi";
import { mapApiItemToInvitation } from "../components/Invitations/mappers";
import { mockInvitations } from "../components/Invitations/mockData";
import type { Invitation, TabKey } from "../components/Invitations/types";

export const INVITATIONS_PAGE_SIZE = 12;

export function useInvitationsList(isAdmin: boolean, adminRole: "buyer" | "supplier" | undefined) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedSearchQuery, setAppliedSearchQuery] = useState("");

  const [currentPage, setCurrentPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);

  const [invitationCounts, setInvitationCounts] = useState({
    all: 0,
    open: 0,
    submitted: 0,
    accepted: 0,
    declined: 0,
  });

  const [invitations, setInvitations] = useState<Invitation[]>(mockInvitations);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionKind, setActionKind] = useState<"accept" | "decline" | null>(null);
  const [actionErrors, setActionErrors] = useState<{ [id: string]: string }>({});

  const loadInvitations = async (
    page = currentPage,
    tab: TabKey = activeTab,
    search: string = appliedSearchQuery
  ) => {
    if (!isAdmin) {
      setInvitations(mockInvitations);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fetcher = adminRole === "supplier" ? fetchSupplierInvitations : fetchBuyerInvitations;

      const status = tab === INVITATION_STATUS.ALL
        ? undefined
        : INVITATION_STATUS_BACKEND_MAP[tab];

      const trimmedSearch = search.trim();

      const data = await fetcher({
        index: page * INVITATIONS_PAGE_SIZE,
        limit: INVITATIONS_PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(trimmedSearch ? { search: trimmedSearch } : {}),
      });

      if (isErrorResponse(data)) {
        setError(data.description || data.message || "Failed to load invitations.");
        setInvitations([]);
        setHasNextPage(false);
        return;
      }

      setInvitations(data.map(mapApiItemToInvitation));
      setHasNextPage(data.length === INVITATIONS_PAGE_SIZE);
    } catch (err: any) {
      setError(err.message || "Failed to load invitations.");
      setInvitations([]);
      setHasNextPage(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      if (!isAdmin) {
        setInvitations(mockInvitations);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const summary = await fetchInvitationSummary();

        if (isErrorResponse(summary)) {
          setError(summary.description || summary.message || "Failed to load invitation summary.");
          setInvitations([]);
          return;
        }

        setInvitationCounts({
          all: summary.all || 0,
          open: summary.pending || 0,
          submitted: summary.submitted || 0,
          accepted: summary.accepted || 0,
          declined: summary.declined || 0,
        });

        const fetcher = adminRole === "supplier" ? fetchSupplierInvitations : fetchBuyerInvitations;

        const data = await fetcher({
          index: 0,
          limit: INVITATIONS_PAGE_SIZE,
        });

        if (isErrorResponse(data)) {
          setError(data.description || data.message || "Failed to load invitations.");
          setInvitations([]);
          setHasNextPage(false);
          return;
        }

        setInvitations(data.map(mapApiItemToInvitation));
        setHasNextPage(data.length === INVITATIONS_PAGE_SIZE);
        setCurrentPage(0);
      } catch (err: any) {
        setError(err.message || "Failed to load invitations.");
        setInvitations([]);
        setHasNextPage(false);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [isAdmin, adminRole]);

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(0);
    setInvitations([]);
    loadInvitations(0, tab, appliedSearchQuery);
  };

  const handleSearch = () => {
    const search = searchQuery.trim();

    setAppliedSearchQuery(search);
    setCurrentPage(0);
    setInvitations([]);

    loadInvitations(0, activeTab, search);
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setAppliedSearchQuery("");
    setCurrentPage(0);
    setInvitations([]);

    loadInvitations(0, activeTab, "");
  };

  const showActions = isAdmin && adminRole === "buyer";

  const refreshInvitationSummary = async () => {
    try {
      const summary = await fetchInvitationSummary();

      if (isErrorResponse(summary)) {
        return;
      }

      setInvitationCounts({
        all: summary.all || 0,
        open: summary.pending || 0,
        submitted: summary.submitted || 0,
        accepted: summary.accepted || 0,
        declined: summary.declined || 0,
      });
    } catch {
    }
  };

  const handleAccept = async (invitation: Invitation) => {
    if (!invitation.id) return;
    setActionLoadingId(invitation.id);
    setActionKind("accept");
    setActionErrors((prev) => ({ ...prev, [invitation.id!]: "" }));

    try {
      const result = await updateSupplierInvitationStatus({
        requestId: invitation.id,
        status: "accept",
      });

      if (isErrorResponse(result)) {
        setActionErrors((prev) => ({ ...prev, [invitation.id!]: result.description || result.message || "Failed to accept invitation." }));
        return;
      }

      await refreshInvitationSummary();
      setInvitations([]);
      await loadInvitations(currentPage, activeTab, appliedSearchQuery);
    } catch (err: any) {
      setActionErrors((prev) => ({ ...prev, [invitation.id!]: err.message || "Failed to accept invitation." }));
    } finally {
      setActionLoadingId(null);
      setActionKind(null);
    }
  };

  const handleDecline = async (invitation: Invitation) => {
    if (!invitation.id) return;

    setActionLoadingId(invitation.id);
    setActionKind("decline");
    setActionErrors((prev) => ({ ...prev, [invitation.id!]: "" }));

    try {
      const result = await updateSupplierInvitationStatus({
        requestId: invitation.id,
        status: "reject",
      });

      if (isErrorResponse(result)) {
        setActionErrors((prev) => ({ ...prev, [invitation.id!]: result.description || result.message || "Failed to decline invitation." }));
        return;
      }

      await refreshInvitationSummary();
      setInvitations([]);
      await loadInvitations(currentPage, activeTab, appliedSearchQuery);
    } catch (err: any) {
      setActionErrors((prev) => ({ ...prev, [invitation.id!]: err.message || "Failed to decline invitation." }));
    } finally {
      setActionLoadingId(null);
      setActionKind(null);
    }
  };

  return {
    activeTab,
    searchQuery,
    setSearchQuery,
    appliedSearchQuery,
    currentPage,
    setCurrentPage,
    hasNextPage,
    invitationCounts,
    invitations,
    setInvitations,
    loading,
    error,
    actionLoadingId,
    actionKind,
    actionErrors,
    loadInvitations,
    handleTabChange,
    handleSearch,
    handleClearSearch,
    showActions,
    handleAccept,
    handleDecline,
  };
}
