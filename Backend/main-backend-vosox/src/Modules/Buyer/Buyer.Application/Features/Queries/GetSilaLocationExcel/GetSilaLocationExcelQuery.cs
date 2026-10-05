using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaLocationExcel
{
    /// <summary>The location Excel file: the empty template, or the export of the active locations.</summary>
    public class GetSilaLocationExcelQuery : IRequest<byte[]>
    {
        public Guid OrganizationId { get; set; }
        public bool Template { get; set; }
    }
}
