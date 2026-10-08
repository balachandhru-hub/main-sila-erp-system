using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SaveSilaRecipeMaster
{
    /// <summary>Creates (Id empty) or edits a recipe family or category. Returns its id.</summary>
    public class SaveSilaRecipeMasterCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>families | categories</summary>
        public string Kind { get; set; } = string.Empty;
        public Guid? Id { get; set; }
        public SilaRecipeMasterWriteDto Request { get; set; } = new();
    }
}
