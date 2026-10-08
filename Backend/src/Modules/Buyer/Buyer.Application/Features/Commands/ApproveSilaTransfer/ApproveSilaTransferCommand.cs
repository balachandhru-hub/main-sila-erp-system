using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ApproveSilaTransfer
{
    public class ApproveSilaTransferCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid TransferId { get; set; }
        public SilaTransferQuantitiesDto Request { get; set; } = new();
    }
}
