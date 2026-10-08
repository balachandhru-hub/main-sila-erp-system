export type InvitationStatus = "open" | "submitted" | "accepted" | "declined" | "closed";

export interface Invitation {
    code: string;
    category?: string;
    status: InvitationStatus;
    title: string;
    company: string;
    description: string;
    closing: string;
    rfqId?: string;
    id?: string;
}

export type TabKey = "all" | "open" | "submitted" | "accepted" | "declined";

export interface InvitationsProps {
    isAdmin?: boolean;
    adminRole?: "buyer" | "supplier";
}

export interface VerificationAnswer {
    textAnswer: string;
    selectedOptionId: string | null;
    selectedOptionIds: string[];
    file: File | null;
    fileBase64: string;
}

export type QuestionKind = "text" | "radio" | "checkbox" | "file" | "label" | "other";
