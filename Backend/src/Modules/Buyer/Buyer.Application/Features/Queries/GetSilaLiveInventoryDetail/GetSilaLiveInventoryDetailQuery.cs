using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaLiveInventoryDetail
{
    public class GetSilaLiveInventoryDetailQuery : IRequest<SilaLiveInventoryDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid MaterialId { get; set; }
        /// <summary>Quantity needed at the current location (base unit); null = 0.</summary>
        public decimal? RequiredQty { get; set; }
        /// <summary>The location the stock is needed at; default: the caller's first store or outlet.</summary>
        public Guid? CurrentLocationId { get; set; }
    }
}
