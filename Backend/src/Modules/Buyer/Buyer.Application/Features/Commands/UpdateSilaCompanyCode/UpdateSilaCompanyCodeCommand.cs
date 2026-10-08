using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.UpdateSilaCompanyCode
{
    /// <summary>Changes a Company Code Master row; the code itself cannot change while an API or property uses it.</summary>
    public class UpdateSilaCompanyCodeCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid CompanyCodeId { get; set; }
        public SilaCompanyCodeWriteDto Request { get; set; } = new();
    }
}
