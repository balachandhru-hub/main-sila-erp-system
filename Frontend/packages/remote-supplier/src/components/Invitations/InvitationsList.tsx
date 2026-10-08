import React from "react";
import { EmptyState, Loader, PageHeader, Pagination } from "@vosox/shared-ui";
import type { useInvitationsList } from "../../hooks/useInvitationsList";
import { INVITATION_TABS } from "../../common";
import InvitationCard from "./InvitationCard";
import { IconSearch, IconClose, IconBookOpen } from "./icons";
import type { Invitation } from "./types";

const tabs = INVITATION_TABS;

interface InvitationsListProps {
    list: ReturnType<typeof useInvitationsList>;
    isAdmin: boolean;
    onViewDetails: (invitation: Invitation) => void;
}

const InvitationsList: React.FC<InvitationsListProps> = ({ list, isAdmin, onViewDetails }) => {
    const {
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
    } = list;

    const tabCounts = invitationCounts;

    return (
        <>
            <div className="sad-border inv-page">
                <PageHeader
                    className="inv-page-header"
                    title="Sourcing Invitations"
                    description="Direct invitations from buyers asking you to submit price bids and proposals."
                />

                <section className="sila-card inv-list-card">
                    <div className="inv-tabs-bar">
                        <div className="sila-tabs inv-tabs" role="tablist" aria-label="Invitation status">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={activeTab === tab.key}
                                    className={`sila-tab inv-tab${activeTab === tab.key ? " inv-tab-active" : ""}`}
                                    onClick={() => handleTabChange(tab.key)}
                                >
                                    {tab.label}
                                    <span className="sila-count sila-count--neutral">{tabCounts[tab.key]}</span>
                                </button>
                            ))}
                        </div>

                        <div className="inv-search-wrapper">
                            <div className="sila-search inv-search">
                                <span className="sila-search-icon" aria-hidden="true"><IconSearch /></span>

                                <input
                                    type="text"
                                    className="sila-input"
                                    placeholder="Search buyer, ID or category..."
                                    aria-label="Search invitations"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setSearchQuery(value);

                                        if (value.trim() === "") {
                                            handleClearSearch();
                                        }
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleSearch();
                                        }
                                    }}
                                />

                                {searchQuery.trim() && (
                                    <button
                                        type="button"
                                        className="inv-search-clear"
                                        onClick={handleClearSearch}
                                        title="Clear search"
                                        aria-label="Clear search"
                                    >
                                        <IconClose />
                                    </button>
                                )}
                            </div>

                            <button
                                type="button"
                                className="sila-btn sila-btn--secondary"
                                onClick={handleSearch}
                                disabled={loading || !searchQuery.trim()}
                            >
                                Search
                            </button>
                        </div>
                    </div>

                    <div className="inv-list-body">
                        {loading ? (
                            <Loader size={24} message="Loading invitations..." />
                        ) : error ? (
                            <EmptyState variant="error" title="Couldn't load invitations" description={error} />
                        ) : invitations.length > 0 ? (
                            <div className="inv-grid">
                                {invitations.map((inv, idx) => (
                                    <InvitationCard
                                        key={`${inv.code}-${idx}`}
                                        invitation={inv}
                                        showActions={showActions}
                                        canViewDetails={Boolean(inv.id)}
                                        onAccept={handleAccept}
                                        onDecline={handleDecline}
                                        onViewDetails={onViewDetails}
                                        actionLoading={actionLoadingId === inv.id ? actionKind : null}
                                        actionError={inv.id ? actionErrors[inv.id] || null : null}
                                    />
                                ))}
                            </div>
                        ) : (
                            <EmptyState
                                icon={<IconBookOpen />}
                                title="No Invitations Found"
                                description="There are no sourcing invitations matching your search criteria or filter at this time."
                            />
                        )}
                    </div>

                    {isAdmin && !loading && !error && (
                        <Pagination
                            page={currentPage + 1}
                            hasNext={hasNextPage}
                            onPrevious={() => {
                                const previousPage = currentPage - 1;

                                setCurrentPage(previousPage);
                                setInvitations([]);
                                loadInvitations(previousPage, activeTab, appliedSearchQuery);
                            }}
                            onNext={() => {
                                const nextPage = currentPage + 1;

                                setCurrentPage(nextPage);
                                setInvitations([]);
                                loadInvitations(nextPage, activeTab, appliedSearchQuery);
                            }}
                        />
                    )}
                </section>
            </div>
        </>
    );
};

export default InvitationsList;
