using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.CreateSilaCreditMemo
{
    public class CreateSilaCreditMemoCommand : IRequest<SilaCreditMemoDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public SilaCreditMemoWriteDto Request { get; set; } = new();
    }
}
