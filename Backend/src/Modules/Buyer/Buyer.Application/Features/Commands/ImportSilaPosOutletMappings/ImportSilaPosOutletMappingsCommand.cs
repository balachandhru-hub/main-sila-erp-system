using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ImportSilaPosOutletMappings
{
    /// <summary>Imports outlet mappings from the Excel template (columns PosOutletCode, PosOutletName, LocationCode).</summary>
    public class ImportSilaPosOutletMappingsCommand : IRequest<SilaPosMappingImportDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
        /// <summary>false = preview only; true = import all rows (refused while any row is invalid).</summary>
        public bool Confirm { get; set; }
    }
}
