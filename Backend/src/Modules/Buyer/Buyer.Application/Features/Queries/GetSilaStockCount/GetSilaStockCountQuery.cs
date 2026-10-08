using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaStockCount
{
    public class GetSilaStockCountQuery : IRequest<SilaStockCountDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
    }
}
