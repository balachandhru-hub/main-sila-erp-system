using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaAuditLog
{
    public class GetSilaAuditLogQuery : IRequest<List<SilaAuditEventDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public string? ReferenceType { get; set; }
        public Guid? ReferenceId { get; set; }
        public Guid? Actor { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 50;
    }
}
