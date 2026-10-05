using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaGoodsReceipts
{
    /// <summary>
    /// Goods receipts at the locations the user may work with, newest first, searched by GRN, PO number or delivery note.
    /// </summary>
    public class GetSilaGoodsReceiptsQuery : IRequest<List<SilaReceivingGrnListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string? Search { get; set; }
        public DateTime? FromDate { get; set; }
        public DateTime? ToDate { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
