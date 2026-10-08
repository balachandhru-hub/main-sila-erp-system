namespace Buyer.Domain.Dtos
{
    public class MasterApprovalFlowDto
    {
        public Guid Id { get; set; }

        public string ApprovalCode { get; set; }

        public string ApprovalName { get; set; }

        public Guid BuyerId { get; set; }

        public string? Type { get; set; }

        /// <summary>ALL | PROPERTY | OUTLET | STORE | COMPANY_CODE; empty means ALL.</summary>
        public string? ScopeKind { get; set; }

        public Guid? ScopeId { get; set; }

        public string? ScopeCode { get; set; }

        /// <summary>Name of the scoped property or location.</summary>
        public string? ScopeName { get; set; }
    }
}
