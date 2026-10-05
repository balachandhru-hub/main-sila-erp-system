import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Loader,
  isErrorResponse,
  Button,
  PageHeader,
  StatusBadge,
  Dropdown,
  IconMessageSquare,
  toastService,
  ToastContainer,
} from '@vosox/shared-ui';
import { FaCheckCircle, FaExclamationCircle, FaUserPlus } from 'react-icons/fa';
import {
  submitExternalQuotation,
  fetchExternalAsset,
} from '../api/externalSupplierApi';
import type {
  ExternalRFQDetailResponse,
  ExternalSubmitQuotationPayload,
  ExternalSubmitQuotationResponse,
} from '../dto/externalSupplierDto';
// Additional Questions from Buyer: disabled for now. Uncomment every block marked [buyer-questions] to bring it back.
// [buyer-questions] import type { RFQQuestion } from '../dto/supplierDto';
import ExternalSupplierChat from '../components/ExternalSupplierChat/ExternalSupplierChat';
import { useQuotationExcelSync, EMPTY_LINE_ITEM, type QuoteLineItem } from '../hooks/useQuotationExcelSync';
import { useBulkApply } from '../hooks/useBulkApply';
import { useExternalRfqLoader, LOAD_ERROR_TITLES, type LoadErrorKind } from '../hooks/useExternalRfqLoader';
import SilaLogo from '../assets/SILA_Logo.png';
import '../components/SupplierDashboard.css';
import '../components/SupplierRfqQuotationSummary.css';
import './ExternalSupplierBid.css';

// Same inline icons as the supplier dashboard's RFQ detail view, so both screens look identical.
const IconFile = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
    <path d="M8 13h8M8 17h8M8 9h2" />
  </svg>
);

const IconEye = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const IconDownload = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconAlertCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

const IconClose = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const formatDateTime = (value?: string | null) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
    : '—';

const TYPE_OPTIONS = [
  { name: 'Percentage', value: 'PERCENTAGE' },
  { name: 'Amount', value: 'AMOUNT' },
];

const getTypeOption = (type: string) => TYPE_OPTIONS.find((option) => option.value === type) ?? null;

const validId = (id?: string | null): string | null =>
  id && id !== '00000000-0000-0000-0000-000000000000' ? id : null;

/* [buyer-questions]
interface QuestionAnswerState {
  answer: string;
  questionOptionId: string | null;
  questionOptionIds: string[];
  fileName?: string;
}
*/

/* [buyer-questions]
const isQuestionAnswered = (q: RFQQuestion, a?: QuestionAnswerState) => {
  if (!a) return false;
  if (q.questionType === 'Text') return !!a.answer?.trim();
  if (q.questionType === 'Radio') return !!a.questionOptionId;
  if (q.questionType === 'FILE' || q.questionType === 'File') return !!a.fileName;
  return (a.questionOptionIds?.length ?? 0) > 0;
};
*/

