using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DeleteSilaMaterialConversion
{
    public class DeleteSilaMaterialConversionCommand : IRequest<Unit>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid MaterialId { get; set; }
        public Guid ConversionId { get; set; }
    }
}
