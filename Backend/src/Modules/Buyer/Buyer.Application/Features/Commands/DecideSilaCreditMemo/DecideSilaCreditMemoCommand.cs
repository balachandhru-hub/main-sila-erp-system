using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DecideSilaCreditMemo
{
    public class DecideSilaCreditMemoCommand : IRequest<SilaCreditMemoDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid CreditMemoId { get; set; }
        public SilaInvoiceDecisionDto Request { get; set; } = new();
    }
}
