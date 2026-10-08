using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UploadSilaPosSales
{
    /// <summary>A POS sales file (.xlsx or .csv) to validate and store as a PREVIEW batch; "Process" then processes it.</summary>
    public class UploadSilaPosSalesCommand : IRequest<SilaPosPreviewDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>The POS source whose mappings apply; null = the default source.</summary>
        public Guid? PosSourceId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
