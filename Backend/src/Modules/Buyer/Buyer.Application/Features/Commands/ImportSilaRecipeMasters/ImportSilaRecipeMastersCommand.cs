using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ImportSilaRecipeMasters
{
    /// <summary>
    /// Reads a family or category workbook. Commit = false previews it (nothing saved); Commit = true imports it, all or
    /// nothing, and only when every row is valid.
    /// </summary>
    public class ImportSilaRecipeMastersCommand : IRequest<SilaRecipeImportPreviewDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        /// <summary>families | categories</summary>
        public string Kind { get; set; } = string.Empty;
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public bool Commit { get; set; }
    }
}
