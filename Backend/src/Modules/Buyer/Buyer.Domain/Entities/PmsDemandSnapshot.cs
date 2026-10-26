using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;
using SharedKernel.Models;

namespace Buyer.Domain.Entities
{
    public class PmsDemandSnapshot : BaseModel
    {
        [Key]
        [Required]
        public Guid Id { get; set; }

        [Required]
        [ForeignKey("BuyerBusinessProfile")]
        public Guid BuyerId { get; set; }

        public BuyerBusinessProfile BuyerBusinessProfile { get; set; } = null!;

        public Guid? PropertyId { get; set; }

        public DateTime BusinessDate { get; set; }

        [Required]
        public string Source { get; set; } = "MANUAL";

        [Required]
        public string Provider { get; set; } = "OPERA";

        [Precision(18, 4)]
        public decimal? OccupancyPercent { get; set; }

        [Precision(18, 4)]
        public decimal? RoomsAvailable { get; set; }

        [Precision(18, 4)]
        public decimal? RoomsOccupied { get; set; }

        [Precision(18, 4)]
        public decimal? ExpectedGuests { get; set; }

        [Precision(18, 4)]
        public decimal? Adults { get; set; }

        [Precision(18, 4)]
        public decimal? Children { get; set; }

        [Precision(18, 4)]
        public decimal? Arrivals { get; set; }

        [Precision(18, 4)]
        public decimal? Departures { get; set; }

        [Precision(18, 4)]
        public decimal? Stayovers { get; set; }

        [Precision(18, 4)]
        public decimal? Reservations { get; set; }

        [Precision(18, 4)]
        public decimal? ForecastReservations { get; set; }

        [Precision(18, 4)]
        public decimal? GroupBookings { get; set; }

        public string? MealPlans { get; set; }

        public string? Events { get; set; }

        [Required]
        public string Status { get; set; } = "CURRENT";

        public DateTime? SourceTimestamp { get; set; }

        public DateTime? LastSuccessfulSync { get; set; }

        public string? Freshness { get; set; }

        public string? Message { get; set; }
    }
}
