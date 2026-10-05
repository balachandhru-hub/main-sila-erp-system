using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaReplenishmentTransfers
{
    public class CreateSilaReplenishmentTransfersCommand : IRequest<SilaReplenishmentResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaReplenishmentWriteDto Request { get; set; } = new();
    }
}
