using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReconcileSilaErpPosting
{
    /// <summary>Settles an UNKNOWN posting: POSTED when the document is in the ERP, otherwise PENDING to send it again.</summary>
    public class ReconcileSilaErpPostingCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid PostingId { get; set; }
        public SilaErpPostingReconcileDto Request { get; set; } = new();
    }
}
