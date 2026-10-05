using MediatR;

namespace Buyer.Application.Features.Commands.CancelSilaStockCount
{
    public class CancelSilaStockCountCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
    }
}
