using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class QuickTransferPolicy : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public bool Enabled { get; set; }

        [Precision(18, 4)]
        public decimal? MaximumQuantity { get; set; }

        public bool SkipManagerApproval { get; set; }

        public bool OutletToOutletAllowed { get; set; }

        public bool SourceConfirmationRequired { get; set; }

        // SILA ME parity release (nullable: rows saved before it keep the previous behaviour)
        /// <summary>Largest value (quantity Ã— unit cost) of one quick transfer; null = no limit.</summary>
        [Precision(18, 4)]
        public decimal? MaximumValue { get; set; }

        /// <summary>The destination confirms the receipt; false posts the stock straight to the destination. Null means true.</summary>
        public bool? DestinationConfirmationRequired { get; set; }

        /// <summary>Raise an alert for the source location's managers on every quick transfer. Null means false.</summary>
        public bool? ManagerNotification { get; set; }

        /// <summary>Comma list of location types a quick transfer may leave (STORE,OUTLET); null = all.</summary>
        public string? AllowedSourceTypes { get; set; }

        /// <summary>Comma list of location types a quick transfer may reach (STORE,OUTLET); null = all.</summary>
        public string? AllowedDestinationTypes { get; set; }
    }
}
