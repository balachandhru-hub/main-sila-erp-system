using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosTransaction
{
    /// <summary>A POS sale with its consumed ingredients, timeline and ERP posting.</summary>
    public class GetSilaPosTransactionQuery : IRequest<SilaPosTransactionDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid TransactionId { get; set; }
    }
}
