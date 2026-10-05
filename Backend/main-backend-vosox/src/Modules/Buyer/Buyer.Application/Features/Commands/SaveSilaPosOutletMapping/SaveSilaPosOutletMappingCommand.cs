using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SaveSilaPosOutletMapping
{
    /// <summary>Creates or updates the mapping of a POS outlet code to a SILA outlet location.</summary>
    public class SaveSilaPosOutletMappingCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        /// <summary>null creates a new mapping.</summary>
        public Guid? MappingId { get; set; }
        public SilaPosOutletMappingWriteDto Request { get; set; } = new();
    }
}
