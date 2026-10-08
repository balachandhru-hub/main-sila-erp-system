import { useState } from "react";
import { isErrorResponse, toastService } from "@vosox/shared-ui";
import { DEFAULT_VERIFICATION_TEMPLATE_ID } from "../common";
import {
  getSupplierProfileByOrgId,
  fetchInvitationAnswers,
  submitVerificationAnswers,
  fetchSupplierAsset,
  type InvitationAnswersResponse,
  type SupplierProfileResponse,
  type SubmitVerificationPayload,
} from "../api/supplierApi";
import { useSupplierAuthStore } from "../store/useSupplierAuthStore";
import { getDefaultAnswerForQuestion, getQuestionKind } from "../components/Invitations/mappers";
import type { Invitation, VerificationAnswer } from "../components/Invitations/types";

export function useVerificationAnswers(adminRole: "buyer" | "supplier" | undefined) {
  const [viewingDetail, setViewingDetail] = useState<InvitationAnswersResponse | null>(null);
  const [detailInvitation, setDetailInvitation] = useState<Invitation | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [verificationAnswers, setVerificationAnswers] = useState<{
    [questionId: string]: VerificationAnswer;
  }>({});
  const [submittingVerification, setSubmittingVerification] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [defaultAnswers, setDefaultAnswers] = useState<Record<string, string>>({});
  const [hasConfirmedDetails, setHasConfirmedDetails] = useState(false);

  const [supplierProfile, setSupplierProfile] = useState<SupplierProfileResponse | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const loadDefaultAnswers = async (detail: InvitationAnswersResponse) => {
    setLoadingProfile(true);
    setProfileError(null);

    try {
      const person = useSupplierAuthStore.getState().personDetail;

      if (!person) {
        const msg = "Failed to identify organization.";
        setProfileError(msg);
        toastService.error(msg);
        return;
      }

      const result = await getSupplierProfileByOrgId(person.organizationId);

      if (isErrorResponse(result)) {
        const msg = result.description || result.message || "Failed to load supplier profile.";
        setProfileError(msg);
        toastService.error(msg);
        return;
      }

      setSupplierProfile(result);

      const answers: Record<string, string> = {};

      detail.questions.forEach((q) => {
        answers[q.verificationTemplateQuestionId] = getDefaultAnswerForQuestion(q, result);
      });

      setDefaultAnswers(answers);
    } catch (err: any) {
      const msg = err.message || "Failed to load supplier profile.";
      setProfileError(msg);
      toastService.error(msg);
    } finally {
      setLoadingProfile(false);
    }
  };

  const closeDetail = () => {
    setViewingDetail(null);
    setDetailInvitation(null);
    setDetailError(null);
    setVerificationAnswers({});
    setSupplierProfile(null);
    setDefaultAnswers({});
    setProfileError(null);
    setHasConfirmedDetails(false);
  };

  const handleSubmitDefault = async () => {
    if (!viewingDetail || !detailInvitation) return;

    setVerificationError(null);
    setVerificationSuccess(false);
    setSubmittingVerification(true);

    try {
      const payload: SubmitVerificationPayload = {
        verificationRequestId: viewingDetail.requestId,
        supplierId: viewingDetail.supplierOrganizationId,
        answers: null,
        status: "SUBMITTED",
      };

      const result = await submitVerificationAnswers(payload);

      if (isErrorResponse(result)) {
        const msg = result.description || result.message || "Failed to submit.";
        setVerificationError(msg);
        toastService.error(msg);
        return;
      }

      setVerificationSuccess(true);
      toastService.success("Verification submitted successfully!");

      setTimeout(() => closeDetail(), 1500);
    } catch (err: any) {
      const msg = err.message || "Failed to submit.";
      setVerificationError(msg);
      toastService.error(msg);
    } finally {
      setSubmittingVerification(false);
    }
  };

  const handleDownloadAsset = async (assetId: string) => {
    try {
      const result = await fetchSupplierAsset(assetId);

      if (isErrorResponse(result)) {
        toastService.error(result.description || result.message || "Failed to load file.");
        return;
      }

      const url = result.url || result.fileUrl;

      if (url) {
        window.open(url, "_blank");
        return;
      }

      if (result.fileBytes && result.contentType) {
        const byteChars = atob(result.fileBytes);
        const byteNumbers = new Array(byteChars.length);

        for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);

        const blob = new Blob([new Uint8Array(byteNumbers)], { type: result.contentType });
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");

        a.href = blobUrl;
        a.download = result.fileName || result.assetName || "file";
        a.click();

        URL.revokeObjectURL(blobUrl);
        return;
      }

      toastService.error("File data unavailable.");
    } catch (err: any) {
      toastService.error(err.message || "Failed to load file.");
    }
  };

  const handleViewDetails = async (invitation: Invitation) => {
    if (!invitation.id) return;

    setDetailInvitation(invitation);
    window.scrollTo({ top: 0 });
    setViewingDetail(null);
    setDetailError(null);
    setVerificationAnswers({});
    setVerificationError(null);
    setVerificationSuccess(false);
    setLoadingDetail(true);

    try {
      const result = await fetchInvitationAnswers(invitation.id);

      if (isErrorResponse(result)) {
        setDetailError(result.description || result.message || "Failed to load invitation details.");
        return;
      }

      setViewingDetail(result);

      const isDefault = result.templateId?.toLowerCase() === DEFAULT_VERIFICATION_TEMPLATE_ID.toLowerCase();

      if (isDefault && adminRole === "supplier") {
        loadDefaultAnswers(result);
      } else if (!isDefault) {
        const initialAnswers: { [questionId: string]: VerificationAnswer } = {};

        result.questions?.forEach((q) => {
          const kind = getQuestionKind(q.questionType);

          const savedOptionIds = kind === "checkbox" && q.answer
            ? q.answer.split(",").map((s) => s.trim()).filter(Boolean)
            : [];

          initialAnswers[q.verificationTemplateQuestionId] = {
            textAnswer: q.answer || "",
            selectedOptionId: q.verificationTemplateQuestionOptionId || null,
            selectedOptionIds: savedOptionIds,
            file: null,
            fileBase64: "",
          };
        });

        setVerificationAnswers(initialAnswers);
      }
    } catch (err: any) {
      setDetailError(err.message || "Failed to load invitation details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  const isAlreadySubmitted = viewingDetail?.status === "SUBMITTED";
  const isDefaultTemplate = viewingDetail?.templateId?.toLowerCase() === DEFAULT_VERIFICATION_TEMPLATE_ID.toLowerCase();

  const handleTextAnswerChange = (questionId: string, value: string) => {
    setVerificationAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { textAnswer: "", selectedOptionId: null, selectedOptionIds: [], file: null, fileBase64: "" }),
        textAnswer: value,
      },
    }));
  };

  const handleRadioChange = (questionId: string, optionId: string) => {
    setVerificationAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || { textAnswer: "", selectedOptionId: null, selectedOptionIds: [], file: null, fileBase64: "" }),
        selectedOptionId: optionId,
        selectedOptionIds: [optionId],
      },
    }));
  };

  const handleCheckboxChange = (questionId: string, optionId: string, checked: boolean) => {
    setVerificationAnswers((prev) => {
      const current = prev[questionId]?.selectedOptionIds || [];
      const updated = checked ? [...current, optionId] : current.filter((id) => id !== optionId);

      return {
        ...prev,
        [questionId]: {
          ...(prev[questionId] || { textAnswer: "", selectedOptionId: null, selectedOptionIds: [], file: null, fileBase64: "" }),
          selectedOptionIds: updated,
        },
      };
    });
  };

  const handleFileChange = (questionId: string, file: File | null) => {
    if (!file) {
      setVerificationAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || { textAnswer: "", selectedOptionId: null, selectedOptionIds: [], file: null, fileBase64: "" }),
          file: null,
          fileBase64: "",
        },
      }));
      return;
    }

    const reader = new FileReader();

    reader.onloadend = () => {
      const result = reader.result as string;
      const base64Data = result.split(",")[1] || result;

      setVerificationAnswers((prev) => ({
        ...prev,
        [questionId]: {
          ...(prev[questionId] || { textAnswer: "", selectedOptionId: null, selectedOptionIds: [], file: null, fileBase64: "" }),
          file,
          fileBase64: base64Data,
          textAnswer: file.name,
        },
      }));
    };

    reader.readAsDataURL(file);
  };

  const validateAnswers = (): boolean => {
    if (!viewingDetail?.questions) return true;

    for (const question of viewingDetail.questions) {
      if (!question.isRequired) continue;

      const answer = verificationAnswers[question.verificationTemplateQuestionId];
      const kind = getQuestionKind(question.questionType);

      if (kind === "text") {
        if (!answer?.textAnswer?.trim()) {
          setVerificationError(`Please answer the required question: "${question.question}"`);
          return false;
        }
      } else if (kind === "radio") {
        if (!answer?.selectedOptionId) {
          setVerificationError(`Please select an option for: "${question.question}"`);
          return false;
        }
      } else if (kind === "checkbox") {
        if (!answer?.selectedOptionIds || answer.selectedOptionIds.length === 0) {
          setVerificationError(`Please select at least one option for: "${question.question}"`);
          return false;
        }
      } else if (kind === "file") {
        if (!answer?.file && !question.assetId) {
          setVerificationError(`Please upload a file for: "${question.question}"`);
          return false;
        }
      }
    }

    return true;
  };

  const handleSubmitAnswers = async (status: "SUBMITTED" | "DRAFT") => {
    if (!viewingDetail || !detailInvitation) return;

    setVerificationError(null);
    setVerificationSuccess(false);

    if (status === "SUBMITTED" && !validateAnswers()) {
      return;
    }

    setSubmittingVerification(true);

    try {
      const answers = viewingDetail.questions?.map((question) => {
        const answer = verificationAnswers[question.verificationTemplateQuestionId];
        const kind = getQuestionKind(question.questionType);

        let answerText = "";
        let selectedOptionId: string | null = null;

        if (kind === "text") {
          answerText = answer?.textAnswer || "";
        } else if (kind === "radio") {
          selectedOptionId = answer?.selectedOptionId || null;
          answerText = answer?.textAnswer || "";
        } else if (kind === "checkbox") {
          answerText = answer?.selectedOptionIds?.join(", ") || "";
        } else if (kind === "file") {
          answerText = answer?.file?.name || "";
        }

        return {
          verificationTemplateQuestionId: question.verificationTemplateQuestionId,
          templateId: viewingDetail.templateId,
          answer: answerText || null,
          verificationTemplateQuestionOptionId: selectedOptionId,
          attachment: answer?.file && answer?.fileBase64
            ? {
              entityType: "SUPPLIER",
              // Stored against this verification request and never as a singleton: a
              // singleton upload deactivates the supplier's files for every other question.
              entityId: viewingDetail.supplierOrganizationId,
              assetType: "VERIFICATION_ATTACHMENT",
              fileBytes: answer.fileBase64,
              fileName: answer.file.name,
              contentType: answer.file.type,
              isSingletonAsset: false,
            }
            : null,
        };
      }) || [];

      const payload: SubmitVerificationPayload = {
        verificationRequestId: viewingDetail.requestId,
        supplierId: viewingDetail.supplierOrganizationId,
        answers,
        status,
      };

      const result = await submitVerificationAnswers(payload);

      if (isErrorResponse(result)) {
        const msg = result.description || result.message || `Failed to ${status === "SUBMITTED" ? "submit" : "save"} answers.`;
        setVerificationError(msg);
        toastService.error(msg);
        return;
      }

      setVerificationSuccess(true);
      toastService.success(status === "SUBMITTED" ? "Answers submitted successfully!" : "Draft saved successfully!");

      setTimeout(() => {
        closeDetail();
      }, 1500);
    } catch (err: any) {
      const msg = err.message || `Failed to ${status === "SUBMITTED" ? "submit" : "save"} answers.`;
      setVerificationError(msg);
      toastService.error(msg);
    } finally {
      setSubmittingVerification(false);
    }
  };

  return {
    viewingDetail,
    detailInvitation,
    loadingDetail,
    detailError,
    verificationAnswers,
    submittingVerification,
    verificationError,
    verificationSuccess,
    defaultAnswers,
    hasConfirmedDetails,
    setHasConfirmedDetails,
    supplierProfile,
    loadingProfile,
    profileError,
    isAlreadySubmitted,
    isDefaultTemplate,
    handleViewDetails,
    closeDetail,
    handleSubmitDefault,
    handleDownloadAsset,
    handleTextAnswerChange,
    handleRadioChange,
    handleCheckboxChange,
    handleFileChange,
    handleSubmitAnswers,
  };
}
