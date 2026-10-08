using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaEnquiry
{
    public class GetSilaEnquiryQuery : IRequest<SilaEnquiryDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid EnquiryId { get; set; }
    }
}
