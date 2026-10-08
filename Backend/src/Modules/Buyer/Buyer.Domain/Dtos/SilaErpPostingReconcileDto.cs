namespace Buyer.Domain.Dtos
{
    /// <summary>
    /// The outcome a user checked in the ERP for a posting whose answer never came (UNKNOWN).
    /// </summary>
    public class SilaErpPostingReconcileDto
    {
        /// <summary>True when the document exists in the ERP; false sends it again.</summary>
        public bool Posted { get; set; }
        /// <summary>The ERP document number, when it was posted.</summary>
        public string? ErpReference { get; set; }
    }
}
