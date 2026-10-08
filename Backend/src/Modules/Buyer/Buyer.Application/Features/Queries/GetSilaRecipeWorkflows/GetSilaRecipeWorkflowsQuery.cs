using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipeWorkflows
{
    /// <summary>The active RECIPE approval flows of the organization with their levels.</summary>
    public class GetSilaRecipeWorkflowsQuery : IRequest<List<SilaApprovalWorkflowDto>>
    {
        public Guid OrganizationId { get; set; }
    }
}
