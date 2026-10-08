namespace Buyer.Domain.Dtos
{
    /// <summary>One workflow event of the SILA ME audit log.</summary>
    public class SilaAuditEventDto
    {
        public Guid Id { get; set; }
        public string ReferenceType { get; set; } = string.Empty;
        public Guid ReferenceId { get; set; }
        /// <summary>Document number of the reference (count, enquiry, transfer...) when known.</summary>
        public string? ReferenceNumber { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public Guid ActorUserId { get; set; }
        /// <summary>Display name from Identity; null for the system or when Identity is unavailable.</summary>
        public string? ActorName { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
