using MediatR;

namespace Buyer.Application.Features.Queries.ExportSilaMaterials
{
    /// <summary>The material Excel file: the empty template, or the buyer's materials (filtered) with their conversions.</summary>
    public class ExportSilaMaterialsQuery : IRequest<byte[]>
    {
        public Guid OrganizationId { get; set; }
        public bool TemplateOnly { get; set; }
        public string? Search { get; set; }
        public string? PriceStatus { get; set; }
        public bool InventoryOnly { get; set; }
    }
}
