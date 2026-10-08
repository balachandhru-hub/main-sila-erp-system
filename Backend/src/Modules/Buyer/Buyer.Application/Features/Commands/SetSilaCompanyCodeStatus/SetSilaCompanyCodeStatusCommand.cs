using MediatR;

namespace Buyer.Application.Features.Commands.SetSilaCompanyCodeStatus
{
    /// <summary>Suspends (INACTIVE) or activates (ACTIVE) a company code of the Company Code Master.</summary>
    public class SetSilaCompanyCodeStatusCommand : IRequest<Guid>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid CompanyCodeId { get; set; }
        /// <summary>ACTIVE | INACTIVE</summary>
        public string Status { get; set; } = string.Empty;
    }
}
