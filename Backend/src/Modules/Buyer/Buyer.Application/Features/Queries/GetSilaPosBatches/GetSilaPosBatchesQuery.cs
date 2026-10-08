using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosBatches
{
    public class GetSilaPosBatchesQuery : IRequest<List<SilaPosBatchDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
