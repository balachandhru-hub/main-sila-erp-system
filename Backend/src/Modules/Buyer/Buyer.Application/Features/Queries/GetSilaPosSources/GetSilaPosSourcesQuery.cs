using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosSources
{
    /// <summary>The buyer's POS sources, default first.</summary>
    public class GetSilaPosSourcesQuery : IRequest<List<SilaPosSourceDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
    }
}
