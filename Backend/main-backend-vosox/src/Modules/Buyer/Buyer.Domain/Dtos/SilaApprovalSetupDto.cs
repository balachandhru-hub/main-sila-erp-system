namespace Buyer.Domain.Dtos
{
    /// <summary>One area of approval setups (inventory, menu engineering, recipe, material, or another function).</summary>
    public class SilaApprovalSetupDto
    {
        public string Area { get; set; } = string.Empty;
        public List<SilaApprovalSetupActionDto> Actions { get; set; } = new();
    }

    /// <summary>Create, change, deactivation, or another action, and the flows that cover it.</summary>
    public class SilaApprovalSetupActionDto
    {
        public string Action { get; set; } = string.Empty;

        /// <summary>Master approval type. Empty when the action does not use a flow.</summary>
        public string? ApprovalType { get; set; }

        /// <summary>CONFIGURED | NOT_CONFIGURED | IMMEDIATE</summary>
        public string Status { get; set; } = string.Empty;

        public string? Note { get; set; }

        public List<SilaApprovalWorkflowDto> Flows { get; set; } = new();
    }
}
