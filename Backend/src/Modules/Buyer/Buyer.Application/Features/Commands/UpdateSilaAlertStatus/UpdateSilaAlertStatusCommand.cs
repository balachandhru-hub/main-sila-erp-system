using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaAlertStatus
{
    public class UpdateSilaAlertStatusCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid AlertId { get; set; }
        /// <summary>ACKNOWLEDGED, RESOLVED or DISMISSED.</summary>
        public string Status { get; set; } = string.Empty;
    }
}
