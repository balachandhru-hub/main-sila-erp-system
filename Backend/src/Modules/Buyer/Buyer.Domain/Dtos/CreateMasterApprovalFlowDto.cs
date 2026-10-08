namespace Buyer.Domain.Dtos
{
    public class CreateMasterApprovalFlowDto
    {
        public string ApprovalCode { get; set; }

        public string ApprovalName { get; set; }

        public string Type { get; set; }

        public decimal TotalAmount { get; set; }

        public string Currency { get; set; }

        /// <summary>Where the flow applies: ALL (default), PROPERTY, OUTLET, STORE or COMPANY_CODE (SILA ME approval types).</summary>
        public string? ScopeKind { get; set; }

        /// <summary>The property (PROPERTY) or SILA inventory location (OUTLET / STORE) the flow applies to.</summary>
        public Guid? ScopeId { get; set; }

        /// <summary>The company code the flow applies to (COMPANY_CODE).</summary>
        public string? ScopeCode { get; set; }

        public List<CreateApprovalFlowUserDto> Users { get; set; }
            = new List<CreateApprovalFlowUserDto>();
    }

    public class CreateApprovalFlowUserDto
    {
        public Guid UserId { get; set; }

        public int Order { get; set; }
    }
}