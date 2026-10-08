using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaSupplier
{
    /// <summary>One Supplier Master row.</summary>
    public class GetSilaSupplierQuery : IRequest<SilaSupplierDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid SupplierId { get; set; }
    }
}
