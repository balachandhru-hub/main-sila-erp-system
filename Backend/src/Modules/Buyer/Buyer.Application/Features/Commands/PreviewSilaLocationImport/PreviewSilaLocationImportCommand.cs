using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PreviewSilaLocationImport
{
    public class PreviewSilaLocationImportCommand : IRequest<SilaLocationImportPreviewDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
