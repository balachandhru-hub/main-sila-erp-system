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
        public string? ErpMessage { get; set; }

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
}
