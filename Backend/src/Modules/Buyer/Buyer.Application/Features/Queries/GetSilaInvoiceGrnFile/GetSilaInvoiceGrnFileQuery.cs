using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceGrnFile
{
    public class GetSilaInvoiceGrnFileQuery : IRequest<SilaInvoiceFileDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
        public Guid GoodsReceiptId { get; set; }
    }
}
