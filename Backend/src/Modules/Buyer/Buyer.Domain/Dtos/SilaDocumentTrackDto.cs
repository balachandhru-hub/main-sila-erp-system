namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Operational document chain for PO / GRN / Invoice: related documents, history, attachments.
    /// </summary>
    public class SilaDocumentTrackDto
    {
        public string RootKind { get; set; } = string.Empty;
        public Guid RootId { get; set; }
        public List<SilaDocumentTrackNodeDto> Nodes { get; set; } = new();
        public List<SilaDocumentTrackEventDto> History { get; set; } = new();
        public List<SilaDocumentTrackAttachmentDto> Attachments { get; set; } = new();
    }

    public class SilaDocumentTrackNodeDto
    {
        /// <summary>PO | GRN | INVOICE | ATTACHMENT | PAYMENT | SOA</summary>
        public string Kind { get; set; } = string.Empty;
        public Guid? Id { get; set; }
        public string Label { get; set; } = string.Empty;
        public string? Number { get; set; }
        public string? Status { get; set; }
        public string? ErpReference { get; set; }
        public bool Current { get; set; }
    }

    public class SilaDocumentTrackEventDto
    {
        public string Action { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public DateTime OccurredOn { get; set; }
        public string? ReferenceType { get; set; }
        public Guid? ReferenceId { get; set; }
    }

    public class SilaDocumentTrackAttachmentDto
    {
        public string DocumentType { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public string? Status { get; set; }
        public Guid? InvoiceId { get; set; }
        public Guid? GoodsReceiptId { get; set; }
        public string? Url { get; set; }
    }
}
