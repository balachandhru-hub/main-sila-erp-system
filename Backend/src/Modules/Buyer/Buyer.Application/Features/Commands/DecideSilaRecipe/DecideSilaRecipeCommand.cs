using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DecideSilaRecipe
{
    public class DecideSilaRecipeCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid RecipeId { get; set; }
        /// <summary>True approves, false rejects.</summary>
        public bool Approve { get; set; }
        public SilaRecipeDecisionDto Request { get; set; } = new();
    }
}
