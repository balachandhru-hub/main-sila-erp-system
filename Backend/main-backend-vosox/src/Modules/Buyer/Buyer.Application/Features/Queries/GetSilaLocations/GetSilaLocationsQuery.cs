using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaLocations
{
    public class GetSilaLocationsQuery : IRequest<List<SilaLocationResponseDto>>
    {
        public Guid OrganizationId { get; set; }
        /// <summary>STORE | OUTLET, all when empty.</summary>
        public string? LocationType { get; set; }
        public Guid? PropertyId { get; set; }

        /// <summary>ACTIVE (default) | INACTIVE | ALL.</summary>
        public string? Status { get; set; }
        public int Index { get; set; }
        /// <summary>Page size; the location pickers load the whole list, so the default is the maximum (200).</summary>
        public int Limit { get; set; } = SilaInputRules.MAX_LIMIT;
    }
}
