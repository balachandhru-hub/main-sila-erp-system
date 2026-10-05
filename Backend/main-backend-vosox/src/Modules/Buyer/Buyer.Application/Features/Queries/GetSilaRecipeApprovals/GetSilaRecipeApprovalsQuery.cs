using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaRecipeApprovals
{
    /// <summary>Recipes waiting for the signed-in user's decision.</summary>
    public class GetSilaRecipeApprovalsQuery : IRequest<List<SilaRecipeListItemDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }

        /// <summary>0-based row offset.</summary>
        public int Index { get; set; }

        /// <summary>Rows per page (default 50, max 200).</summary>
        public int Limit { get; set; } = 50;
    }
}
