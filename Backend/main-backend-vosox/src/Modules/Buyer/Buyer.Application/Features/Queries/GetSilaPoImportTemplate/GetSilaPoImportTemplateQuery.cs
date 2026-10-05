using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPoImportTemplate
{
    /// <summary>The purchase order import Excel template.</summary>
    public class GetSilaPoImportTemplateQuery : IRequest<SilaReceivingFileDto>
    {
        public Guid OrganizationId { get; set; }
    }
}
