using MediatR;

namespace Buyer.Application.Features.Commands.RaiseLowStockAlerts
{
    /// <summary>Raises LOW_STOCK alerts for every buyer; returns the number of materials found under their threshold.</summary>
    public class RaiseLowStockAlertsCommand : IRequest<int>
    {
        /// <summary>Only this buyer (BuyerBusinessProfile id) when set; the scheduler runs one buyer per scope.</summary>
        public Guid? BuyerId { get; set; }
    }
}
