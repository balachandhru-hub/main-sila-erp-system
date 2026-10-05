using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SendSilaShortageReport
{
    public class SendSilaShortageReportCommand : IRequest<SilaShortageReportSendResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaShortageReportSendDto Request { get; set; } = new SilaShortageReportSendDto();
    }
}
