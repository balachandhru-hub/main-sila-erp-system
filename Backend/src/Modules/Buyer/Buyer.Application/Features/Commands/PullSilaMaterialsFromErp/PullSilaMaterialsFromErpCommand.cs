using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.PullSilaMaterialsFromErp
{
    /// <summary>Reads the materials of a company code from the ERP (GET_MATERIAL) and upserts them into the material master.</summary>
    public class PullSilaMaterialsFromErpCommand : IRequest<SilaMaterialErpPullResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaMaterialErpPullWriteDto Request { get; set; } = new();
    }
}
