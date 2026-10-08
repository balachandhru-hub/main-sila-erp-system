using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SaveSilaPosItemMapping
{
    /// <summary>Creates or updates the mapping of a POS item code to a recipe.</summary>
    public class SaveSilaPosItemMappingCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        /// <summary>null creates a new mapping.</summary>
        public Guid? MappingId { get; set; }
        public SilaPosItemMappingWriteDto Request { get; set; } = new();
    }
}
