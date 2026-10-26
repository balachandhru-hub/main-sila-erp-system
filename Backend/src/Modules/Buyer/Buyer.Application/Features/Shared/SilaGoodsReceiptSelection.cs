using Buyer.Domain.Common;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Chooses the goods receipts an invoice should use. A receipt on an invoice that was not posted
    /// can be used again. The choice is the smallest set whose quantities equal the invoice lines.
    /// </summary>
    public static class SilaGoodsReceiptSelection
    {
        private const decimal Tolerance = 0.0001m;
        private const int Scale = 10000;
        private const int MaxReceipts = 12;

        public sealed class Line
        {
            public Guid? PurchaseOrderItemId { get; init; }
            public decimal Quantity { get; init; }
        }

        public sealed class Receipt
        {
            public Guid Id { get; init; }
            public string GrnNumber { get; init; } = string.Empty;
            public bool Available { get; init; }
            public List<Line> Lines { get; init; } = new();
        }

        public sealed class Choice
        {
            public List<Guid> Ids { get; init; } = new();
            public string Reason { get; init; } = string.Empty;
        }

        /// <summary>
        /// The invoice already posted, is posting, or is still in review — its goods receipt stays with it.
        /// Failed / cancelled invoices do not hold the GRN.
        /// </summary>
        public static bool Holds(string? status, string? erpStatus)
        {
            if (erpStatus is Common.SILA_POSTING_POSTED or Common.SILA_POSTING_ERP_ACCEPTED)
            {
                return true;
            }

            if (string.IsNullOrWhiteSpace(status))
            {
                return false;
            }

            string normalized = status.Trim().ToUpperInvariant();
            if (normalized is Common.SILA_INVOICE_POSTING_FAILED
                or "CANCELLED"
                or "CANCELED"
                or "REJECTED"
                or "VOID"
                or "REVERSED")
            {
                return false;
            }

            return normalized is Common.SILA_INVOICE_POSTING
                or Common.SILA_INVOICE_POSTED
                or Common.SILA_INVOICE_PENDING_APPROVAL
                or Common.SILA_INVOICE_POSTING_UNKNOWN
                or Common.SILA_INVOICE_LOCAL_FAILED
                or Common.SILA_INVOICE_AWAITING_PAYMENT
                or Common.SILA_INVOICE_PARTIALLY_PAID
                or Common.SILA_INVOICE_PAID
                or Common.SILA_INVOICE_OVERDUE
                or Common.SILA_INVOICE_READY
                or Common.SILA_INVOICE_READY_TO_POST
                or Common.SILA_INVOICE_GRN_POSTED
                or Common.SILA_INVOICE_GRN_IN_PROGRESS
                or Common.SILA_INVOICE_REVIEWED
                or Common.SILA_INVOICE_EXTRACTED
                or Common.SILA_INVOICE_UPLOADED
                or "APPROVED"
                or "READY_FOR_INVOICE_SUBMISSION";
        }

        /// <summary>The smallest available set that equals the invoice. Empty when nothing matches exactly.</summary>
        public static Choice Select(IReadOnlyList<Line> invoiceLines, IReadOnlyList<Receipt> receipts)
        {
            List<Receipt> available = receipts.Where(x => x.Available).Take(MaxReceipts).ToList();
            List<Line> demand = invoiceLines.Where(x => x.Quantity > Tolerance).ToList();
            if (available.Count == 0 || demand.Count == 0)
            {
                return new Choice();
            }

            if (demand.All(x => x.PurchaseOrderItemId != null))
            {
                Choice byItem = Best(demand, available, byItem: true);
                if (byItem.Ids.Count > 0)
                {
                    return byItem;
                }
            }

            return Best(demand, available, byItem: false);
        }

        private static Choice Best(List<Line> demandLines, List<Receipt> available, bool byItem)
        {
            Dictionary<string, long> demand = Bag(demandLines, byItem);
            if (demand.Count == 0)
            {
                return new Choice();
            }

            List<(Receipt Receipt, Dictionary<string, long> Bag)> bags = available
                .Select(receipt => (receipt, Bag(receipt.Lines, byItem)))
                .Where(x => x.Item2.Count > 0)
                .ToList();
            Choice best = new Choice();
            int count = bags.Count;
            int limit = 1 << count;
            for (int mask = 1; mask < limit; mask++)
            {
                Dictionary<string, long> sum = new Dictionary<string, long>();
                List<Guid> ids = new List<Guid>();
                List<string> names = new List<string>();
                for (int index = 0; index < count; index++)
                {
                    if ((mask & (1 << index)) == 0)
                    {
                        continue;
                    }

                    Add(sum, bags[index].Bag);
                    ids.Add(bags[index].Receipt.Id);
                    names.Add(string.IsNullOrWhiteSpace(bags[index].Receipt.GrnNumber) ? "goods receipt" : bags[index].Receipt.GrnNumber);
                }

                if (!Same(sum, demand))
                {
                    continue;
                }

                if (best.Ids.Count == 0 || ids.Count < best.Ids.Count)
                {
                    string list = string.Join(", ", names);
                    best = new Choice
                    {
                        Ids = ids,
                        Reason = ids.Count == 1
                            ? "Exact quantity match: " + list + "."
                            : "Exact quantity match: " + list + ". Together they equal the invoice quantities."
                    };
                }
            }

            return best;
        }

        private static Dictionary<string, long> Bag(IEnumerable<Line> lines, bool byItem)
        {
            Dictionary<string, long> bag = new Dictionary<string, long>();
            foreach (Line line in lines)
            {
                if (line.Quantity <= Tolerance)
                {
                    continue;
                }

                long scaled = Decimal.ToInt64(decimal.Round(line.Quantity * Scale, 0, MidpointRounding.AwayFromZero));
                if (scaled <= 0)
                {
                    continue;
                }

                if (byItem)
                {
                    if (line.PurchaseOrderItemId == null)
                    {
                        continue;
                    }

                    string key = line.PurchaseOrderItemId.Value.ToString("N");
                    bag[key] = bag.TryGetValue(key, out long current) ? current + scaled : scaled;
                }
                else
                {
                    string key = scaled.ToString(System.Globalization.CultureInfo.InvariantCulture);
                    bag[key] = bag.TryGetValue(key, out long current) ? current + 1 : 1;
                }
            }

            return bag;
        }

        private static void Add(Dictionary<string, long> target, Dictionary<string, long> source)
        {
            foreach (KeyValuePair<string, long> pair in source)
            {
                target[pair.Key] = target.TryGetValue(pair.Key, out long current) ? current + pair.Value : pair.Value;
            }
        }

        private static bool Same(Dictionary<string, long> left, Dictionary<string, long> right)
        {
            if (left.Count != right.Count)
            {
                return false;
            }

            foreach (KeyValuePair<string, long> pair in left)
            {
                if (!right.TryGetValue(pair.Key, out long value) || value != pair.Value)
                {
                    return false;
                }
            }

            return true;
        }
    }
}
