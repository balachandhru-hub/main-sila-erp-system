using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DiscardSilaPosBatch
{
    /// <summary>Discards a previewed batch that was not processed: its lines are removed so the file can be uploaded again.</summary>
    public class DiscardSilaPosBatchCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid BatchId { get; set; }
    }
}
