using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaOcrConfiguration
{
    /// <summary>How the buyer's invoices are read (defaults when nothing is saved).</summary>
    public class GetSilaOcrConfigurationQuery : IRequest<SilaOcrConfigurationDto>
    {
        public Guid OrganizationId { get; set; }
    }
}
