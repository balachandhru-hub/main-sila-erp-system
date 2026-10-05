using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReceiveSilaTransfer
{
    public class ReceiveSilaTransferCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid TransferId { get; set; }
        public SilaTransferQuantitiesDto Request { get; set; } = new();
    }
}
