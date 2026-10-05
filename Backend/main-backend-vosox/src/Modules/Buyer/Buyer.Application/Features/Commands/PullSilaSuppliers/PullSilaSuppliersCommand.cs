using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PullSilaSuppliers
{
    /// <summary>Reads the suppliers from every active GET_SUPPLIER API of the organization into the Supplier Master.</summary>
    public class PullSilaSuppliersCommand : IRequest<SilaMasterPullResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
    }
}
