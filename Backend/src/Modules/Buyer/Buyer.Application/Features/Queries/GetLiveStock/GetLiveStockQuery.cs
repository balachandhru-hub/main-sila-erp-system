using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetLiveStock
{
    /// <summary>
    /// Reads the stock in hand of an organization from its stock API, at the moment it is asked.
    /// </summary>
    public class GetLiveStockQuery : IRequest<StockInHandResponseDto>
    {
        public Guid OrganizationId { get; set; }
    }
}
