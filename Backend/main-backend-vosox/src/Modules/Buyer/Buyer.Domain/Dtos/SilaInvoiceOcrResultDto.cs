namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Answer of the python-backend POST /ocr/invoice.
    /// </summary>
    public class SilaInvoiceOcrResultDto
    {
        public string? Text { get; set; }
        public decimal? Confidence { get; set; }
        public SilaInvoiceOcrFieldsDto? Fields { get; set; }
        public List<SilaInvoiceOcrLineDto>? Lines { get; set; }
        public string? Error { get; set; }
        public string? Message { get; set; }

        /// <summary>DIGITAL_TEXT (text layer of a PDF), SCANNED or IMAGE (read with OCR).</summary>
        public string? DocumentType { get; set; }
    }
}
