using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>PMS demand adapter. OPERA is the first provider; others plug in here. Never invents occupancy.</summary>
    public static class SilaPmsAdapters
    {
        public const string OPERA = "OPERA";
        public const string MANUAL = "MANUAL";
        public const string OTHER = "OTHER_PMS";

        public static PmsDemandSnapshot Unavailable(Guid buyerId, Guid? propertyId, DateTime businessDate, string provider, string message)
        {
            return new PmsDemandSnapshot
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                PropertyId = propertyId,
                BusinessDate = businessDate.Date,
                Source = provider,
                Provider = provider,
                Status = "UNAVAILABLE",
                Freshness = "STALE",
                Message = message,
                IsActive = true
            };
        }
    }
}
