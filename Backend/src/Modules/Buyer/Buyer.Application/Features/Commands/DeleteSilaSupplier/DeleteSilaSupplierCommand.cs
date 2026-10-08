using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DeleteSilaSupplier
{
    /// <summary>Removes a Supplier Master row (soft delete); invoices keep their supplier name.</summary>
    public class DeleteSilaSupplierCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid SupplierId { get; set; }
    }
}
