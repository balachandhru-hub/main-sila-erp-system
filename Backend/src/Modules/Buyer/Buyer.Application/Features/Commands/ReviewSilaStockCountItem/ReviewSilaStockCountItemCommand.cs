using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReviewSilaStockCountItem
{
    public class ReviewSilaStockCountItemCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
        public Guid ItemId { get; set; }
        public SilaStockCountItemReviewDto Request { get; set; } = new SilaStockCountItemReviewDto();
    }
}
