using MediatR;

namespace Buyer.Application.Features.Commands.StartDueSilaPhysicalInventories
{
    /// <summary>Opens the surprise blind count of every physical inventory scheduled for today or earlier. Returns how many started.</summary>
    public class StartDueSilaPhysicalInventoriesCommand : IRequest<int>
    {
        /// <summary>Only this buyer (BuyerBusinessProfile id) when set; the scheduler runs one buyer per scope.</summary>
        public Guid? BuyerId { get; set; }
    }
}
