using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.IdentifySilaStockCountBarcode
{
    public class IdentifySilaStockCountBarcodeQuery : IRequest<SilaStockCountBarcodeDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
        public string Barcode { get; set; } = string.Empty;
    }
}
