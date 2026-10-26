using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class MenuPlan : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Required]
        public string PlanCode { get; set; } = string.Empty;

        [Required]
        public string Name { get; set; } = string.Empty;

        public Guid? PropertyId { get; set; }

        public Guid? OutletLocationId { get; set; }

        public DateTime BusinessDate { get; set; }

        public DateTime? StartDate { get; set; }

        public DateTime? EndDate { get; set; }

        public string? MealPeriod { get; set; }

        public string? EventName { get; set; }

        [Precision(18, 4)]
        public decimal? ExpectedGuests { get; set; }

        [Precision(18, 4)]
        public decimal? ExpectedCovers { get; set; }

        [Precision(18, 4)]
        public decimal? MealParticipation { get; set; }

        [Required]
        public string Status { get; set; } = "DRAFT";

        public string? Notes { get; set; }

        public Guid? CopiedFromPlanId { get; set; }

        public ICollection<MenuPlanLine> Lines { get; set; } = new List<MenuPlanLine>();
    }
}
