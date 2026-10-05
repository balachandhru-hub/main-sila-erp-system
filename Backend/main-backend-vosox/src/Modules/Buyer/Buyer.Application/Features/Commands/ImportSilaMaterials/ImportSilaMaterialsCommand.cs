using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ImportSilaMaterials
{
    /// <summary>
    /// Previews (Confirm = false) or applies (Confirm = true) a material Excel file. Applying is all-or-nothing: nothing is
    /// written unless every row is valid.
    /// </summary>
    public class ImportSilaMaterialsCommand : IRequest<SilaMaterialImportResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
        public bool Confirm { get; set; }
    }
}
