using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SaveSilaOcrConfiguration
{
    /// <summary>Saves how the buyer's invoices are read.</summary>
    public class SaveSilaOcrConfigurationCommand : IRequest<SilaOcrConfigurationDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public SilaOcrConfigurationWriteDto Request { get; set; } = new();
    }
}
