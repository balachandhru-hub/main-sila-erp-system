using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipe
{
    public class GetSilaRecipeQuery : IRequest<SilaRecipeDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid RecipeId { get; set; }
        /// <summary>The version to show; the latest version when empty.</summary>
        public int? Version { get; set; }
    }
}
