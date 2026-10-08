using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.AddSilaPurchaseRequestToBucket
{
    public class AddSilaPurchaseRequestToBucketCommand : IRequest<SilaPurchaseRequestBucketResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid PurchaseRequestId { get; set; }
        public SilaPurchaseRequestBucketWriteDto Request { get; set; } = new();
    }
}
