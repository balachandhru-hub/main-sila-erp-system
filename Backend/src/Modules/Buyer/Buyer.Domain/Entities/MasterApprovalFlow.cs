using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class MasterApprovalFlow : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        public string ApprovalCode { get; set; }

        public string ApprovalName { get; set; }
          [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; }

        public string Type { get; set; }
        public decimal TotalAmount { get; set; }
        public string Currency { get; set; }
       

      
        public MasterApprovalFlow() { }

        // SILA ME release 2
        public string? ScopeKind { get; set; }

        public Guid? ScopeId { get; set; }

        public string? ScopeCode { get; set; }
    }
}
