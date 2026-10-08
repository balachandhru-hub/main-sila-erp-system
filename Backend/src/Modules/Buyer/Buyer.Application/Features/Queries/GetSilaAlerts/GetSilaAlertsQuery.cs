using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaAlerts
{
    public class GetSilaAlertsQuery : IRequest<List<SilaAlertDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string? Status { get; set; }
        public int Take { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; }
    }
}
