using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ImportSilaRecipes
{
    /// <summary>
    /// Reads a recipe workbook. Commit = false previews it (nothing saved); Commit = true imports it, all or nothing, only
    /// when every row is valid: new recipes become DRAFT version 1, changed recipes a new draft version (or their draft is
    /// edited).
    /// </summary>
    public class ImportSilaRecipesCommand : IRequest<SilaRecipeImportPreviewDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public bool Commit { get; set; }
    }
}
