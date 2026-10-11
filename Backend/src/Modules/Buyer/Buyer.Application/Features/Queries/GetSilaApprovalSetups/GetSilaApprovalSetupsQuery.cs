using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaApprovalSetups
{
    /// <summary>Every approval setup for the buyer, grouped by area and action.</summary>
    public class GetSilaApprovalSetupsQuery : IRequest<List<SilaApprovalSetupDto>>
    {
        public Guid OrganizationId { get; set; }
    }
}