const ExternalSupplierBid: React.FC = () => {
  const { rfqId, sessionToken } = useParams<{ rfqId: string; sessionToken: string }>();
  const navigate = useNavigate();

  const {
    loading,
    loadErrorKind,
    loadErrorMessage,
    rfq,
    totalPrice,
    setTotalPrice,
    deliveryCharge,
    setDeliveryCharge,
    deliveryType,
    setDeliveryType,
    discount,
    setDiscount,
    discountType,
    setDiscountType,
    tax,
    setTax,
    taxType,
    setTaxType,
    itemPrices,
    lineItems,
    setLineItems,
    quotationId,
    hasExistingQuote,
    notYetOpen,
    frozen,
    canSubmit,
    currency,
    fmtCurrency,
  } = useExternalRfqLoader(rfqId, sessionToken);

  // [buyer-questions] const [answers, setAnswers] = useState<{ [questionId: string]: QuestionAnswerState }>({});

  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // const [submitSuccess, setSubmitSuccess] = useState(false);

  const [isChatOpen, setIsChatOpen] = useState(false);

  // Both chat identity values come from the route's sessionId alone (the
  // second /external-supplier/bid/{rfqId}/{sessionId} segment, captured above
  // as `sessionToken`) — invitedUsers isn't a reliable source of supplierId
  // for an external contact and must not be used here.
  const canChat = !!(rfqId && sessionToken);

  const handleLineItemFieldChange = (
    supplierRFQItemId: string,
    field: keyof QuoteLineItem,
    value: string
  ) => {
    setLineItems((prev) => {
      const existing = prev[supplierRFQItemId] || EMPTY_LINE_ITEM;
      const isNumericField =
        field === 'deliveryCharge' || field === 'discount' || field === 'tax' || field === 'quotedPrice';
      return {
        ...prev,
        [supplierRFQItemId]: {
          ...existing,
          [field]: isNumericField ? Number(value) || 0 : value,
        },
      };
    });
  };

  const handleLineItemAvailabilityChange = (supplierRFQItemId: string, checked: boolean) => {
    setLineItems((prev) => {
      const existing = prev[supplierRFQItemId] || EMPTY_LINE_ITEM;
      return {
        ...prev,
        [supplierRFQItemId]: {
          ...existing,
          isLineitemAvailable: checked,
        },
      };
    });
  };

  const {
    bulkValue,
    setBulkValue,
    bulkValueType,
    setBulkValueType,
    bulkFields,
    handleBulkFieldToggle,
    handleBulkApply,
  } = useBulkApply({
    items: rfq?.items,
    onFieldChange: handleLineItemFieldChange,
  });

  const {
    excelFileInputRef,
    handleDownloadQuotationExcel,
    handleQuotationExcelFileChange,
  } = useQuotationExcelSync({
    items: rfq?.items,
    lineItems,
    setLineItems,
    fileNameId: rfqId,
    fullMatchSuccessMessage: 'Spreadsheet values applied. Review the table below, then submit your quotation.',
  });

  /* [buyer-questions]
  const handleTextAnswerChange = (questionId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], answer: value } }));
  };

  const handleRadioAnswerChange = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: { ...prev[questionId], questionOptionId: optionId, questionOptionIds: [optionId] },
    }));
  };

  const handleCheckboxAnswerChange = (questionId: string, optionId: string, checked: boolean) => {
    setAnswers((prev) => {
      const current = prev[questionId]?.questionOptionIds || [];
      const updated = checked ? [...current, optionId] : current.filter((id) => id !== optionId);
      return { ...prev, [questionId]: { ...prev[questionId], questionOptionIds: updated } };
    });
  };

  const handleFileAnswerChange = (questionId: string, file: File | null) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], fileName: file?.name || '' } }));
  };
  */

  const handleDocumentAction = async (doc: { id?: string; fileName?: string; fileType?: string }, action: 'preview' | 'download') => {
    const assetId = doc.id;
    if (!assetId || !rfqId || !sessionToken) {
      alert('Document asset ID is missing.');
      return;
    }

    try {
      const data = await fetchExternalAsset(assetId, rfqId, sessionToken);
      if (isErrorResponse(data)) {
        throw new Error(data.message || 'Failed to fetch document.');
      }

      const fileBytes = data.fileBytes;
      const fileName = data.fileName || doc.fileName || 'document';
      const rawType = (data.contentType || doc.fileType || 'pdf').toLowerCase();

      if (!fileBytes) {
        throw new Error('Document content not available.');
      }

      let mimeType = 'application/pdf';
      if (rawType.includes('pdf')) mimeType = 'application/pdf';
      else if (rawType.includes('png')) mimeType = 'image/png';
      else if (rawType.includes('jpg') || rawType.includes('jpeg')) mimeType = 'image/jpeg';
      else if (rawType.includes('txt')) mimeType = 'text/plain';
      else if (rawType.includes('doc')) mimeType = 'application/msword';

      const cleanBase64 = fileBytes.replace(/^data:.*?;base64,/, '');
      const byteCharacters = atob(cleanBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const url = URL.createObjectURL(blob);

      if (action === 'preview') {
        window.open(url, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (err: any) {
      alert(err?.message || 'Could not access document.');
    }
  };

  /* [buyer-questions]
  const findUnansweredRequiredQuestion = () =>
    (rfq?.questions || []).find((q) => q.isRequired && !isQuestionAnswered(q, answers[q.questionId]));
  */

  const handleSubmitClick = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!canSubmit) {
      setSubmitError(
        notYetOpen
          ? "This RFQ hasn't opened for bidding yet."
          : frozen
            ? "The buyer has frozen this RFQ's bid. You can no longer submit a quotation."
            : "This RFQ's submission window has closed. You can no longer submit a quotation."
      );
      return;
    }

    /* [buyer-questions]
    const unanswered = findUnansweredRequiredQuestion();
    if (unanswered) {
      setSubmitError(`Please answer the required question: "${unanswered.question}"`);
      return;
    }
    */

    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    if (!rfq || !rfqId || !sessionToken || submitting) return;

    setShowConfirm(false);
    setSubmitting(true);
    setSubmitError(null);
    // setSubmitSuccess(false);

    try {
      const supplierRFQId = rfq.items?.[0]?.supplierRFQId || null;

      const payload: ExternalSubmitQuotationPayload = {
        supplierQuotationId: quotationId,
        supplierRFQId,
        totalPrice: Number(totalPrice),
        deliveryCharge: Number(deliveryCharge),
        deliveryType,
        discount: Number(discount),
        discountType,
        tax: Number(tax),
        taxType,
        temporaryVerificationToken: null,
        items: rfq.addLotOption
          ? rfq.items.map((item, idx) => {
            const key = item.id || item.buyerRFQItemId || `item-${idx}`;
            const existingItemQuote = rfq.supplierQuotationItems?.[idx];
            return {
              supplierRFQItemId:
                validId(item.supplierRFQItemId) ||
                validId(existingItemQuote?.supplierRFQItemId) ||
                null,
              buyerRFQItemId: item.id || item.buyerRFQItemId || '',
              quotedPrice: Number(itemPrices[key] ?? 0),
            };
          })
          : rfq.items.map((item) => {
            const itemKey = item.supplierRFQItemId;
            const line = itemKey ? lineItems[itemKey] : undefined;
            return {
              supplierRFQItemId: itemKey || null,
              buyerRFQItemId: item.id || item.buyerRFQItemId || '',
              quotedPrice: Number(line?.quotedPrice ?? 0),
              deliveryCharge: Number(line?.deliveryCharge ?? 0),
              deliveryType: line?.deliveryType || 'PERCENTAGE',
              discount: Number(line?.discount ?? 0),
              discountType: line?.discountType || 'PERCENTAGE',
              tax: Number(line?.tax ?? 0),
              taxType: line?.taxType || 'PERCENTAGE',
              isLineitemAvailable: Boolean(line?.isLineitemAvailable),
            };
          }),
      };

      const result = await submitExternalQuotation(rfqId, sessionToken, payload);

      if (isErrorResponse(result)) {
        const errorMessage = result.description || result.message || 'Failed to submit quotation. Please try again.';
        setSubmitError(errorMessage);
        toastService.error(errorMessage);
        return;
      }

      const successResult: ExternalSubmitQuotationResponse = result;
      toastService.success(successResult.description || successResult.message || 'Quotation submitted successfully.');
      // setSubmitSuccess(true);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to submit quotation. Please try again.';
      setSubmitError(errorMessage);
      toastService.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  let content: React.ReactNode;

  if (loading) {
    content = <Loader message="Loading RFQ details…" theme="light" color="#2f6feb" />;
  } else if (loadErrorKind) {
    const fallbackBody: Record<LoadErrorKind, string> = {
      'invalid-link': 'Please check the link you were sent, or contact the buyer for a new one.',
      forbidden: 'This link does not grant access to this RFQ. Please contact the buyer.',
      'not-found': "We couldn't find this RFQ. It may have been removed or the link is incorrect.",
      generic: 'Please try again in a few minutes. If this keeps happening, contact the buyer.',
    };

    content = (
      <div className="ebid-status-card ebid-status-error">
        <FaExclamationCircle className="ebid-status-icon ebid-status-icon-error" />
        <h1>{LOAD_ERROR_TITLES[loadErrorKind]}</h1>
        <p>{loadErrorMessage || fallbackBody[loadErrorKind]}</p>
      </div>
    );
  }
 else if (rfq && rfq.status !== 'Open') {
    content = (
      <div className="ebid-status-card ebid-status-success">
        <FaCheckCircle className="ebid-status-icon ebid-status-icon-success" />
        <h1>Quotation Submitted Successfully</h1>
        <p>Your quotation for <strong>{rfq?.title}</strong> has been {(rfq?.status === "Freezing" || rfq?.status === "Frozen") ? "Frozen" : (rfq?.status === "AWARDED") ? "Awarded" : "Successful"}. You can close this page now.</p>
        <div className="ebid-register-prompt">
          <p>Want to continue using the platform? Register now to create your account and access more features.</p>
          <button type="button" className="ebid-submit-btn ebid-btn-with-icon" onClick={() => navigate('/')}>
            <FaUserPlus /> Register
          </button>
        </div>
      </div>
    );
  }
  else if (rfq) {
    const formatRank = (val: unknown): string => {
      if (val === null || val === undefined || val === '') return '';
      return String(val);
    };

    const quotationStatus = rfq.supplierQuotation?.[0]?.status;
    const headerRank = formatRank(rfq.supplierQuotation?.[0]?.rank);
    const showRankColumn = !rfq.addLotOption;

    /* [buyer-questions]
    const sortedQuestions = [...(rfq.questions || [])].sort((a, b) => a.displayOrder - b.displayOrder);
    const answeredCount = sortedQuestions.filter((q) => isQuestionAnswered(q, answers[q.questionId])).length;
    */

    const windowMessage = notYetOpen
      ? "This RFQ hasn't opened for bidding yet — check back after the start date."
      : frozen
        ? "The buyer has frozen this RFQ's bid. You can no longer submit a quotation."
        : "This RFQ's submission window has closed. You can no longer submit a quotation.";

    // Enter inside the dropdown's search box would otherwise submit the surrounding form.
    const renderTypeDropdown = (value: string, onChange: (next: string) => void, className: string) => (
      <div
        className={className}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.preventDefault();
        }}
      >
        <Dropdown
          options={TYPE_OPTIONS}
          value={getTypeOption(value)}
          onChange={(next) => {
            if (next) onChange(next.value);
          }}
        />
      </div>
    );

    const renderDocumentGroup = (
      docs: ExternalRFQDetailResponse['technicalSpecificationDocuments'],
      title: string,
      typeLabel: string,
      tone: 'primary' | 'neutral'
    ) => (
      <div className="sqs-doc-group">
        <h3 className="sqs-doc-group-title">{title}</h3>
        <ul className="sila-file-list sqs-doc-list">
          {docs.map((doc) => (
            <li key={doc.id} className="sila-file">
              <span className={`sila-file-icon${tone === 'neutral' ? ' sqs-file-icon--neutral' : ''}`} aria-hidden="true">
                <IconFile />
              </span>
              <div className="sqs-doc-text">
                <div className="sila-file-name" title={doc.fileName}>{doc.fileName}</div>
                <div className="sila-file-meta">{typeLabel} · {doc.fileType?.toUpperCase()}</div>
              </div>
              <div className="sqs-doc-actions">
                <button
                  type="button"
                  className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                  title="Preview document"
                  aria-label={`Preview ${doc.fileName}`}
                  onClick={() => handleDocumentAction(doc, 'preview')}
                >
                  <IconEye />
                </button>
                <button
                  type="button"
                  className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                  title="Download document"
                  aria-label={`Download ${doc.fileName}`}
                  onClick={() => handleDocumentAction(doc, 'download')}
                >
                  <IconDownload />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    );

    const renderMaterialInfo = (item: ExternalRFQDetailResponse['items'][number]) => (
      <>
        <div className="sila-cell-strong">{item.description}</div>
        {item.costCenter && <div className="sqs-uom">Cost Center: {item.costCenterName}</div>}
        {item.attachments?.map((att) => (
          <div key={att.id} className="sqs-uom">Attachment: {att.fileName}</div>
        ))}
      </>
    );
    const isBidFrozen = rfq?.status === "Freezing" || rfq?.status === "Frozen";
    const isRfqAwarded = rfq?.status === "AWARDED";

    content = (
      <div className="sqs-page">
        <PageHeader
          className="sqs-header"
          title="RFQ Specification"
          description="Request supplier quotations and manage your procurement requirements."
          actions={
            canChat ? (
              <div className="sqs-header-actions">

                <StatusBadge
                  status={isRfqAwarded ? "Awarded" : isBidFrozen ? "Frozen" : "Active"}
                  label={isRfqAwarded ? "RFQ Awarded" : isBidFrozen ? "Bid Frozen" : "Bidding Active"}
                  dot
                  className={`bca-status-badge ${isRfqAwarded ? "bca-status-awarded" : isBidFrozen ? "bca-status-frozen" : "bca-status-active"}`}
                />
                <Button
                  variant="primary"
                  type="button"
                  className="pud-btn pud-btn-outline pud-btn-chat"
                  onClick={() => setIsChatOpen(true)}
                  title="Chat with the buyer"
                >
                  <IconMessageSquare /> Chat
                </Button>
              </div>
            ) : undefined
          }
        />

        <form onSubmit={handleSubmitClick} className="sqs-form">
          <div className="sqs-body">
            {!canSubmit && (
              <div className="sila-alert sila-alert--warning sqs-window-alert" role="status">
                <span className="sqs-alert-icon" aria-hidden="true"><IconAlertCircle /></span>
                <span>{windowMessage}</span>
              </div>
            )}

            {hasExistingQuote && (
              <div className="sila-alert sqs-alert" role="status">
                <span>You already have a submitted quotation on file for this RFQ. Submitting again will update it.</span>
              </div>
            )}

            <section className="sila-card">
              <div className="sila-card-header">
                <h2 className="sila-card-title">RFQ Details</h2>
              </div>
              <div className="sila-card-body">
                <dl className="sila-meta-grid sqs-details-grid">
                  <div className="sila-meta-item sqs-details-wide">
                    <dt className="sila-meta-label">RFQ title</dt>
                    <dd className="sila-meta-value">{rfq.title || '—'}</dd>
                  </div>
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Start date &amp; time (UTC)</dt>
                    <dd className="sila-meta-value sqs-tabular">{formatDateTime(rfq.startDate)}</dd>
                  </div>
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Close date &amp; time (UTC)</dt>
                    <dd className="sila-meta-value sqs-tabular">{formatDateTime(rfq.endDate)}</dd>
                  </div>
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Delivery location</dt>
                    <dd className="sila-meta-value">{rfq.deliveryLocation || '—'}</dd>
                  </div>
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Lot</dt>
                    <dd className="sila-meta-value">
                      {rfq.addLotOption ? (
                        <StatusBadge status="Allowed" tone="success" label="Allowed" />
                      ) : (
                        <StatusBadge status="Not allowed" tone="neutral" label="Not Allowed" />
                      )}
                    </dd>
                  </div>
                  <div className="sila-meta-item">
                    <dt className="sila-meta-label">Sourcing items</dt>
                    <dd className="sila-meta-value sqs-tabular">{rfq.items?.length || 0}</dd>
                  </div>
                  <div className="sila-meta-item sqs-details-full">
                    <dt className="sila-meta-label">Description</dt>
                    <dd className="sila-meta-value sqs-description">{rfq.description || '—'}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <section className="sila-card quotation-summary-table">
              <div className="sila-card-header">
                <div>
                  <h2 className="sila-card-title">Quotation Summary</h2>
                  <p className="sila-card-subtitle quotation-summary-subtitle">
                    Review item pricing and enter applicable delivery charges, discounts, taxes, and quoted amounts.
                  </p>
                </div>
                {rfq.addLotOption && quotationStatus === 'SUBMITTED' && headerRank !== '' && (
                  <StatusBadge status="Rank" tone="info" label={<>Rank: {headerRank}</>} />
                )}
              </div>

              {!rfq.addLotOption && (
                <div className="sqs-excel-apply" role="group" aria-labelledby="sqs-excel-apply-title">
                  <div className="sqs-excel-apply-head">
                    <div className="sqs-excel-apply-title" id="sqs-excel-apply-title">Excel Apply</div>
                    <p className="sqs-excel-apply-subtitle">
                      Download this table as a spreadsheet, edit the values offline, then upload it to apply your changes.
                    </p>
                  </div>

                  <div className="sqs-excel-apply-controls">
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={handleDownloadQuotationExcel}
                      title="Download this table as an Excel-compatible spreadsheet"
                    >
                      <IconDownload /> Download Excel
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      onClick={() => excelFileInputRef.current?.click()}
                      title="Upload a filled-in spreadsheet to bulk-update these fields"
                    >
                      <IconFile /> Upload Excel
                    </Button>
                    <input
                      ref={excelFileInputRef}
                      type="file"
                      accept=".csv"
                      className="sqs-excel-file-input"
                      onChange={handleQuotationExcelFileChange}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                  </div>
                </div>
              )}

              {!rfq.addLotOption && (
                <div className="sqs-bulk" role="group" aria-labelledby="sqs-bulk-title">
                  <div className="sqs-bulk-head">
                    <div className="sqs-bulk-title" id="sqs-bulk-title">Bulk Apply</div>
                    <p className="sqs-bulk-subtitle">
                      Enter a value, then toggle the columns you want it applied to.
                    </p>
                  </div>

                  <div className="sqs-bulk-controls">
                    <input
                      id="sqs-bulk-value-input"
                      className="sila-input sqs-bulk-input"
                      min={0}
                      type="number"
                      value={bulkValue}
                      onChange={(e) => setBulkValue(e.target.value)}
                      placeholder="Enter value"
                      aria-label="Bulk value"
                    />

                    <div className="sqs-segmented" role="group" aria-label="Bulk value type">
                      <button
                        type="button"
                        className={bulkValueType === 'PERCENTAGE' ? 'active' : ''}
                        aria-pressed={bulkValueType === 'PERCENTAGE'}
                        onClick={() => setBulkValueType('PERCENTAGE')}
                      >
                        Percentage
                      </button>
                      <button
                        type="button"
                        className={bulkValueType === 'AMOUNT' ? 'active' : ''}
                        aria-pressed={bulkValueType === 'AMOUNT'}
                        onClick={() => setBulkValueType('AMOUNT')}
                      >
                        Amount
                      </button>
                    </div>

                    <div className="sqs-bulk-fields">
                      {([
                        ['deliveryCharge', 'Delivery Charge'],
                        ['discount', 'Discount'],
                        ['tax', 'Tax'],
                        ['quotedPrice', 'Quoted Price'],
                      ] as [keyof typeof bulkFields, string][]).map(([field, label]) => (
                        <label className="pud-bulk-toggle" key={field}>
                          <span className="pud-switch">
                            <input
                              type="checkbox"
                              checked={bulkFields[field]}
                              onChange={(e) => handleBulkFieldToggle(field, e.target.checked)}
                            />
                            <span className="pud-slider" aria-hidden="true"></span>
                          </span>
                          <span>{label}</span>
                        </label>
                      ))}
                    </div>

                    <Button
                      variant="secondary"
                      size="sm"
                      type="button"
                      className="sqs-bulk-apply"
                      onClick={handleBulkApply}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}

              {rfq.addLotOption ? (
                <>
                  <div className="sila-table-wrap">
                    <table className="sila-table sqs-items-table">
                      <thead>
                        <tr>
                          <th scope="col">Material Info</th>
                          <th scope="col">Code</th>
                          <th scope="col" className="sila-num">Qty Required</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfq.items?.map((item, idx) => (
                          <tr key={item.id || item.buyerRFQItemId || `item-${idx}`}>
                            <td className="sqs-material">{renderMaterialInfo(item)}</td>
                            <td><span className="sila-ref">{item.materialCode || 'N/A'}</span></td>
                            <td className="sila-num">
                              <span className="sila-cell-strong">{item.quantity}</span>{' '}
                              <span className="sqs-uom">{item.uom}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="sqs-pricing">
                    <div className="sqs-pricing-head">
                      <h3 className="sqs-subsection-title">Pricing</h3>
                    </div>

                    <div className="sila-form-grid sqs-pricing-grid">
                      <div className="sila-field">
                        <label className="sila-label" htmlFor="sqs-lot-delivery-charge">Delivery Charge</label>
                        <input
                          id="sqs-lot-delivery-charge"
                          type="number"
                          step="0.01"
                          min="0"
                          className="sila-input sqs-num-input pud-rfq-form-input"
                          value={deliveryCharge || ''}
                          onChange={(e) => setDeliveryCharge(Number(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="sila-field">
                        <span className="sila-label">Delivery Type</span>
                        {renderTypeDropdown(deliveryType, setDeliveryType, 'ebid-field-dropdown')}
                      </div>

                      <div className="sila-field">
                        <label className="sila-label" htmlFor="sqs-lot-discount">Discount</label>
                        <input
                          id="sqs-lot-discount"
                          type="number"
                          step="0.01"
                          min="0"
                          className="sila-input sqs-num-input pud-rfq-form-input"
                          value={discount || ''}
                          onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="sila-field">
                        <span className="sila-label">Discount Type</span>
                        {renderTypeDropdown(discountType, setDiscountType, 'ebid-field-dropdown')}
                      </div>

                      <div className="sila-field">
                        <label className="sila-label" htmlFor="sqs-lot-tax">Tax</label>
                        <input
                          id="sqs-lot-tax"
                          type="number"
                          step="0.01"
                          min="0"
                          className="sila-input sqs-num-input pud-rfq-form-input"
                          value={tax || ''}
                          onChange={(e) => setTax(Number(e.target.value) || 0)}
                          placeholder="0.00"
                        />
                      </div>

                      <div className="sila-field">
                        <span className="sila-label">Tax Type</span>
                        {renderTypeDropdown(taxType, setTaxType, 'ebid-field-dropdown')}
                      </div>
                    </div>

                    <div className="sqs-total">
                      <label className="sqs-total-label" htmlFor="sqs-lot-total">
                        Total Price Quote{currency ? ` (${currency})` : ''}<span className="sila-required" aria-hidden="true">*</span>
                      </label>
                      <input
                        id="sqs-lot-total"
                        type="number"
                        step="0.01"
                        className="sila-input sqs-num-input sqs-total-input pud-rfq-form-input"
                        value={totalPrice}
                        onChange={(e) => setTotalPrice(Number(e.target.value) || 0)}
                        placeholder="0.00"
                        required
                      />
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="sila-table-wrap">
                    <table className="sila-table sqs-items-table sqs-line-table">
                      <thead>
                        <tr>
                          <th scope="col">Material Info</th>
                          <th scope="col">Code</th>
                          <th scope="col" className="sila-num">Qty</th>
                          <th scope="col">Delivery Charge</th>
                          <th scope="col">Delivery Charge Type</th>
                          <th scope="col">Discount</th>
                          <th scope="col">Discount Type</th>
                          <th scope="col">Tax</th>
                          <th scope="col">Tax Type</th>
                          <th scope="col">
                            Quoted Price<span className="sila-required" aria-hidden="true">*</span>
                          </th>
                          <th scope="col" className="sqs-availability-cell">Available</th>
                          {showRankColumn && <th scope="col" className="sila-num">Rank</th>}
                          <th scope="col" className="sila-num">Sub Total{currency ? ` (${currency})` : ''}</th>
                          <th scope="col" className="sila-num">Quoted Amount{currency ? ` (${currency})` : ''}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rfq.items?.map((item, idx) => {
                          const itemKey = item.supplierRFQItemId || `item-${idx}`;
                          const line = lineItems[itemKey] || EMPTY_LINE_ITEM;
                          const matchedItem =
                            rfq.supplierQuotationItems?.find(
                              (qi) =>
                                (item.buyerRFQItemId && qi.buyerRFQItemId === item.buyerRFQItemId) ||
                                (item.supplierRFQItemId && qi.supplierRFQItemId === item.supplierRFQItemId)
                            ) || rfq.supplierQuotationItems?.[idx];
                          const itemRank = formatRank(matchedItem?.rank) || '--';
                          const itemLabel = item.description || `item ${idx + 1}`;

                          return (
                            <tr key={itemKey}>
                              <td className="sqs-material">{renderMaterialInfo(item)}</td>
                              <td><span className="sila-ref">{item.materialCode || 'N/A'}</span></td>
                              <td className="sila-num">
                                <span className="sila-cell-strong">{item.quantity}</span>{' '}
                                <span className="sqs-uom">{item.uom}</span>
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-cell-input sqs-num-input pud-rfq-item-input"
                                  value={line.deliveryCharge || ''}
                                  onChange={(e) => handleLineItemFieldChange(itemKey, 'deliveryCharge', e.target.value)}
                                  placeholder="0.00"
                                  aria-label={`Delivery charge for ${itemLabel}`}
                                />
                              </td>
                              <td>
                                {renderTypeDropdown(
                                  line.deliveryType,
                                  (next) => handleLineItemFieldChange(itemKey, 'deliveryType', next),
                                  'ebid-cell-dropdown'
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-cell-input sqs-num-input pud-rfq-item-input"
                                  value={line.discount || ''}
                                  onChange={(e) => handleLineItemFieldChange(itemKey, 'discount', e.target.value)}
                                  placeholder="0.00"
                                  aria-label={`Discount for ${itemLabel}`}
                                />
                              </td>
                              <td>
                                {renderTypeDropdown(
                                  line.discountType,
                                  (next) => handleLineItemFieldChange(itemKey, 'discountType', next),
                                  'ebid-cell-dropdown'
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-cell-input sqs-num-input pud-rfq-item-input"
                                  value={line.tax || ''}
                                  onChange={(e) => handleLineItemFieldChange(itemKey, 'tax', e.target.value)}
                                  placeholder="0.00"
                                  aria-label={`Tax for ${itemLabel}`}
                                />
                              </td>
                              <td>
                                {renderTypeDropdown(
                                  line.taxType,
                                  (next) => handleLineItemFieldChange(itemKey, 'taxType', next),
                                  'ebid-cell-dropdown'
                                )}
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  className="sila-input sqs-cell-input sqs-num-input sqs-price-input pud-rfq-item-input"
                                  value={line.quotedPrice || ''}
                                  onChange={(e) => handleLineItemFieldChange(itemKey, 'quotedPrice', e.target.value)}
                                  placeholder="0.00"
                                  aria-label={`Quoted price for ${itemLabel}`}
                                  required
                                />
                              </td>
                              <td className="sqs-availability-cell">
                                <input
                                  type="checkbox"
                                  className="sqs-availability-checkbox ebid-availability-checkbox"
                                  checked={!line.isLineitemAvailable}
                                  onChange={(e) => handleLineItemAvailabilityChange(itemKey, !e.target.checked)}
                                  aria-label={`Mark ${itemLabel} as available`}
                                />
                              </td>
                              {showRankColumn && (
                                <td className="sila-num sila-cell-strong">
                                  {quotationStatus === 'SUBMITTED' ? itemRank : '-'}
                                </td>
                              )}
                              <td className="sila-num">{fmtCurrency(line.subTotal)}</td>
                              <td className="sila-num sila-cell-strong">{fmtCurrency(line.quotedAmount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="sqs-total sqs-total--readonly">
                    <span className="sqs-total-label">Total Price Quote</span>
                    <span className="sqs-total-value">{fmtCurrency(Number(totalPrice))}</span>
                  </div>
                </>
              )}
            </section>

            {((rfq.technicalSpecificationDocuments?.length ?? 0) > 0 ||
              (rfq.termsConditionDocuments?.length ?? 0) > 0) && (
                <section className="sila-card">
                  <div className="sila-card-header">
                    <div>
                      <h2 className="sila-card-title">Reference Documents</h2>
                      <p className="sila-card-subtitle">
                        Technical specifications, requirements, and Terms &amp; Conditions
                        documents attached to this RFQ.
                      </p>
                    </div>
                  </div>
                  <div className="sila-card-body sqs-docs-body">
                    {rfq.technicalSpecificationDocuments?.length > 0 &&
                      renderDocumentGroup(rfq.technicalSpecificationDocuments, 'Technical Requirements', 'Tech Spec', 'primary')}

                    {rfq.termsConditionDocuments?.length > 0 &&
                      renderDocumentGroup(rfq.termsConditionDocuments, 'Terms & Conditions', 'Terms & Conditions', 'neutral')}
                  </div>
                </section>
              )}

            {/* [buyer-questions]
            {sortedQuestions.length > 0 && (
              <section className="sila-card">
                <div className="sila-card-header">
                  <h2 className="sila-card-title sqs-title-with-icon">
                    <IconMessageSquare /> Additional Questions from Buyer
                  </h2>
                  <StatusBadge
                    status="Answered"
                    tone={answeredCount === sortedQuestions.length ? 'success' : 'neutral'}
                    label={`${answeredCount}/${sortedQuestions.length} answered`}
                  />
                </div>

                <div className="sila-card-body sqs-questions">
                  {sortedQuestions.map((q, index) => {
                    const current = answers[q.questionId];
                    const inputId = `sqs-question-${q.questionId}`;
                    const isFile = q.questionType === 'FILE' || q.questionType === 'File';
                    const isChoice = q.questionType !== 'Text' && !isFile;
                    const sortedOptions = [...(q.options || [])].sort((a, b) => a.displayOrder - b.displayOrder);
                    const questionLabel = (
                      <>
                        <span className="sqs-question-index">Q{index + 1}.</span> {q.question}
                        {q.isRequired && <span className="sila-required" aria-hidden="true">*</span>}
                      </>
                    );

                    return (
                      <div key={q.questionId} className="sqs-question">
                        {isChoice ? (
                          <div className="sqs-question-label" id={`${inputId}-label`}>{questionLabel}</div>
                        ) : (
                          <label className="sqs-question-label" htmlFor={inputId}>{questionLabel}</label>
                        )}

                        {q.questionType === 'Text' && (
                          <input
                            id={inputId}
                            type="text"
                            className="sila-input pud-rfq-item-input"
                            value={current?.answer || ''}
                            onChange={(e) => handleTextAnswerChange(q.questionId, e.target.value)}
                            placeholder="Type your answer..."
                          />
                        )}

                        {q.questionType === 'Radio' && (
                          <div className="sqs-options" role="radiogroup" aria-labelledby={`${inputId}-label`}>
                            {sortedOptions.map((opt) => (
                              <label key={opt.optionId} className="sqs-option">
                                <input
                                  type="radio"
                                  name={`ebid-question-${q.questionId}`}
                                  checked={current?.questionOptionId === opt.optionId}
                                  onChange={() => handleRadioAnswerChange(q.questionId, opt.optionId)}
                                />
                                {opt.optionText}
                              </label>
                            ))}
                          </div>
                        )}

                        {isFile && (
                          <input
                            id={inputId}
                            type="file"
                            className="sila-input sqs-file-input pud-rfq-item-input"
                            onChange={(e) => handleFileAnswerChange(q.questionId, e.target.files?.[0] || null)}
                          />
                        )}

                        {q.questionType !== 'Text' && q.questionType !== 'Radio' && !isFile && sortedOptions.length > 0 && (
                          <div className="sqs-options" role="group" aria-labelledby={`${inputId}-label`}>
                            {sortedOptions.map((opt) => (
                              <label key={opt.optionId} className="sqs-option">
                                <input
                                  type="checkbox"
                                  checked={current?.questionOptionIds?.includes(opt.optionId) || false}
                                  onChange={(e) =>
                                    handleCheckboxAnswerChange(q.questionId, opt.optionId, e.target.checked)
                                  }
                                />
                                {opt.optionText}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
            */}

            {submitError && (
              <div className="sila-alert sila-alert--danger sqs-alert" role="alert">
                <span className="sqs-alert-icon sqs-alert-icon--danger" aria-hidden="true"><IconAlertCircle /></span>
                <span>{submitError}</span>
              </div>
            )}
          </div>

          {/* Sticky action bar */}
          <div className="sqs-footer">
            <div className="sqs-footer-status">
              {!canSubmit && (
                <StatusBadge
                  status={frozen ? 'Frozen' : notYetOpen ? 'Pending' : 'Closed'}
                  label={notYetOpen ? 'Not yet open' : frozen ? 'Bid frozen' : 'Submission closed'}
                  dot
                />
              )}
            </div>
            

              <div className="sqs-footer-actions">
                <button
                  type="submit"
                  className="sila-btn sila-btn--primary"
                  disabled={submitting || !canSubmit}
                  aria-busy={submitting || undefined}
                >
                  {submitting && <span className="sila-spinner" aria-hidden="true" />}
                  {submitting ? 'Submitting...' : 'Submit Quotation'}
                </button>
              </div>
          
          </div>
        </form>
      </div>
    );
  }

  const isStatusView = loading || !!loadErrorKind || (!!rfq && rfq.status !== 'Open');

  return (
    <div className="ebid-page">
      <ToastContainer />
      <header className="ebid-header">
        <div className="ebid-header-inner">
          <img src={SilaLogo} alt="SILA" className="ebid-header-logo" />
        </div>
      </header>

      <main className={`ebid-main${isStatusView ? ' ebid-main-centered' : ''}`}>
        {content}
      </main>

      {isChatOpen && canChat && (
        <ExternalSupplierChat
          onClose={() => setIsChatOpen(false)}
          rfqId={rfqId!}
          sessionToken={sessionToken!}
          rfqTitle={rfq?.title}
          buyerName={rfq?.buyerName}
          externalSupplierName={rfq?.externalSupplierName}
        />
      )}

      {showConfirm && (
        <div className="sila-overlay sqs-overlay" onClick={() => setShowConfirm(false)}>
          <div
            className="sila-modal sqs-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="sqs-confirm-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sila-modal-header">
              <div className="sqs-modal-heading-group">
                <StatusBadge
                  status="Pending"
                  tone="warning"
                  size="sm"
                  label={<><IconAlertCircle /> Confirmation Required</>}
                />
                <h2 className="sila-modal-title" id="sqs-confirm-title">Submit Quotation?</h2>
              </div>
              <button
                type="button"
                className="sila-btn sila-btn--ghost sila-btn--icon sila-btn--sm"
                onClick={() => setShowConfirm(false)}
                aria-label="Close"
              >
                <IconClose />
              </button>
            </div>

            <div className="sila-modal-body">
              <p className="sila-modal-text">
                Once submitted, your quotation will be sent to the buyer and cannot be easily modified.
              </p>
            </div>

            <div className="sila-modal-footer">
              <button type="button" className="sila-btn sila-btn--secondary" onClick={() => setShowConfirm(false)}>
                Cancel
              </button>
              <button type="button" className="sila-btn sila-btn--primary" onClick={handleConfirmSubmit} disabled={submitting}>
                {submitting ? 'Submitting...' : 'Yes, Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExternalSupplierBid;
