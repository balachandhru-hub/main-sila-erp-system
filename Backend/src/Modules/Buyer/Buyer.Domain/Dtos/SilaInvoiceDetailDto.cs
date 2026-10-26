namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// An invoice with its OCR result, lines and the goods receipts posted from it.
    /// </summary>
    public class SilaInvoiceDetailDto
    {
        public Guid Id { get; set; }
        public string? InvoiceNumber { get; set; }
        public Guid? SupplierId { get; set; }
        public string? SupplierName { get; set; }
        public DateTime? InvoiceDate { get; set; }
        public string? Currency { get; set; }
        public decimal? GrossAmount { get; set; }
        public Guid? PurchaseOrderId { get; set; }
        public string? PoNumber { get; set; }
        /// <summary>Every purchase order billed by this invoice. The first is the header purchase order.</summary>
        public List<SilaInvoicePurchaseOrderDto> PurchaseOrders { get; set; } = new();
        public string FileName { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? OcrText { get; set; }

        /// <summary>Why the OCR failed, when the status is OCR_FAILED.</summary>
        public string? OcrMessage { get; set; }
        public decimal? OcrConfidence { get; set; }
        public Guid UploadedBy { get; set; }
        public DateTime UploadedOn { get; set; }
        /// <summary>MATERIAL | SERVICE | MIXED; null when unknown.</summary>
        public string? InvoiceType { get; set; }
        /// <summary>PO or NON_PO. How the invoice was created.</summary>
        public string? CreationType { get; set; }
        public string? CompanyCode { get; set; }
        public Guid? PropertyId { get; set; }
        public decimal? NetAmount { get; set; }
        public decimal? TaxAmount { get; set; }
        public string? SupplierTaxNumber { get; set; }
        /// <summary>False for a SERVICE invoice: no goods receipt can be posted for it.</summary>
        public bool GoodsReceiptApplicable { get; set; } = true;
        public List<SilaInvoiceItemDto> Items { get; set; } = new();
        public List<SilaReceivingGrnListItemDto> GoodsReceipts { get; set; } = new();

        /// <summary>The Supplier Master row the invoice is matched to.</summary>
        public Guid? SilaSupplierId { get; set; }
        public string? SupplierCode { get; set; }

        /// <summary>The ERP posting of the invoice (POST_INVOICE), queued once its goods are received.</summary>
        public Guid? ErpPostingId { get; set; }
        public string? ErpStatus { get; set; }
        public string? ErpReference { get; set; }
        /// <summary>Fiscal year returned by FIVE S4-INVOICE POSTING and stored on that posting.</summary>
        public string? FiscalYear { get; set; }
        public string? ErpMessage { get; set; }
        /// <summary>The S/4 URL attachment of this supplier invoice. Independent of the invoice posting result.</summary>
        public SilaInvoiceAttachmentDto Attachment { get; set; } = new();

        /// <summary>The reading was below the minimum confidence: check every field before saving.</summary>
        public bool NeedsReview { get; set; }
        /// <summary>"Goods receipt not applicable for a service invoice." for a SERVICE invoice.</summary>
        public string? GoodsReceiptNote { get; set; }
        /// <summary>Net + tax does not equal the gross amount within the tolerance (financial reconciliation on).</summary>
        public string? ReconciliationWarning { get; set; }
        /// <summary>SHA-256 of the stored file.</summary>
        public string? ContentHash { get; set; }

        /// <summary>The user can submit this invoice. Posting does not start until they do.</summary>
        public bool CanSubmitInvoice { get; set; }

        public string? PaymentStatus { get; set; }
        /// <summary>NOT CONFIGURED when no payment-status API exists.</summary>
        public string? PaymentIntegration { get; set; }
        public decimal? OutstandingAmount { get; set; }
        public List<SilaInvoiceDocumentDto> Documents { get; set; } = new();
        public List<SilaInvoiceStepDto> Timeline { get; set; } = new();
        /// <summary>PO → GRN → Invoice → Attachment → Payment → SOA.</summary>
        public SilaDocumentTrackDto? DocumentTrack { get; set; }

        public List<SilaCreditMemoListItemDto> CreditMemos { get; set; } = new();

        /// <summary>The stored S/4 posting values. Null until the purchase order has been read for this invoice.</summary>
        public SilaInvoicePostingDataDto? PostingData { get; set; }
    }

    public class SilaInvoicePostingDataDto
    {
        public string? PreparationStatus { get; set; }
        public DateTime? PreparedAt { get; set; }
        public int Version { get; set; }
        public string? PurchaseOrder { get; set; }
        public string? SourceApi { get; set; }
        /// <summary>PO or NON_PO. Selects the Supplier Invoice item navigation.</summary>
        public string? InvoiceMode { get; set; }
        public bool Stale { get; set; }
        public List<SilaInvoicePostingFieldDto> Header { get; set; } = new();
        public List<SilaInvoicePostingLineDto> Lines { get; set; } = new();
    }

    public class SilaInvoicePostingFieldDto
    {
        public string ApiField { get; set; } = string.Empty;
        public string Label { get; set; } = string.Empty;
        public string? Value { get; set; }
        public string Source { get; set; } = string.Empty;
        public string SourceField { get; set; } = string.Empty;
        public bool Required { get; set; }
    }

    public class SilaInvoicePostingLineDto
    {
        public int InvoiceLine { get; set; }
        public string? GrnNumber { get; set; }
        public string? MaterialDocument { get; set; }
        public List<SilaInvoicePostingFieldDto> Fields { get; set; } = new();
    }

    public class SilaInvoiceDocumentDto
    {
        public string DocumentType { get; set; } = string.Empty;
        public string? GrnNumber { get; set; }
        public string? PoNumber { get; set; }
        public DateTime? GeneratedOn { get; set; }
        public string FileName { get; set; } = string.Empty;
        public Guid? GoodsReceiptId { get; set; }
    }

    /// <summary>The URL attachment of a posted S/4 supplier invoice.</summary>
    public class SilaInvoiceAttachmentDto
    {
        public string BusinessObject { get; set; } = "Supplier Invoice";
        public string BusinessObjectType { get; set; } = "BUS2081";
        public string? LinkedSapObjectKey { get; set; }
        public string? FileName { get; set; }
        /// <summary>The external document address prepared for CreateUrlAsAttachment. Shown before that API is called.</summary>
        public string? Url { get; set; }
        public int? HttpStatus { get; set; }
        /// <summary>Not started, Pending, Processing, Success, Failed, or Unknown.</summary>
        public string Status { get; set; } = "Not started";
        public DateTime? LastAttempt { get; set; }
        public string? Message { get; set; }
        public bool CanReprocess { get; set; }
    }

    public class SilaInvoiceStepDto
    {
        public string Step { get; set; } = string.Empty;
        /// <summary>SUCCESS | FAILED | PENDING | NOT_STARTED</summary>
        public string Status { get; set; } = string.Empty;
    }

    public class SilaInvoiceDecisionDto
    {
        public bool Approve { get; set; }
        public string? Comment { get; set; }
    }

    /// <summary>One purchase order billed by an invoice.</summary>
    public class SilaInvoicePurchaseOrderDto
    {
        public Guid Id { get; set; }
        public string PoNumber { get; set; } = string.Empty;
    }

    /// <summary>Goods receipts of the matched purchase order to attach to this invoice. An empty list clears the link.</summary>
    public class SilaInvoiceLinkGrnDto
    {
        public List<Guid> GoodsReceiptIds { get; set; } = new();
    }
}
