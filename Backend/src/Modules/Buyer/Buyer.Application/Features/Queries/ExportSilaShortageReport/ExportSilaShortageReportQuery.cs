using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.ExportSilaShortageReport
{
    public class ExportSilaShortageReportQuery : IRequest<SilaExcelFileDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaShortageReportFilterDto Filter { get; set; } = new SilaShortageReportFilterDto();
    }
}
