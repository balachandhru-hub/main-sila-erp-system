using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaStockCount
{
    public class CreateSilaStockCountCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaStockCountWriteDto Request { get; set; } = new SilaStockCountWriteDto();
    }
}
