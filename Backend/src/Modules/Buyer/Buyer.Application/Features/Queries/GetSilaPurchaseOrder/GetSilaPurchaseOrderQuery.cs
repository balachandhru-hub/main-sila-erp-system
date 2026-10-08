using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPurchaseOrder
{
    /// <summary>
    /// A purchase order of the buyer with the ordered, received and open quantity of each line.
    /// </summary>
    public class GetSilaPurchaseOrderQuery : IRequest<SilaReceivingPoDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid PurchaseOrderId { get; set; }
    }
}
