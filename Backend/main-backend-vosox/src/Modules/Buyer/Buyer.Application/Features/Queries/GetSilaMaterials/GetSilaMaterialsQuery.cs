using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaMaterials
{
    public class GetSilaMaterialsQuery : IRequest<List<SilaMaterialDto>>
    {
        public Guid OrganizationId { get; set; }
        /// <summary>Part of the material code, description or barcode.</summary>
        public string? Search { get; set; }
        /// <summary>Only materials flagged as inventory items.</summary>
        public bool InventoryOnly { get; set; }
        /// <summary>APPROVED | MISSING | PENDING_APPROVAL; empty for all.</summary>
        public string? PriceStatus { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
