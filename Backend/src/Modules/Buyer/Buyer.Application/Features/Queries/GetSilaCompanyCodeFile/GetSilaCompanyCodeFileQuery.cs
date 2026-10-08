using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaCompanyCodeFile
{
    /// <summary>The Company Code Master Excel template, or every company code as Excel.</summary>
    public class GetSilaCompanyCodeFileQuery : IRequest<SilaReceivingFileDto>
    {
        public Guid OrganizationId { get; set; }
        public bool Template { get; set; }
    }
}
