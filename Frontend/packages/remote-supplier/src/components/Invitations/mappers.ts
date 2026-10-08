import type { BuyerInvitationItem, VerificationQuestion, SupplierProfileResponse } from "../../api/supplierApi";
import type { Invitation, InvitationStatus, QuestionKind } from "./types";

export const mapApiStatus = (status: string): InvitationStatus => {
    const normalized = (status || "").toUpperCase();
    if (normalized === "ACCEPTED" || normalized === "ACCEPT") return "accepted";
    if (normalized === "DECLINED" || normalized === "REJECT" || normalized === "REJECTED") return "declined";
    if (normalized === "SUBMITTED") return "submitted";
    if (normalized === "CLOSED") return "closed";
    return "open";
};

export const getQuestionKind = (rawType: string): QuestionKind => {
    const t = (rawType || "").toUpperCase().replace(/[\s_-]/g, "");
    if (t === "TEXT" || t === "INPUT") return "text";
    if (t === "RADIOBUTTON" || t === "RADIO") return "radio";
    if (t === "CHECKBOX") return "checkbox";
    if (t === "FILE" || t === "ATTACHMENT") return "file";
    if (t === "LABEL") return "label";
    return "other";
};

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
    text: "Text",
    radio: "Single choice",
    checkbox: "Multiple choice",
    file: "File upload",
    label: "Information",
    other: "Other",
};

/** Whether a submitted/saved answer exists on the question itself (read-only views). */
export const hasSavedAnswer = (question: VerificationQuestion): boolean => {
    const kind = getQuestionKind(question.questionType);
    if (kind === "file") return Boolean(question.assetId);
    if (kind === "radio") return Boolean(question.verificationTemplateQuestionOptionId);
    return Boolean(question.answer && question.answer.trim());
};

export const mapApiItemToInvitation = (item: BuyerInvitationItem): Invitation => ({
    code: item.rfqNumber,
    status: mapApiStatus(item.status),
    title: item.title,
    company: item.organizationName,
    description: item.description,
    closing: item.endDate ? new Date(item.endDate).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—",
    rfqId: item.rfqId,
    id: item.id,
});

export const BUSINESS_PROFILE_FIELD_MAP: { match: string; getValue: (p: SupplierProfileResponse) => string }[] = [
    { match: "bank name", getValue: (p) => p.bankAccounts?.[0]?.bankName || "" },
    { match: "account number", getValue: (p) => p.bankAccounts?.[0]?.accountNumber || "" },
    { match: "ifsc", getValue: (p) => p.bankAccounts?.[0]?.ifscCode || "" },
    { match: "bank branch", getValue: (p) => p.bankAccounts?.[0]?.branchName || "" },
    { match: "company name", getValue: (p) => p.businessProfile?.organizationName || "" },
    { match: "email", getValue: (p) => p.businessProfile?.email || "" },
    { match: "phone", getValue: (p) => p.businessProfile?.phone || "" },
    { match: "country", getValue: (p) => p.businessProfile?.country || "" },
    { match: "state", getValue: (p) => p.businessProfile?.state || "" },
    { match: "city", getValue: (p) => p.businessProfile?.city || "" },
    {
        match: "address",
        getValue: (p) =>
            [p.businessProfile?.addressLine1, p.businessProfile?.addressLine2].filter(Boolean).join(", "),
    },
];

export const getDefaultAnswerForQuestion = (
    question: VerificationQuestion,
    profile: SupplierProfileResponse
): string => {
    const kind = getQuestionKind(question.questionType);
    const matchedReg = profile.registrations?.find((r) =>
        question.question.toUpperCase().includes(r.registrationType.toUpperCase())
    );

    if (matchedReg) {
        if (kind === "file") {
            return matchedReg.asset?.fileName || "Not submitted";
        }
        return matchedReg.registrationNumber || "N/A";
    }

    if (kind === "file") {
        return "Not submitted";
    }

    const questionLower = question.question.toLowerCase();
    const fieldMatch = BUSINESS_PROFILE_FIELD_MAP.find((f) => questionLower.includes(f.match));
    if (fieldMatch) {
        return fieldMatch.getValue(profile) || "N/A";
    }

    return "N/A";
};
