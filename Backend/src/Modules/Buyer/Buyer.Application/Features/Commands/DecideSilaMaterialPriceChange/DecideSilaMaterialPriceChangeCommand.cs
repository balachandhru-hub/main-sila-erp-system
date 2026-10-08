using MediatR;

namespace Buyer.Application.Features.Commands.DecideSilaMaterialPriceChange
{
    /// <summary>The signed-in approver approves or rejects the current level of a material price change.</summary>
    public class DecideSilaMaterialPriceChangeCommand : IRequest<string>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid PriceChangeId { get; set; }
        public bool Approve { get; set; }
        public string? Comment { get; set; }
    }
}
