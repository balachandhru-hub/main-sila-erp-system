using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosItemMappings
{
    /// <summary>The item mappings of a POS source.</summary>
    public class GetSilaPosItemMappingsQuery : IRequest<SilaPosPageDto<SilaPosItemMappingDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        /// <summary>POS item code or description, recipe code or name.</summary>
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
