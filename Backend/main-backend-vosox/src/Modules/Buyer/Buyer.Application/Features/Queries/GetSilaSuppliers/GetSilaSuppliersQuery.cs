using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaSuppliers
{
    /// <summary>Supplier Master rows of the buyer, searched by code, name, tax number or alias.</summary>
    public class GetSilaSuppliersQuery : IRequest<List<SilaSupplierDto>>
    {
        public Guid OrganizationId { get; set; }
        public string? Status { get; set; }
        public string? Search { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
