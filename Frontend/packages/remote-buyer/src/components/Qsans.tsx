import React, { useState } from "react";
import "./Qsans.css";
import { downloadBuyerAsset } from "../api/Buyerapi";
import { EmptyState, Loader, ChevronLeftIcon, CloseIcon, FileTextIcon } from "@vosox/shared-ui";

/* ---------------------------------- Types ---------------------------------- */

interface QsAnsProps {
    rfq: any;
    onBack: () => void;
    loading?: boolean;
    error?: string | null;
}

/* ---------------------------------- Helpers ---------------------------------- */

const getInitials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => word[0]?.toUpperCase() || "")
        .join("") || "?";

const formatQuestionType = (type?: string) => {
    if (!type) return "";
    const normalized = String(type).toLowerCase();
    const labels: Record<string, string> = {
        text: "Text",
        textarea: "Long text",
        checkbox: "Checkbox",
        radio: "Single choice",
        select: "Dropdown",
        file: "File",
        number: "Number",
        date: "Date",
    };
    return labels[normalized] || normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

/* ---------------------------------- Component ---------------------------------- */

const QsAns: React.FC<QsAnsProps> = ({ rfq, onBack, loading = false, error = null }) => {
    const [downloadingAssetId, setDownloadingAssetId] = useState<string | null>(null);
    const [downloadAssetError, setDownloadAssetError] = useState<string | null>(null);

    const [viewingAssetId, setViewingAssetId] = useState<string | null>(null);
    const [viewAssetError, setViewAssetError] = useState<string | null>(null);
    const [viewingAttachment, setViewingAttachment] = useState<{ fileName: string; url: string; contentType: string } | null>(null);

    const closeAttachmentViewer = () => {
        if (viewingAttachment?.url) {
            window.URL.revokeObjectURL(viewingAttachment.url);
        }
        setViewingAttachment(null);
    };

    const handleDownloadAnswerAttachment = async (attachment: any) => {
        if (!attachment?.id || downloadingAssetId) return;
        setDownloadingAssetId(attachment.id);
        setDownloadAssetError(null);
        try {
            const asset = await downloadBuyerAsset(attachment.id);
            if ("statusCode" in asset) {
                throw new Error((asset as any).message || "Failed to download document");
            }
            const byteCharacters = atob(asset.fileBytes);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: asset.contentType || "application/octet-stream" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = asset.fileName || attachment.fileName || "download";
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err: any) {
            setDownloadAssetError(err.message || "Failed to download the document.");
        } finally {
            setDownloadingAssetId(null);
        }
    };

    const handleViewAnswerAttachment = async (attachment: any) => {
        if (!attachment?.id || viewingAssetId) return;
        setViewingAssetId(attachment.id);
        setViewAssetError(null);
        try {
            const asset = await downloadBuyerAsset(attachment.id);
            if ("statusCode" in asset) {
                throw new Error((asset as any).message || "Failed to download document");
            }
            const byteCharacters = atob(asset.fileBytes);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const resolvedFileName = asset.fileName || attachment.fileName || "Document";
            const extension = resolvedFileName.split(".").pop()?.toLowerCase() || "";
            const extensionMimeMap: Record<string, string> = {
                pdf: "application/pdf",
                png: "image/png",
                jpg: "image/jpeg",
                jpeg: "image/jpeg",
                gif: "image/gif",
                webp: "image/webp",
                svg: "image/svg+xml",
                txt: "text/plain",
            };
            const viewContentType =
                extensionMimeMap[extension] ||
                (asset.contentType && asset.contentType !== "application/octet-stream" ? asset.contentType : "application/pdf");

            const blob = new Blob([byteArray], { type: viewContentType });
            const url = window.URL.createObjectURL(blob);
            setViewingAttachment({
                fileName: resolvedFileName,
                url,
                contentType: viewContentType,
            });
        } catch (err: any) {
            setViewAssetError(err.message || "Failed to load the document.");
        } finally {
            setViewingAssetId(null);
        }
    };

    const questions: any[] = Array.isArray(rfq?.questions) ? rfq.questions : [];
    const suppliers: any[] = Array.isArray(rfq?.supplierAnswers?.suppliers) ? rfq.supplierAnswers.suppliers : [];

    const getAnswerForQuestion = (supplier: any, question: any) => {
        const questionId = question?.id ?? question?.rfqQuestionId;
        const answerList = Array.isArray(supplier?.answers) ? supplier.answers : [];
        return answerList.find((a: any) => a?.rfqQuestionId === questionId) || null;
    };

    return (
        <div className="qsans-page">
            <div className="qsans-header">
                <span className="qsans-badge">
                    <FileTextIcon /> RFQ Question Answers
                </span>
                <button
                    type="button"
                    className="qsans-close"
                    onClick={() => (viewingAttachment ? closeAttachmentViewer() : onBack())}
                    aria-label="Close"
                >
                    <CloseIcon />
                </button>
                <h2 className="qsans-title">
                    {loading ? "Loading Q&A..." : rfq?.title || "RFQ Question Answers"}
                </h2>
                {!loading && !error && (questions.length > 0 || suppliers.length > 0) && (
                    <div className="qsans-header-meta">
                        <span>{questions.length} question{questions.length === 1 ? "" : "s"}</span>
                        <span className="qsans-header-dot" aria-hidden="true" />
                        <span>{suppliers.length} supplier response{suppliers.length === 1 ? "" : "s"}</span>
                    </div>
                )}
            </div>

            <div className="qsans-body">
                {viewingAttachment ? (
                    <div className="qsans-attachment-viewer">
                        <div className="qsans-attachment-toolbar">
                            <button type="button" className="qsans-btn qsans-btn-outline" onClick={closeAttachmentViewer}>
                                <ChevronLeftIcon size={14} /> Back
                            </button>
                            <span className="qsans-attachment-name" title={viewingAttachment.fileName}>{viewingAttachment.fileName}</span>
                            <span className="qsans-attachment-spacer" aria-hidden="true" />
                        </div>
                        <iframe
                            src={viewingAttachment.url}
                            title={viewingAttachment.fileName}
                            className="qsans-attachment-frame"
                        />
                    </div>
                ) : loading ? (
                    <div className="qsans-loading">
                        <Loader size={28} message="Fetching questions and answers..." />
                    </div>
                ) : error ? (
                    <EmptyState className="qsans-error" variant="error" title={error} />
                ) : (
                    <>
                        <div className="qsans-section-head">
                            <h3 className="qsans-section-title">Evaluation Questions &amp; Answers</h3>
                            <p className="qsans-section-sub">
                                Responses submitted by each supplier for this RFQ.
                            </p>
                        </div>

                        {questions.length === 0 ? (
                            <EmptyState className="qsans-empty" title="No evaluation questions were configured for this RFQ." />
                        ) : suppliers.length === 0 ? (
                            <EmptyState className="qsans-empty" title="No supplier responses have been submitted yet." />
                        ) : (
                            <div className="qsans-suppliers">
                                {suppliers.map((supplier: any, sIdx: number) => {
                                    const displayName = supplier?.supplierName || `Supplier ${sIdx + 1}`;
                                    const answeredCount = questions.filter((q: any) => {
                                        const m = getAnswerForQuestion(supplier, q);
                                        return Boolean(
                                            (m?.answer && String(m.answer).trim() !== "") || m?.attachment?.fileName
                                        );
                                    }).length;

                                    return (
                                        <div
                                            className="qsans-supplier-block"
                                            key={supplier?.supplierRFQId ? `${supplier.supplierRFQId}-${supplier.supplierId}-${sIdx}` : sIdx}
                                        >
                                            <div className="qsans-supplier-header">
                                                <span className="qsans-supplier-avatar" aria-hidden="true">{getInitials(displayName)}</span>
                                                <span className="qsans-supplier-name" title={displayName}>{displayName}</span>
                                                <span
                                                    className={`qsans-supplier-progress${answeredCount === questions.length ? " is-complete" : ""}`}
                                                >
                                                    {answeredCount}/{questions.length} answered
                                                </span>
                                            </div>

                                            <div className="qsans-questions-list">
                                                {questions.map((q: any, qIdx: number) => {
                                                    const match = getAnswerForQuestion(supplier, q);
                                                    const display =
                                                        match?.answer && String(match.answer).trim() !== ""
                                                            ? match.answer
                                                            : match?.attachment?.fileName || "";

                                                    return (
                                                        <div className="qsans-qa-card" key={q.id || qIdx}>
                                                            <div className="qsans-qa-question-row">
                                                                <span className="qsans-qa-index">Q{qIdx + 1}</span>
                                                                <span className="qsans-qa-question">{q.question}</span>
                                                                <span className="qsans-qa-tags">
                                                                    {q.isRequired && (
                                                                        <span className="qsans-qa-required">Required</span>
                                                                    )}
                                                                    <span className="qsans-qa-type">
                                                                        {formatQuestionType(q.questionType)}
                                                                    </span>
                                                                </span>
                                                            </div>

                                                            {display ? (
                                                                <div className="qsans-qa-answer-row">
                                                                    <span className="qsans-qa-answer">
                                                                        {match?.attachment && (
                                                                            <span className="qsans-qa-answer-icon" aria-hidden="true">
                                                                                <FileTextIcon />
                                                                            </span>
                                                                        )}
                                                                        <span className="qsans-qa-answer-text">{display}</span>
                                                                    </span>
                                                                    {match?.attachment && (
                                                                        <div className="qsans-qa-actions">
                                                                            <button
                                                                                type="button"
                                                                                className="qsans-btn qsans-btn-outline"
                                                                                disabled={viewingAssetId === match.attachment.id}
                                                                                onClick={() => handleViewAnswerAttachment(match.attachment)}
                                                                            >
                                                                                {viewingAssetId === match.attachment.id ? "Loading..." : "View"}
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                className="qsans-btn qsans-btn-outline"
                                                                                disabled={downloadingAssetId === match.attachment.id}
                                                                                onClick={() => handleDownloadAnswerAttachment(match.attachment)}
                                                                            >
                                                                                {downloadingAssetId === match.attachment.id ? "Downloading..." : "Download"}
                                                                            </button>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="qsans-qa-empty">No response yet.</div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}

                                {(downloadAssetError || viewAssetError) && (
                                    <div className="qsans-asset-error" role="alert">{downloadAssetError || viewAssetError}</div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="qsans-footer">
                <button
                    type="button"
                    className="qsans-btn qsans-btn-outline"
                    onClick={() => (viewingAttachment ? closeAttachmentViewer() : onBack())}
                >
                    {viewingAttachment ? "Back" : "Close"}
                </button>
            </div>
        </div>
    );
};

export default QsAns;