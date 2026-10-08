using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DeleteSilaPosItemMapping
{
    /// <summary>Removes an item mapping.</summary>
    public class DeleteSilaPosItemMappingCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
        public Guid MappingId { get; set; }
    }
}
