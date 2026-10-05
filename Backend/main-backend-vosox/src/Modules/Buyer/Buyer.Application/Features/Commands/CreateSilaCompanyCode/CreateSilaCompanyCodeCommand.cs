using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaCompanyCode
{
    /// <summary>Adds a Company Code Master row.</summary>
    public class CreateSilaCompanyCodeCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public SilaCompanyCodeWriteDto Request { get; set; } = new();
    }
}
