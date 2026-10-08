using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SaveSilaPosSource
{
    /// <summary>Creates or updates a POS source; a default source makes every other source non-default.</summary>
    public class SaveSilaPosSourceCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>null creates a new source.</summary>
        public Guid? SourceId { get; set; }
        public SilaPosSourceWriteDto Request { get; set; } = new();
    }
}
