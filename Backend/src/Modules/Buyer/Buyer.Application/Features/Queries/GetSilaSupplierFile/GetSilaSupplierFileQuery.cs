using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaSupplierFile
{
    /// <summary>The Supplier Master Excel template, or every supplier as Excel.</summary>
    public class GetSilaSupplierFileQuery : IRequest<SilaReceivingFileDto>
    {
        public Guid OrganizationId { get; set; }
        public bool Template { get; set; }
    }
}
