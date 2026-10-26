using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaCreditMemo
{
    public class UpdateSilaCreditMemoCommand : IRequest<SilaCreditMemoDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid CreditMemoId { get; set; }
        public SilaCreditMemoWriteDto Request { get; set; } = new();
    }
}
