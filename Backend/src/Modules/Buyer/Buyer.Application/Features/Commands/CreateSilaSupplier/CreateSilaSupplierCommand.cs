using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaSupplier
{
    /// <summary>Adds a Supplier Master row; a deleted row with the same code is brought back.</summary>
    public class CreateSilaSupplierCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public SilaSupplierWriteDto Request { get; set; } = new();
    }
}
