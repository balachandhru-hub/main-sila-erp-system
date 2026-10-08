using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PredefinedContract : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        public string ContractNumber { get; set; }

        [Required]
        [ForeignKey("RFQ")]
        public Guid RFQId { get; set; }
        public RFQ RFQ { get; set; }
        public string ContractName { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }
      
        [DeleteBehavior(DeleteBehavior.NoAction)]
        public BuyerBusinessProfile BuyerBusinessProfile { get; set; }

        [Required]
        public Guid SupplierId { get; set; }

        public DateTime StartDate { get; set; }
        public DateTime EndDate { get; set; }
        public decimal Amount { get; set; }
        public string Status { get; set; }

        /// <summary>
        /// Set to CONTRACT_CREATED when the contract is created; shown to the supplier once the RFQ is awarded.
        /// </summary>
        public string? ContractStatus { get; set; }

        /// <summary>
        /// Id the external ERP returned when the executed contract was sent to it. Null until the ERP accepted it,
        /// or when the buyer has no contract API configured.
        /// </summary>
        public string? ErpContractId { get; set; }
        public PredefinedContract() { }
    }
}
