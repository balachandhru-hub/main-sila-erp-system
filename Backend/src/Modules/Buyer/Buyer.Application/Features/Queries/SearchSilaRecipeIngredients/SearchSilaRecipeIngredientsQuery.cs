using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.SearchSilaRecipeIngredients
{
    /// <summary>Item Master materials to add as recipe ingredients, filtered by text and the facets.</summary>
    public class SearchSilaRecipeIngredientsQuery : IRequest<SilaRecipeIngredientPageDto>
    {
        public Guid OrganizationId { get; set; }
        /// <summary>Material code or description.</summary>
        public string? Search { get; set; }
        public string? MaterialGroup { get; set; }
        /// <summary>Item Master product type.</summary>
        public string? Category { get; set; }
        /// <summary>Supplier name: materials that supplier delivered on a purchase order.</summary>
        public string? Supplier { get; set; }
        /// <summary>Inventory type (STOCK, NON_STOCK, SERVICE).</summary>
        public string? MaterialType { get; set; }
        /// <summary>SILA supplier id: materials that supplier (or one of its aliases) delivered on a purchase order.</summary>
        public Guid? SupplierId { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
