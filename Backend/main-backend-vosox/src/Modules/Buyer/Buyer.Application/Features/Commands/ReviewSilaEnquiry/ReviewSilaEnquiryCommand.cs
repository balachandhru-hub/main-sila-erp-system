using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ReviewSilaEnquiry
{
    public class ReviewSilaEnquiryCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid EnquiryId { get; set; }
        public SilaEnquiryReviewDto Request { get; set; } = new SilaEnquiryReviewDto();
    }
}
