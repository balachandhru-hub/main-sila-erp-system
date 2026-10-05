using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.DeleteSilaCompanyCode
{
    /// <summary>Removes a company code that no API, property or open purchase order uses.</summary>
    public class DeleteSilaCompanyCodeCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid CompanyCodeId { get; set; }
    }
}
