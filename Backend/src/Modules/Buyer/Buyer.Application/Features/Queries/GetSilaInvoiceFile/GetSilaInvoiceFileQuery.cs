using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceFile
{
    /// <summary>
    /// The stored file of an invoice, for download or preview.
    /// </summary>
    public class GetSilaInvoiceFileQuery : IRequest<SilaInvoiceFileDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid InvoiceId { get; set; }
    }
}
