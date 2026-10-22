using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SubmitSilaCreditMemo
{
    public class SubmitSilaCreditMemoCommand : IRequest<SilaCreditMemoDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid CreditMemoId { get; set; }
        public bool Retry { get; set; }
    }
}
