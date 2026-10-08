using MediatR;

namespace Supplier.Application.Features.Queries.SupplierCatalog
{
    public class GetSupplierCatalogTypesQuery
        : IRequest<List<string>>
    {
        public Guid OrganizationId { get; set; }
        public string? SearchTerm { get; set; }

        /// <summary>
        /// Offset of the first Type (0, 10, 20 ...).
        /// </summary>
        public int Index { get; set; }

        /// <summary>
        /// Types per page (1 to 200; 10 when not given).
        /// </summary>
        public int Limit { get; set; }
    }
}
