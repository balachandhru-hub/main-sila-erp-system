using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipes
{
    public class GetSilaRecipesQuery : IRequest<SilaRecipePageDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string? Status { get; set; }
        public string? ItemMode { get; set; }
        /// <summary>Recipe code, name or POS code.</summary>
        public string? Search { get; set; }
        public Guid? FamilyId { get; set; }
        public Guid? CategoryId { get; set; }
        /// <summary>True: only recipes with an approved version that sells (e.g. sub-recipes for a batch).</summary>
        public bool? Active { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
