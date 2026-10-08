using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CountSilaStockCountItem
{
    public class CountSilaStockCountItemCommand : IRequest<SilaStockCountItemResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
        /// <summary>The line to count; null adds Request.MaterialId to the count sheet (or counts its existing line).</summary>
        public Guid? ItemId { get; set; }
        public SilaStockCountItemWriteDto Request { get; set; } = new SilaStockCountItemWriteDto();
    }
}
