using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaTransfers
{
    public class GetSilaTransfersQuery : IRequest<List<SilaTransferListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }

        /// <summary>mine | to-approve | in-transit | completed</summary>
        public string Tab { get; set; } = string.Empty;

        /// <summary>0-based row offset.</summary>
        public int Index { get; set; }

        /// <summary>Rows per page (default 50, max 200).</summary>
        public int Limit { get; set; } = 50;

        /// <summary>STANDARD | QUICK; empty for both.</summary>
        public string? Mode { get; set; }
        public Guid? FromLocationId { get; set; }
        public Guid? ToLocationId { get; set; }

        /// <summary>Transfers whose source belongs to this property.</summary>
        public Guid? PropertyId { get; set; }

        /// <summary>Requested on or after this date.</summary>
        public DateTime? FromDate { get; set; }

        /// <summary>Requested on or before this date (whole day).</summary>
        public DateTime? ToDate { get; set; }
    }
}
