using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SubmitSilaStockCount
{
    public class SubmitSilaStockCountCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid StockCountId { get; set; }
        public SilaStockCountSubmitDto Request { get; set; } = new SilaStockCountSubmitDto();
    }
}
