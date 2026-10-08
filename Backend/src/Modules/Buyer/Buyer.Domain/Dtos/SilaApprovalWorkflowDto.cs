namespace Buyer.Domain.Dtos
{
    /// <summary>An approval flow of one type (e.g. RECIPE) with its scope and levels, for the workflow summary.</summary>
    public class SilaApprovalWorkflowDto
    {
        public Guid Id { get; set; }
        public string? Code { get; set; }
        public string? Name { get; set; }
        /// <summary>ALL | PROPERTY | OUTLET | STORE | COMPANY_CODE (empty = ALL).</summary>
        public string? ScopeKind { get; set; }
        public Guid? ScopeId { get; set; }
        public string? ScopeCode { get; set; }
        public int LevelCount { get; set; }
        public List<SilaApprovalWorkflowLevelDto> Levels { get; set; } = new();
    }

    public class SilaApprovalWorkflowLevelDto
    {
        public int Level { get; set; }
        public Guid UserId { get; set; }
        public string? Name { get; set; }
        public string? RoleName { get; set; }
    }
}
