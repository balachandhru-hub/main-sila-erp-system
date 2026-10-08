import React from "react";
import "./SupplierDashboard.css";
import "./Invitations.css";
import { useInvitationsList } from "../hooks/useInvitationsList";
import { useVerificationAnswers } from "../hooks/useVerificationAnswers";
import InvitationsList from "./Invitations/InvitationsList";
import InvitationDetailView from "./Invitations/InvitationDetailView";
import type { InvitationsProps } from "./Invitations/types";

const Invitations: React.FC<InvitationsProps> = ({ isAdmin = false, adminRole }) => {
    const list = useInvitationsList(isAdmin, adminRole);
    const detail = useVerificationAnswers(adminRole);

    if (detail.detailInvitation) {
        return <InvitationDetailView adminRole={adminRole} detail={detail} />;
    }

    return <InvitationsList list={list} isAdmin={isAdmin} onViewDetails={detail.handleViewDetails} />;
};

export default Invitations;
