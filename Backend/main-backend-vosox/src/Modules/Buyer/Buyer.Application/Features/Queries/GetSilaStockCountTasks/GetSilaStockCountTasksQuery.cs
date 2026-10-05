using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaStockCountTasks
{
    public class GetSilaStockCountTasksQuery : IRequest<List<SilaStockCountTaskDto>>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
    }
}
