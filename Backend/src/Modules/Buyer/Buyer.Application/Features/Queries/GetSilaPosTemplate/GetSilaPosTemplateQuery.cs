using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaPosTemplate
{
    /// <summary>An Excel template: the sales upload, or the outlet / item mapping import.</summary>
    public class GetSilaPosTemplateQuery : IRequest<SilaPosFileDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        /// <summary>SALES | OUTLETS | ITEMS</summary>
        public string Kind { get; set; } = string.Empty;
    }
}
