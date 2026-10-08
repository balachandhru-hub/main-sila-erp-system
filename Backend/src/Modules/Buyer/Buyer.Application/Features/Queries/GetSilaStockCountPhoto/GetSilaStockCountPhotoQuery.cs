using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaStockCountPhoto
{
    public class GetSilaStockCountPhotoQuery : IRequest<SilaStockCountPhotoFileDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
        public Guid PhotoId { get; set; }
    }
}
