using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CancelSilaTransfer
{
    public class CancelSilaTransferCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid TransferId { get; set; }
        public SilaTransferCommentDto Request { get; set; } = new();
    }
}
