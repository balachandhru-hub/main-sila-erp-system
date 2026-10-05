using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoice
{
    /// <summary>
    /// One invoice with its OCR result, lines and the goods receipts posted from it.
    /// </summary>
    public class GetSilaInvoiceQuery : IRequest<SilaInvoiceDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
