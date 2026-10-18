using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaEligiblePurchaseOrders
{
    public class GetSilaEligiblePurchaseOrdersQuery : IRequest<List<SilaEligiblePurchaseOrderDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid? SilaSupplierId { get; set; }
        public Guid? SupplierId { get; set; }
        public string? CompanyCode { get; set; }
        public Guid? PropertyId { get; set; }
    }
}
