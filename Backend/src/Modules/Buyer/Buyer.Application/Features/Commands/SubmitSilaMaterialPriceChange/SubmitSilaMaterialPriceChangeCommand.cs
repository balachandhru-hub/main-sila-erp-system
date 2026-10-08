using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SubmitSilaMaterialPriceChange
{
    /// <summary>Requests a new unit price for a material; returns the id of the price change waiting for approval.</summary>
    public class SubmitSilaMaterialPriceChangeCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid MaterialId { get; set; }
        public SilaMaterialPriceChangeWriteDto Request { get; set; } = new();
    }
}
