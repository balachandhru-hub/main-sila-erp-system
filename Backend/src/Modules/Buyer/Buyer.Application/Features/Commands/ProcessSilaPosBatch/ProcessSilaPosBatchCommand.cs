using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ProcessSilaPosBatch
{
    /// <summary>Processes the RECEIVED lines of a previewed batch: match, deduct stock, queue the ERP posting.</summary>
    public class ProcessSilaPosBatchCommand : IRequest<SilaPosImportResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        public Guid RoleId { get; set; }
        public Guid BatchId { get; set; }
    }
}
