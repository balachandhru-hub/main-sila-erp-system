using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaPurchaseRequest
{
    public class CreateSilaPurchaseRequestCommand : IRequest<SilaPurchaseRequestDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaPurchaseRequestWriteDto Request { get; set; } = new();
    }
}
