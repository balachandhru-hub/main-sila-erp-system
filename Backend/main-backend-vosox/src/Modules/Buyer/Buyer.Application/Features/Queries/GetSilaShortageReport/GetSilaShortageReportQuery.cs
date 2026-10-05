using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaShortageReport
{
    public class GetSilaShortageReportQuery : IRequest<SilaShortageReportDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaShortageReportFilterDto Filter { get; set; } = new SilaShortageReportFilterDto();
        public int Index { get; set; }
        public int Limit { get; set; } = 20;
    }
}
