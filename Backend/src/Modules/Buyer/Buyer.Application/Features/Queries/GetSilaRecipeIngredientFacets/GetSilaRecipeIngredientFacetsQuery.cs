using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipeIngredientFacets
{
    /// <summary>The material groups, categories and suppliers the ingredient search can filter by.</summary>
    public class GetSilaRecipeIngredientFacetsQuery : IRequest<SilaRecipeIngredientFacetsDto>
    {
        public Guid OrganizationId { get; set; }
    }
}
