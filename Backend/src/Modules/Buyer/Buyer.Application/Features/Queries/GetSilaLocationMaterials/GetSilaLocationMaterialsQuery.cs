using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaLocationMaterials
{
    public class GetSilaLocationMaterialsQuery : IRequest<List<SilaLocationMaterialDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid LocationId { get; set; }
    }
}
