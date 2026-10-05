using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosBatch
{
    /// <summary>One sales batch (its lines come from pos/transactions?batchId=).</summary>
    public class GetSilaPosBatchQuery : IRequest<SilaPosBatchDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid BatchId { get; set; }
    }
}
