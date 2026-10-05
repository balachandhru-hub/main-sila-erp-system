using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.RequestSilaAlertCount
{
    /// <summary>"Request physical inventory" on an alert: schedules a surprise blind count at the alert's location.</summary>
    public class RequestSilaAlertCountCommand : IRequest<SilaPhysicalInventoryDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid AlertId { get; set; }
        /// <summary>Optional date; empty picks a random working day within the next 7 days.</summary>
        public DateTime? ScheduledDate { get; set; }
    }
}
