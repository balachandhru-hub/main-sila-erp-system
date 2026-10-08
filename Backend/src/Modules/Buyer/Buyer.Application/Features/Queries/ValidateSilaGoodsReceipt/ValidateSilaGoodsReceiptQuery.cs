using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.ValidateSilaGoodsReceipt
{
    /// <summary>Checks a goods receipt before it is posted: open quantity per line, warnings and totals. Nothing is written.</summary>
    public class ValidateSilaGoodsReceiptQuery : IRequest<SilaReceivingGrnValidationDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public SilaReceivingGrnWriteDto Request { get; set; } = new();
    }
}
