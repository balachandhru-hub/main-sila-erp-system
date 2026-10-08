using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.ImportSilaSuppliers
{
    /// <summary>Checks or imports the Supplier Master Excel file (all-or-nothing).</summary>
    public class ImportSilaSuppliersCommand : IRequest<SilaMasterImportResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid UserId { get; set; }
        /// <summary>False checks the file and writes nothing (preview); true writes every row, or nothing when a row is invalid.</summary>
        public bool Commit { get; set; }
        public string FileName { get; set; } = string.Empty;
        public byte[] Content { get; set; } = Array.Empty<byte>();
    }
}
