using MediatR;
using Supplier.Domain.Dto;

namespace Supplier.Application.Features.Queries.BuyerCatalog
{
    public class GetBuyerCatalogQuery : IRequest<List<BuyerCatalogDto>>
    {
        public long? Segment { get; set; }

        public long? Family { get; set; }

        public long? Class { get; set; }

        public long? Commodity { get; set; }

        public string? Search { get; set; }

        /// <summary>
        /// Supplier filter: part of the supplier's name or of its SNID.
        /// </summary>
        public string? Supplier { get; set; }

        /// <summary>
        /// Offset of the first product (0, 24, 48 ...).
        /// </summary>
        public int Index { get; set; }

        /// <summary>
        /// Products per page (1 to 200; 20 when not given).
        /// </summary>
        public int Limit { get; set; }

        /// <summary>
        /// Order of the products: name (default), name_desc, price or price_desc.
        /// </summary>
        public string? Sort { get; set; }
    }
}
