using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpsertSilaMaterialConversion
{
    public class UpsertSilaMaterialConversionCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid MaterialId { get; set; }
        public SilaUomConversionWriteDto Request { get; set; } = new();
    }
}
