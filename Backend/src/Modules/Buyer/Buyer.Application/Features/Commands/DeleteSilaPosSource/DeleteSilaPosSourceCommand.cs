using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DeleteSilaPosSource
{
    /// <summary>Deactivates a POS source and its outlet and item mappings.</summary>
    public class DeleteSilaPosSourceCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid SourceId { get; set; }
    }
}
