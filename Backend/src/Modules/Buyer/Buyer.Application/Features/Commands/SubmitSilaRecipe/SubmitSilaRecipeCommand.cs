using MediatR;

namespace Buyer.Application.Features.Commands.SubmitSilaRecipe
{
    public class SubmitSilaRecipeCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid RecipeId { get; set; }
    }
}
