using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaMaterialPriceHistory
{
    /// <summary>The price changes of one material, newest first, with their approval trails.</summary>
    public class GetSilaMaterialPriceHistoryQuery : IRequest<List<SilaMaterialPriceChangeDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid MaterialId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
