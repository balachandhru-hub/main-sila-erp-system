using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class MenuEngineeringSettings : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        [Precision(18, 4)]
        public decimal DefaultMealParticipation { get; set; } = 0.70m;

        [Precision(18, 4)]
        public decimal DefaultItemParticipation { get; set; } = 0.20m;

        [Precision(18, 4)]
        public decimal DefaultBufferPercentage { get; set; } = 0.10m;

        [Precision(18, 4)]
        public decimal DefaultAdultFactor { get; set; } = 1m;

        [Precision(18, 4)]
        public decimal DefaultChildFactor { get; set; } = 0.6m;

        [Precision(18, 4)]
        public decimal PopularityThreshold { get; set; } = 0.70m;

        [Precision(18, 4)]
        public decimal HighFoodCostPercent { get; set; } = 0.35m;

        public int StaleHours { get; set; } = 24;

        public string? MealPeriodsJson { get; set; }

        public string? CategoriesJson { get; set; }

        public string? PmsProvider { get; set; } = "OPERA";

        public string? PmsConnectionName { get; set; }

        public string? PosConnectionName { get; set; }

        public string? AiNotes { get; set; }
    }
}
