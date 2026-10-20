namespace Buyer.Domain.Dtos
{
    public class SilaReceivingGrnReversalLineDto
    {
        public Guid GoodsReceiptItemId { get; set; }
        public string? MaterialCode { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public int PoItem { get; set; }
        /// <summary>SAP-formatted PO item (00010).</summary>
        public string? PurchaseOrderItem { get; set; }
        public string? MaterialDocumentItem { get; set; }
        public decimal OriginalReceivedQty { get; set; }
        public decimal PreviouslyReversedQty { get; set; }
        public decimal RemainingReversibleQty { get; set; }
        /// <summary>Default = remaining reversible. Editable on the client; backend revalidates.</summary>
        public decimal ReversalQty { get; set; }
        public string? Uom { get; set; }
        public string? Plant { get; set; }
        public string? StorageLocation { get; set; }
    }

    public class SilaReceivingGrnReversalHistoryDto
    {
        public Guid ErpPostingId { get; set; }
        public string? ReversalNumber { get; set; }
        public DateTime? PostedOn { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? MaterialDocument { get; set; }
        public string? MaterialDocumentYear { get; set; }
        public string? Reason { get; set; }
        public decimal ReversedQuantity { get; set; }
        public string? ErrorMessage { get; set; }
    }

    public class SilaReceivingGrnReversalPreviewDto
    {
        public Guid GoodsReceiptId { get; set; }
        public string GrnNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? MaterialDocument { get; set; }
        public string? MaterialDocumentYear { get; set; }
        public string? ReversalMaterialDocument { get; set; }
        public string? ReversalMaterialDocumentYear { get; set; }
        public string? ReversalStatus { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public string? SupplierName { get; set; }
        public string? CompanyCode { get; set; }
        public string? PropertyName { get; set; }
        public string? Plant { get; set; }
        public string? StorageLocation { get; set; }
        public DateTime? OriginalPostingDate { get; set; }
        public Guid? InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? InvoiceStatus { get; set; }
        public string InvoiceGate { get; set; } = "NO_INVOICE";
        public string Decision { get; set; } = string.Empty;
        public bool CanReverse { get; set; }
        public bool InvoiceMustReverseFirst { get; set; }
        /// <summary>SAP 102 already succeeded; UI must call local-finalization-only (no second SAP call).</summary>
        public bool LocalFinalizationNeeded { get; set; }
        /// <summary>Always false for FIVE S4-GRN REVERSAL quantity posting.</summary>
        public bool FullDocumentCancelOnly { get; set; }
        public string? IntegrationName { get; set; }
        public string? Message { get; set; }
        public List<SilaReceivingGrnReversalLineDto> Lines { get; set; } = new();
        public List<SilaReceivingGrnReversalHistoryDto> History { get; set; } = new();
    }

    public class SilaReceivingGrnReversalLineWriteDto
    {
        public Guid GoodsReceiptItemId { get; set; }
        public decimal ReversalQuantity { get; set; }
    }

    public class SilaReceivingGrnReversalWriteDto
    {
        public string Reason { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        public DateTime? PostingDate { get; set; }
        public DateTime? DocumentDate { get; set; }
        /// <summary>When true and invoice is posted, attempt invoice reverse first (requires configured invoice reverse).</summary>
        public bool ReverseInvoiceAndGrn { get; set; }
        /// <summary>When true, complete local inventory only (ERP 102 already succeeded).</summary>
        public bool LocalFinalizationOnly { get; set; }
        /// <summary>Selected lines with confirmed reversal quantities. Omitted/empty = reverse all remaining.</summary>
        public List<SilaReceivingGrnReversalLineWriteDto>? Lines { get; set; }
    }

    public class SilaReceivingGrnReversalResultDto
    {
        public Guid GoodsReceiptId { get; set; }
        public string GrnNumber { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string? ReversalStatus { get; set; }
        public string? MaterialDocument { get; set; }
        public string? MaterialDocumentYear { get; set; }
        public string? ReversalMaterialDocument { get; set; }
        public string? ReversalMaterialDocumentYear { get; set; }
        public string Message { get; set; } = string.Empty;
    }
}
