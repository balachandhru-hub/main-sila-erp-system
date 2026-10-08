using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosOutletMappings
{
    /// <summary>The outlet mappings of a POS source.</summary>
    public class GetSilaPosOutletMappingsQuery : IRequest<SilaPosPageDto<SilaPosOutletMappingDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        /// <summary>POS outlet code or name, location code or name.</summary>
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
