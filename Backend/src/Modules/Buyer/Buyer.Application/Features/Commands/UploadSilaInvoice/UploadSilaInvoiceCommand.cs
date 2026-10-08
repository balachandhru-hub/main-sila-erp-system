using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UploadSilaInvoice
{
    /// <summary>
    /// Stores a supplier invoice file (PDF, JPEG or PNG, up to 20 MB) as a new UPLOADED invoice. Returns its id.
    /// </summary>
    public class UploadSilaInvoiceCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public SilaInvoiceUploadDto Request { get; set; } = new();
    }
}
