using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class InternalTransferOrderItem : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("InternalTransferOrder")]
        public Guid InternalTransferOrderId { get; set; }

        public InternalTransferOrder InternalTransferOrder { get; set; } = null!;

        public Guid MaterialId { get; set; }

        [Required]
        public string MaterialCode { get; set; } = string.Empty;

        [Required]
        public string MaterialName { get; set; } = string.Empty;

        [Precision(18, 4)]
        public decimal RequestedQty { get; set; }

        [Precision(18, 4)]
        public decimal ApprovedQty { get; set; }

        [Precision(18, 4)]
        public decimal DispatchedQty { get; set; }

        [Precision(18, 4)]
        public decimal ReceivedQty { get; set; }

        [Required]
        public string Uom { get; set; } = string.Empty;
    }
}
