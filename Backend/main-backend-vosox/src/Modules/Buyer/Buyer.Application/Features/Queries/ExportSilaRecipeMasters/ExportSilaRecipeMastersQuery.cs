using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.ExportSilaRecipeMasters
{
    /// <summary>The Excel template (Template = true, headers only) or the export of the active families or categories.</summary>
    public class ExportSilaRecipeMastersQuery : IRequest<SilaRecipeFileDto>
    {
        public Guid OrganizationId { get; set; }
        /// <summary>families | categories</summary>
        public string Kind { get; set; } = string.Empty;
        public bool Template { get; set; }
    }
}
