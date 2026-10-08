using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// How an invoice is matched to its supplier (Supplier Master by tax number, name or alias; or the suppliers of the
    /// buyer's purchase orders), to a purchase order of that supplier and to the purchase order lines.
    /// </summary>
    public static class SilaInvoiceMatching
    {
        /// <summary>Score from which a supplier is matched automatically after a reading.</summary>
        public const int AUTO_MATCH_SCORE = 85;

        private const int CANDIDATE_LIMIT = 10;
        private const int MINIMUM_SCORE = 40;

        public const string SOURCE_MASTER = "MASTER";
        public const string SOURCE_PURCHASE_ORDER = "PURCHASE_ORDER";

        /// <summary>The suppliers the invoice may come from, best first (at most 10).</summary>
        public static async Task<List<SilaInvoiceSupplierCandidateDto>> CandidatesAsync(
            IRepositoryWrapper repository, Guid buyerId, string? name, string? taxNumber, CancellationToken cancellationToken)
        {
            List<SilaInvoiceSupplierCandidateDto> candidates = new List<SilaInvoiceSupplierCandidateDto>();
            string taxKey = SilaMasterDataRules.TaxKey(taxNumber);
            List<string> words = SilaMasterDataRules.NameKey(name).Split(' ', StringSplitOptions.RemoveEmptyEntries).Where(x => x.Length >= 3).Take(5).ToList();

            // Pre-filtered in the database by tax number or one distinctive word at a time (at most 5 small queries), scored in memory.
            List<SilaSupplier> suppliers = new List<SilaSupplier>();
            if (taxKey.Length > 0)
            {
                suppliers.AddRange(await repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == SilaMasterDataRules.STATUS_ACTIVE
                        && x.TaxNumber != null && x.TaxNumber.Replace(" ", string.Empty).Replace("-", string.Empty) == taxKey)
                    .Take(20)
                    .ToListAsync(cancellationToken));
            }

            foreach (string word in words)
            {
                suppliers.AddRange(await repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == SilaMasterDataRules.STATUS_ACTIVE
                        && (x.Name.Contains(word) || (x.Aliases != null && x.Aliases.Contains(word))))
                    .Take(50)
                    .ToListAsync(cancellationToken));
            }

            suppliers = suppliers.DistinctBy(x => x.Id).ToList();
            foreach (SilaSupplier supplier in suppliers)
            {
                (int score, string reason) = Score(supplier, name, taxKey);
                if (score >= MINIMUM_SCORE)
                {
                    candidates.Add(new SilaInvoiceSupplierCandidateDto
                    {
                        SilaSupplierId = supplier.Id,
                        SupplierId = supplier.SupplierOrganizationId,
                        SupplierCode = supplier.SupplierCode,
                        Name = supplier.Name,
                        TaxNumber = supplier.TaxNumber,
                        Source = SOURCE_MASTER,
                        Score = score,
                        Reason = reason
                    });
                }
            }

            if (words.Count > 0)
            {
                List<(Guid SupplierId, string? SupplierName)> poSuppliers = new List<(Guid, string?)>();
                foreach (string word in words)
                {
                    poSuppliers.AddRange((await repository.PurchaseOrder
                            .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.SupplierName != null && x.SupplierName.Contains(word))
                            .Select(x => new { x.SupplierId, x.SupplierName })
                            .Distinct()
                            .Take(50)
                            .ToListAsync(cancellationToken))
                        .Select(x => (x.SupplierId, x.SupplierName)));
                }

                foreach ((Guid supplierId, string? supplierName) in poSuppliers.DistinctBy(x => x.SupplierId))
                {
                    int score = SilaMasterDataRules.Similarity(name, supplierName);
                    if (score >= MINIMUM_SCORE && candidates.All(x => x.SupplierId != supplierId && x.SilaSupplierId != supplierId))
                    {
                        candidates.Add(new SilaInvoiceSupplierCandidateDto
                        {
                            SupplierId = supplierId,
                            Name = supplierName ?? string.Empty,
                            Source = SOURCE_PURCHASE_ORDER,
                            Score = score,
                            Reason = score == 100 ? "Same name as on purchase orders" : "Similar name on purchase orders"
                        });
                    }
                }
            }

            return candidates.OrderByDescending(x => x.Score).ThenBy(x => x.Name).Take(CANDIDATE_LIMIT).ToList();
        }

        /// <summary>The ids a purchase order of this invoice's supplier may carry (network supplier, Supplier Master row).</summary>
        public static async Task<List<Guid>> SupplierKeysAsync(IRepositoryWrapper repository, Invoice invoice, CancellationToken cancellationToken)
        {
            List<Guid> keys = new List<Guid>();
            if (invoice.SupplierId != null)
            {
                keys.Add(invoice.SupplierId.Value);
            }

            if (invoice.SilaSupplierId != null)
            {
                keys.Add(invoice.SilaSupplierId.Value);
                Guid? network = await repository.SilaSupplier
                    .FindByCondition(x => x.Id == invoice.SilaSupplierId.Value)
                    .Select(x => x.SupplierOrganizationId)
                    .FirstOrDefaultAsync(cancellationToken);
                if (network != null)
                {
                    keys.Add(network.Value);
                }
            }

            return keys.Distinct().ToList();
        }

        /// <summary>The purchase order line whose material code or product name appears in the invoice line.</summary>
        public static Guid? MatchLine(string description, IReadOnlyList<PurchaseOrderItem> poItems)
        {
            PurchaseOrderItem? match = poItems.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.MaterialCode)
                    && description.Contains(x.MaterialCode.Trim(), StringComparison.OrdinalIgnoreCase))
                ?? poItems.FirstOrDefault(x => !string.IsNullOrWhiteSpace(x.ProductName)
                    && (description.Contains(x.ProductName.Trim(), StringComparison.OrdinalIgnoreCase)
                        || x.ProductName.Contains(description, StringComparison.OrdinalIgnoreCase)));
            return match?.Id;
        }

        private static (int Score, string Reason) Score(SilaSupplier supplier, string? name, string taxKey)
        {
            if (taxKey.Length > 0 && SilaMasterDataRules.TaxKey(supplier.TaxNumber) == taxKey)
            {
                return (100, "Same tax number");
            }

            int best = SilaMasterDataRules.Similarity(name, supplier.Name);
            string reason = best == 100 ? "Same name" : "Similar name";
            foreach (string alias in SilaMasterDataRules.SplitAliases(supplier.Aliases))
            {
                int score = SilaMasterDataRules.Similarity(name, alias);
                if (score > best)
                {
                    best = score;
                    reason = score == 100 ? "Same as an alias" : "Similar to an alias";
                }
            }

            return (best, reason);
        }
    }
}
