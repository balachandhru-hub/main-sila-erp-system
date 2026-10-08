namespace Buyer.Domain.Dtos
{
    public class SilaAlertDto
    {
        public Guid Id { get; set; }
        public string AlertType { get; set; } = string.Empty;
        public string Severity { get; set; } = string.Empty;
        public string Status { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Message { get; set; } = string.Empty;
        public Guid? LocationId { get; set; }
        public string? LocationName { get; set; }
        public Guid? MaterialId { get; set; }
        public string? MaterialCode { get; set; }
        public string? MaterialName { get; set; }
        public string? ReferenceType { get; set; }
        public Guid? ReferenceId { get; set; }
        public string? RecommendedAction { get; set; }
        public DateTime DateCreated { get; set; }
    }
}
