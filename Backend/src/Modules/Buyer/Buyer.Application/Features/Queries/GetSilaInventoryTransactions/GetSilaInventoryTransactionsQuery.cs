using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaInventoryTransactions
{
    public class GetSilaInventoryTransactionsQuery : IRequest<List<SilaInventoryTransactionDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid? LocationId { get; set; }
        public Guid? MaterialId { get; set; }
        public string? TransactionType { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
