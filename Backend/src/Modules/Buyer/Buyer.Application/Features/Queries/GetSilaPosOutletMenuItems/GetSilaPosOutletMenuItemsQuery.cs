using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosOutletMenuItems
{
    /// <summary>The recipes priced at the location of a POS outlet mapping, with the POS item mapping of the source.</summary>
    public class GetSilaPosOutletMenuItemsQuery : IRequest<SilaPosPageDto<SilaPosOutletMenuItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        public Guid OutletMappingId { get; set; }
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
