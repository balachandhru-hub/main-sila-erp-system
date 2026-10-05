using System.Runtime.CompilerServices;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Running document numbers of the SILA ME documents: prefix + the buyer's next sequence, e.g. ITO000001, RI00001.
    /// Numbers are reserved on the buyer's SilaDocumentSequence row (one per prefix, optimistic concurrency through
    /// RowVersion), so two parallel commands never get the same number: the second save fails and SilaRetry re-runs it.
    /// The row is created on first use, seeded from the highest number already stored for that prefix.
    /// </summary>
    public static class DocumentNumber
    {
        public const string INVENTORY_TRANSACTION = "IT";
        public const string TRANSFER = "ITO";
        public const string GOODS_ISSUE = "GI";
        public const string ADJUSTMENT = "ADJ";
        public const string STOCK_COUNT = "SC";
        public const string SHORTAGE_ENQUIRY = "SE";
        public const string POS_BATCH = "PS";
        public const string GOODS_RECEIPT = "GR";
        public const string RECIPE = "RI";
        public const string PRICE_CHANGE = "MP";
        public const string PURCHASE_REQUEST = "PR";
        public const string PHYSICAL_INVENTORY = "PI";
        public const string SUBSTITUTION = "RS";

        private const int SEED_CANDIDATES = 50;

        // Sequence rows reserved by the current command (per scoped repository): a row created in this command is not
        // in the database yet, so a second number of the same prefix must come from here, not from a query.
        private static readonly ConditionalWeakTable<IRepositoryWrapper, Dictionary<(Guid BuyerId, string Prefix), SilaDocumentSequence>> Reserved = new();

        public static string Format(string prefix, int sequence, int digits = 6)
        {
            return $"{prefix}{sequence.ToString().PadLeft(digits, '0')}";
        }

        /// <summary>Reserves and formats the buyer's next number of the prefix. Saved with the command's SaveAsync.</summary>
        public static async Task<string> NextAsync(IRepositoryWrapper repository, Guid buyerId, string prefix, int digits, CancellationToken cancellationToken)
        {
            int next = await ReserveAsync(repository, buyerId, prefix, 1, cancellationToken);
            return Format(prefix, next, digits);
        }

        /// <summary>Reserves <paramref name="count"/> consecutive numbers and returns the first one.</summary>
        public static async Task<int> ReserveAsync(IRepositoryWrapper repository, Guid buyerId, string prefix, int count, CancellationToken cancellationToken)
        {
            Dictionary<(Guid BuyerId, string Prefix), SilaDocumentSequence> reserved = Reserved.GetOrCreateValue(repository);
            if (!reserved.TryGetValue((buyerId, prefix), out SilaDocumentSequence? sequence))
            {
                sequence = await repository.SilaDocumentSequence.FindFirstByConditionAsync(x => x.BuyerId == buyerId && x.Prefix == prefix);
                if (sequence == null)
                {
                    sequence = new SilaDocumentSequence
                    {
                        Id = Guid.NewGuid(),
                        BuyerId = buyerId,
                        Prefix = prefix,
                        LastNumber = await CurrentMaxAsync(repository, buyerId, prefix, cancellationToken),
                        IsActive = true
                    };
                    repository.SilaDocumentSequence.Create(sequence);
                }

                reserved[(buyerId, prefix)] = sequence;
            }

            int first = sequence.LastNumber + 1;
            sequence.LastNumber += Math.Max(1, count);
            return first;
        }

        /// <summary>Forgets the reservations of the repository (after the change tracker was cleared for a retry).</summary>
        public static void Reset(IRepositoryWrapper repository)
        {
            Reserved.Remove(repository);
        }

        /// <summary>Numeric part of a formatted number, or null when it is not "prefix + digits".</summary>
        public static int? ParseSequence(string? number, string prefix)
        {
            if (string.IsNullOrEmpty(number) || !number.StartsWith(prefix, StringComparison.Ordinal) || number.Length == prefix.Length)
            {
                return null;
            }

            string digits = number.Substring(prefix.Length);
            return digits.All(char.IsDigit) && int.TryParse(digits, out int value) ? value : null;
        }

        private static async Task<int> CurrentMaxAsync(IRepositoryWrapper repository, Guid buyerId, string prefix, CancellationToken cancellationToken)
        {
            IQueryable<string> numbers = prefix switch
            {
                INVENTORY_TRANSACTION => repository.InventoryTransaction.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.TransactionNumber),
                TRANSFER => repository.InternalTransferOrder.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.ItoNumber),
                GOODS_ISSUE => repository.GoodsIssue.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.IssueNumber),
                ADJUSTMENT => repository.StockAdjustment.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.AdjustmentNumber),
                STOCK_COUNT => repository.StockCount.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.CountNumber),
                SHORTAGE_ENQUIRY => repository.StockShortageEnquiry.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.EnquiryNumber),
                POS_BATCH => repository.PosSalesBatch.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.BatchNumber),
                GOODS_RECEIPT => repository.GoodsReceipt.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.GrnNumber),
                RECIPE => repository.Recipe.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.RecipeCode),
                PRICE_CHANGE => repository.MaterialPriceChange.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.RequestNumber),
                PURCHASE_REQUEST => repository.InternalPurchaseRequest.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.RequestNumber),
                PHYSICAL_INVENTORY => repository.PhysicalInventoryRequest.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.RequestNumber),
                SUBSTITUTION => repository.RecipeSubstitutionProposal.FindByCondition(x => x.BuyerId == buyerId).Select(x => x.ProposalNumber),
                _ => throw new ArgumentOutOfRangeException(nameof(prefix), prefix, "Unknown SILA document number prefix.")
            };

            // Longest then highest strings first: "prefix + digits" sorts numerically within one length.
            List<string> candidates = await numbers
                .Where(x => x.StartsWith(prefix))
                .OrderByDescending(x => x.Length)
                .ThenByDescending(x => x)
                .Take(SEED_CANDIDATES)
                .ToListAsync(cancellationToken);
            return candidates.Select(x => ParseSequence(x, prefix) ?? 0).DefaultIfEmpty(0).Max();
        }
    }
}
