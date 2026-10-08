using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RespondSilaEnquiry
{
    public class RespondSilaEnquiryCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid EnquiryId { get; set; }
        public SilaEnquiryRespondDto Request { get; set; } = new SilaEnquiryRespondDto();
    }
}
