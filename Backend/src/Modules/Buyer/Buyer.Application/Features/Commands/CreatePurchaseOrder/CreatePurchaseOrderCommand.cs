using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreatePurchaseOrder
{
    public class CreatePurchaseOrderCommand : IRequest<PurchaseOrderProcessResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public CreatePurchaseOrderRequestDto Request { get; set; } = new CreatePurchaseOrderRequestDto();

        /// <summary>Set by the weekly bucket automation (never by the API): the order is created for this bucket.</summary>
        public Guid? WeeklyBucketId { get; set; }
        public string? BucketCode { get; set; }

        /// <summary>The supplier's name when the caller knows it, so the Supplier service is not asked.</summary>
        public string? SupplierName { get; set; }

        /// <summary>What a weekly bucket line holds beyond the request line, in the same order as the request lines.</summary>
        public List<CreatePurchaseOrderLineExtra>? LineExtras { get; set; }
    }

    public class CreatePurchaseOrderLineExtra
    {
        public Guid CatalogId { get; set; }
        public Guid? OutletId { get; set; }
        public decimal? DiscountPercent { get; set; }
    }
}
