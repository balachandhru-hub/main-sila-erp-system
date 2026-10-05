import React from "react";
import { FaCheck, FaFileAlt } from "react-icons/fa";
import {
    Card,
    Choice,
    ChoiceGroup,
    EmptyState,
    Loader,
    PageHeader,
    QuestionAnswer,
    QuestionItem,
    QuestionList,
    QuestionProgress,
    StatusBadge,
} from "@vosox/shared-ui";
import type { useVerificationAnswers } from "../../hooks/useVerificationAnswers";
import { getQuestionKind, hasSavedAnswer, QUESTION_KIND_LABELS } from "./mappers";
import { IconBuildingSmall, IconCalendar, IconCheckCircle } from "./icons";
import type { VerificationQuestion } from "../../api/supplierApi";

interface InvitationDetailViewProps {
    adminRole: "buyer" | "supplier" | undefined;
    detail: ReturnType<typeof useVerificationAnswers>;
}

const InvitationDetailView: React.FC<InvitationDetailViewProps> = ({ adminRole, detail }) => {
    const {
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
        closeDetail,
        handleSubmitDefault,
        handleDownloadAsset,
        handleTextAnswerChange,
        handleRadioChange,
        handleCheckboxChange,
        handleFileChange,
        handleSubmitAnswers,
    } = detail;

    if (!detailInvitation) return null;

    const renderReadOnlyAnswer = (question: VerificationQuestion) => {
        const kind = getQuestionKind(question.questionType);

        if (kind === "file") {
            return (
                <QuestionAnswer emptyText="No file uploaded">
                    {question.assetId && (
                        <button
                            type="button"
                            className="sila-btn sila-btn--secondary sila-btn--sm"
                            onClick={() => handleDownloadAsset(question.assetId!)}
                        >
                            <FaFileAlt aria-hidden="true" /> View uploaded file
                        </button>
                    )}
                </QuestionAnswer>
            );
        }

        if (kind === "radio") {
            const selected = question.options?.find((option) => option.id === question.verificationTemplateQuestionOptionId);
            return <QuestionAnswer value={selected?.optionText || question.answer || ""} />;
        }

        if (kind === "checkbox") {
            const ids = (question.answer || "").split(",").map((id) => id.trim()).filter(Boolean);
            const labels = ids.map((id) => question.options?.find((option) => option.id === id)?.optionText || id);
            return <QuestionAnswer value={labels} />;
        }

        return <QuestionAnswer value={question.answer || ""} />;
    };

    const isDraftAnswered = (question: VerificationQuestion): boolean => {
        const answer = verificationAnswers[question.verificationTemplateQuestionId];
        switch (getQuestionKind(question.questionType)) {
            case "file":
                return Boolean(answer?.file || question.assetId);
            case "radio":
                return Boolean(answer?.selectedOptionId);
            case "checkbox":
                return Boolean(answer?.selectedOptionIds?.length);
            default:
                return Boolean(answer?.textAnswer?.trim());
        }
    };

    const renderAnswerControl = (question: VerificationQuestion, inputId: string) => {
        const answer = verificationAnswers[question.verificationTemplateQuestionId];
        const questionId = question.verificationTemplateQuestionId;

        switch (getQuestionKind(question.questionType)) {
            case "text":
                return (
                    <input
                        id={inputId}
                        type="text"
                        className="sila-input"
                        placeholder="Enter your answer..."
                        value={answer?.textAnswer || ""}
                        onChange={(e) => handleTextAnswerChange(questionId, e.target.value)}
                        required={question.isRequired}
                    />
                );

            case "radio":
                return question.options && question.options.length > 0 ? (
                    <ChoiceGroup type="radio" labelledBy={`${inputId}-label`}>
                        {question.options.map((option) => (
                            <Choice
                                key={option.id}
                                type="radio"
                                name={`radio-${questionId}`}
                                label={option.optionText}
                                checked={answer?.selectedOptionId === option.id}
                                onChange={() => handleRadioChange(questionId, option.id)}
                                required={question.isRequired}
                            />
                        ))}
                    </ChoiceGroup>
                ) : null;

            case "checkbox":
                return question.options && question.options.length > 0 ? (
                    <ChoiceGroup type="checkbox" labelledBy={`${inputId}-label`}>
                        {question.options.map((option) => (
                            <Choice
                                key={option.id}
                                type="checkbox"
                                label={option.optionText}
                                checked={answer?.selectedOptionIds?.includes(option.id) || false}
                                onChange={(e) => handleCheckboxChange(questionId, option.id, e.target.checked)}
                            />
                        ))}
                    </ChoiceGroup>
                ) : null;

            case "file":
                if (question.assetId) return renderReadOnlyAnswer(question);
                return (
                    <div className="inv-file-upload">
                        <input
                            id={inputId}
                            type="file"
                            className="sila-input inv-file-input"
                            onChange={(e) => handleFileChange(questionId, e.target.files?.[0] || null)}
                            required={question.isRequired}
                        />
                        {answer?.file && (
                            <div className="sila-help inv-file-name">
                                <FaFileAlt aria-hidden="true" /> {answer.file.name}
                            </div>
                        )}
                    </div>
                );

            default:
                return renderReadOnlyAnswer(question);
        }
    };

    const questions = viewingDetail?.questions ?? [];
    const isBuyer = adminRole === "buyer";
    const isEditable = !isBuyer && !isDefaultTemplate && !isAlreadySubmitted;
    const answeredCount = questions.filter((q) => (isEditable ? isDraftAnswered(q) : hasSavedAnswer(q))).length;

    const qaSubtitle = isDefaultTemplate
        ? isBuyer
            ? "Details the supplier confirmed from their company profile."
            : "Pulled from your company profile. Review them before accepting."
        : isBuyer
            ? "The supplier's responses to your verification questions."
            : "Answer the buyer's verification questions. You can save a draft and come back later.";

    return (
        <div className="sad-border inv-page">
            <PageHeader
                className="inv-page-header"
                title={detailInvitation.title || viewingDetail?.rfqNumber || "Invitation"}
                meta={viewingDetail && <StatusBadge status={viewingDetail.status} size="sm" />}
                description={
                    viewingDetail && (
                        <span className="inv-detail-meta">
                            <span><IconBuildingSmall /> {viewingDetail.organizationName || "Organization"}</span>
                            <span><IconCalendar /> Due {new Date(viewingDetail.dueDate).toLocaleString()}</span>
                        </span>
                    )
                }
                onBack={closeDetail}
                backLabel="Back to invitations"
            />

            {loadingDetail ? (
                <Card><Loader size={24} message="Fetching invitation details..." /></Card>
            ) : detailError ? (
                <Card><EmptyState variant="error" title="Couldn't load invitation" description={detailError} /></Card>
            ) : viewingDetail ? (
                <>
                    <Card title="Invitation Details">
                        <div className="inv-detail-summary">
                            {viewingDetail.description && <p className="inv-detail-desc">{viewingDetail.description}</p>}

                            <dl className="sila-meta-grid">
                                <div className="sila-meta-item">
                                    <dt className="sila-meta-label">RFQ Number</dt>
                                    <dd className="sila-meta-value">
                                        {viewingDetail.rfqNumber ? <span className="sila-ref">{viewingDetail.rfqNumber}</span> : "—"}
                                    </dd>
                                </div>
                                <div className="sila-meta-item">
                                    <dt className="sila-meta-label">Reference No.</dt>
                                    <dd className="sila-meta-value">
                                        {viewingDetail.snid ? <span className="sila-ref">{viewingDetail.snid}</span> : "—"}
                                    </dd>
                                </div>
                                <div className="sila-meta-item">
                                    <dt className="sila-meta-label">Remarks</dt>
                                    <dd className="sila-meta-value">{viewingDetail.remarks || "—"}</dd>
                                </div>
                            </dl>
                        </div>
                    </Card>

                    {questions.length > 0 && (
                        <Card
                            title={isDefaultTemplate ? "Company Details" : "Questions & Answers"}
                            subtitle={qaSubtitle}
                            actions={!isDefaultTemplate && <QuestionProgress answered={answeredCount} total={questions.length} />}
                        >
                            <div className="inv-detail-qa">
                                {!isBuyer && isDefaultTemplate && (
                                    <>
                                        {loadingProfile && <Loader size={20} message="Loading your details..." />}
                                        {profileError && !loadingProfile && (
                                            <div className="sila-alert sila-alert--danger inv-alert" role="alert">{profileError}</div>
                                        )}
                                        {supplierProfile && !loadingProfile && !isAlreadySubmitted && (
                                            <div className="sila-alert inv-alert inv-alert--info">
                                                Review the details below. If everything is correct, click <strong>Accept</strong>, then <strong>Submit</strong> to finalize.
                                            </div>
                                        )}
                                    </>
                                )}

                                {verificationError && (
                                    <div className="sila-alert sila-alert--danger inv-alert" role="alert">{verificationError}</div>
                                )}

                                {verificationSuccess && (
                                    <div className="sila-alert sila-alert--success inv-alert inv-alert--success" role="status">
                                        <IconCheckCircle /> Answers submitted successfully!
                                    </div>
                                )}

                                <QuestionList aria-label="Verification questions">
                                    {questions.map((question, index) => {
                                        const kind = getQuestionKind(question.questionType);
                                        const inputId = `inv-q-${question.verificationTemplateQuestionId}`;
                                        const labelsControl = isEditable && (kind === "text" || (kind === "file" && !question.assetId));

                                        return (
                                            <QuestionItem
                                                key={question.verificationTemplateQuestionId}
                                                index={index + 1}
                                                question={question.question}
                                                typeLabel={isDefaultTemplate ? undefined : QUESTION_KIND_LABELS[kind]}
                                                required={!isDefaultTemplate && question.isRequired}
                                                inputId={labelsControl ? inputId : undefined}
                                                labelId={`${inputId}-label`}
                                            >
                                                {isDefaultTemplate ? (
                                                    <QuestionAnswer
                                                        value={
                                                            isBuyer
                                                                ? question.answer || ""
                                                                : supplierProfile
                                                                    ? defaultAnswers[question.verificationTemplateQuestionId] || ""
                                                                    : ""
                                                        }
                                                        emptyText={isBuyer ? "Not yet submitted" : "Not available"}
                                                    />
                                                ) : isEditable ? (
                                                    renderAnswerControl(question, inputId)
                                                ) : (
                                                    renderReadOnlyAnswer(question)
                                                )}
                                            </QuestionItem>
                                        );
                                    })}
                                </QuestionList>
                            </div>
                        </Card>
                    )}

                    {!isBuyer && (
                        <div className="sila-card inv-detail-actions">
                            <span className="inv-detail-actions-hint">
                                {isAlreadySubmitted
                                    ? "These answers have been submitted to the buyer."
                                    : isDefaultTemplate
                                        ? "Accept the details, then submit them to the buyer."
                                        : `${answeredCount} of ${questions.length} questions answered`}
                            </span>

                            <div className="sila-btn-group">
                                {isDefaultTemplate ? (
                                    <>
                                        <button
                                            type="button"
                                            className="sila-btn sila-btn--secondary"
                                            onClick={() => setHasConfirmedDetails(true)}
                                            disabled={loadingProfile || !supplierProfile || isAlreadySubmitted || hasConfirmedDetails}
                                        >
                                            {hasConfirmedDetails ? <><FaCheck aria-hidden="true" /> Accepted</> : "Accept"}
                                        </button>
                                        <button
                                            type="button"
                                            className="sila-btn sila-btn--primary"
                                            onClick={handleSubmitDefault}
                                            disabled={submittingVerification || isAlreadySubmitted || !hasConfirmedDetails}
                                        >
                                            {submittingVerification ? "Submitting..." : "Submit"}
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <button
                                            type="button"
                                            className="sila-btn sila-btn--secondary"
                                            onClick={() => handleSubmitAnswers("DRAFT")}
                                            disabled={submittingVerification || isAlreadySubmitted}
                                        >
                                            {submittingVerification ? "Saving..." : "Save as Draft"}
                                        </button>
                                        <button
                                            type="button"
                                            className="sila-btn sila-btn--primary"
                                            onClick={() => handleSubmitAnswers("SUBMITTED")}
                                            disabled={submittingVerification || isAlreadySubmitted}
                                        >
                                            {submittingVerification ? "Submitting..." : "Submit Answers"}
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </>
            ) : null}
        </div>
    );
};

export default InvitationDetailView;
