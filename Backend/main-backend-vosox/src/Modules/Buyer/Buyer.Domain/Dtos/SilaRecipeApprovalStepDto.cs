namespace Buyer.Domain.Dtos
{
    public class SilaRecipeApprovalStepDto
    {
        public Guid UserId { get; set; }
        public string? Name { get; set; }
        public string? Email { get; set; }
        /// <summary>Role of the approver (Identity role name).</summary>
        public string? RoleName { get; set; }
        public int Version { get; set; }
        public int Order { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Comment { get; set; }
        public DateTime? ActedOn { get; set; }
    }
}
