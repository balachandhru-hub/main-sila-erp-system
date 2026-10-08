using MediatR;

namespace Supplier.Application.Features.Queries.SupplierCatalog
{
    public class GetSupplierCatalogSubTypesQuery
        : IRequest<List<string>>
    {
        public Guid OrganizationId { get; set; }

        /// <summary>
        /// The Type whose SubTypes should be returned.
        /// </summary>
        public string? SearchTerm { get; set; }

        /// <summary>
        /// Offset of the first SubType (0, 10, 20 ...).
        /// </summary>
        public int Index { get; set; }

        /// <summary>
        /// SubTypes per page (1 to 200; 10 when not given).
        /// </summary>
        public int Limit { get; set; }
    }
}
