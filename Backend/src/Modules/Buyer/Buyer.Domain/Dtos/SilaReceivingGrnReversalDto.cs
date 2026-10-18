namespace Buyer.Domain.Dtos
{
    public class SilaReceivingGrnReversalLineDto
    {
        public Guid GoodsReceiptItemId { get; set; }
        public string? MaterialCode { get; set; }
        public string MaterialName { get; set; } = string.Empty;
        public int PoItem { get; set; }
        public string? MaterialDocumentItem { get; set; }
        public decimal OriginalReceivedQty { get; set; }
        public decimal PreviouslyReversedQty { get; set; }
        public decimal RemainingReversibleQty { get; set; }
        public decimal ReversalQty { get; set; }
        public string? Uom { get; set; }
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
        public Guid? InvoiceId { get; set; }
        public string? InvoiceNumber { get; set; }
        public string? InvoiceStatus { get; set; }
        public string InvoiceGate { get; set; } = "NO_INVOICE";
        public string Decision { get; set; } = string.Empty;
        public bool CanReverse { get; set; }
        public bool InvoiceMustReverseFirst { get; set; }
        /// <summary>SAP Cancel already succeeded; UI must call local-finalization-only (no second Cancel).</summary>
        public bool LocalFinalizationNeeded { get; set; }
        public bool FullDocumentCancelOnly { get; set; } = true;
        public string? Message { get; set; }
        public List<SilaReceivingGrnReversalLineDto> Lines { get; set; } = new();
    }

    public class SilaReceivingGrnReversalWriteDto
    {
        public string Reason { get; set; } = string.Empty;
        public string? Remarks { get; set; }
        /// <summary>When true and invoice is posted, attempt invoice reverse first (requires configured invoice reverse).</summary>
        public bool ReverseInvoiceAndGrn { get; set; }
        /// <summary>When true, complete local inventory only (ERP Cancel already succeeded).</summary>
        public bool LocalFinalizationOnly { get; set; }
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
