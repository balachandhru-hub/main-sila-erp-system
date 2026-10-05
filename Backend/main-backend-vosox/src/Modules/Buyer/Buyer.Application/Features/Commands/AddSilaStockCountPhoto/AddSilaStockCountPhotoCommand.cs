using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.AddSilaStockCountPhoto
{
    public class AddSilaStockCountPhotoCommand : IRequest<SilaStockCountPhotoDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
        public Guid ItemId { get; set; }
        public SilaStockCountPhotoUploadDto Request { get; set; } = new SilaStockCountPhotoUploadDto();
    }
}
