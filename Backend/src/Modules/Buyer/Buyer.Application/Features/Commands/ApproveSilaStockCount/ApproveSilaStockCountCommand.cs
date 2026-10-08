using MediatR;

namespace Buyer.Application.Features.Commands.ApproveSilaStockCount
{
    public class ApproveSilaStockCountCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
    }
}
