using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PullSilaPosSales
{
    /// <summary>Reads the sales from the buyer's POS sales API (GET_POS_SALE) and processes them. Also run by PosSalesPullJob.</summary>
    public class PullSilaPosSalesCommand : IRequest<SilaPosImportResultDto>
    {
        public Guid OrganizationId { get; set; }
        /// <summary>Empty when the scheduler pulls.</summary>
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
    }
}
