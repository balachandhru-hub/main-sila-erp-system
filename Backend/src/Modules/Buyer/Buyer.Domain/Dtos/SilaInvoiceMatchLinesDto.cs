namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// Invoice lines linked to purchase order lines; a null purchase order line removes the link.
    /// </summary>
    public class SilaInvoiceMatchLinesDto
    {
        public List<SilaInvoiceLineMatchDto> Lines { get; set; } = new();
    }
}
