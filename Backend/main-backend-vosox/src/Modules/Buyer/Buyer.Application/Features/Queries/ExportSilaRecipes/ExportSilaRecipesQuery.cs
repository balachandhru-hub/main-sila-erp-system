using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.ExportSilaRecipes
{
    /// <summary>The recipe workbook: the template (Template = true) or every recipe's latest version with ingredients and outlet prices.</summary>
    public class ExportSilaRecipesQuery : IRequest<SilaRecipeFileDto>
    {
        public Guid OrganizationId { get; set; }
        public bool Template { get; set; }
    }
}
