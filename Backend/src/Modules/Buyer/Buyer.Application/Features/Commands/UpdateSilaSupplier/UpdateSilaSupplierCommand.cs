using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaSupplier
{
    /// <summary>Changes a Supplier Master row.</summary>
    public class UpdateSilaSupplierCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid SupplierId { get; set; }
        public SilaSupplierWriteDto Request { get; set; } = new();
    }
}
