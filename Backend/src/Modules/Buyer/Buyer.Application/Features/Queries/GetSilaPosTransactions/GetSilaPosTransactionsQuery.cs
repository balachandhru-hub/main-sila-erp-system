using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosTransactions
{
    public class GetSilaPosTransactionsQuery : IRequest<SilaPosTransactionPageDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>RECEIVED | INVENTORY_DEDUCTED | POSTED | FAILED (the tracker status, ERP outcome included).</summary>
        public string? Status { get; set; }
        public DateTime? BusinessDate { get; set; }
        public Guid? OutletLocationId { get; set; }
        /// <summary>A batch (also a PREVIEW batch); without it, lines of previewed batches are left out.</summary>
        public Guid? BatchId { get; set; }
        /// <summary>Sales whose consumption includes this material.</summary>
        public Guid? MaterialId { get; set; }
        /// <summary>ERP posting status: PENDING | POSTED | FAILED | SKIPPED | UNKNOWN.</summary>
        public string? PostingStatus { get; set; }
        /// <summary>POS code, POS transaction id or outlet code.</summary>
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
