using MediatR;

namespace Buyer.Application.Features.Commands.DeleteSilaRecipeMaster
{
    /// <summary>Deletes (deactivates) a recipe family or category that no active recipe uses.</summary>
    public class DeleteSilaRecipeMasterCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        /// <summary>families | categories</summary>
        public string Kind { get; set; } = string.Empty;
        public Guid Id { get; set; }
    }
}
