using System.Globalization;
using System.Text;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// One PDF of a completed goods receipt, stored with the invoice files. A second open does not write another copy.
    /// </summary>
    public static class SilaGrnDocument
    {
        public const string ACTION = "GRN_PDF";

        public static byte[] Pdf(IReadOnlyList<string> lines)
        {
            StringBuilder stream = new StringBuilder();
            stream.Append("BT /F1 11 Tf 40 800 Td 14 TL\n");
            foreach (string line in lines.Take(42))
            {
                stream.Append('(').Append(Escape(line)).Append(") '\n");
            }

            stream.Append("ET");
            string content = stream.ToString();
            string font = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
            string page = "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>";
            string pages = "<< /Type /Pages /Count 1 /Kids [3 0 R] >>";
            string catalog = "<< /Type /Catalog /Pages 2 0 R >>";
            string body = $"5 0 obj\n<< /Length {Encoding.ASCII.GetByteCount(content)} >>\nstream\n{content}\nendstream\nendobj\n";
            List<string> objects = new List<string>
            {
                $"1 0 obj\n{catalog}\nendobj\n",
                $"2 0 obj\n{pages}\nendobj\n",
                $"3 0 obj\n{page}\nendobj\n",
                $"4 0 obj\n{font}\nendobj\n",
                body
            };
            StringBuilder pdf = new StringBuilder();
            pdf.Append("%PDF-1.4\n");
            List<int> offsets = new List<int>();
            foreach (string item in objects)
            {
                offsets.Add(Encoding.ASCII.GetByteCount(pdf.ToString()));
                pdf.Append(item);
            }

            int xref = Encoding.ASCII.GetByteCount(pdf.ToString());
            pdf.Append("xref\n0 6\n0000000000 65535 f \n");
            foreach (int offset in offsets)
            {
                pdf.Append(offset.ToString("0000000000", CultureInfo.InvariantCulture)).Append(" 00000 n \n");
            }

            pdf.Append("trailer << /Size 6 /Root 1 0 R >>\nstartxref\n").Append(xref.ToString(CultureInfo.InvariantCulture)).Append("\n%%EOF");
            return Encoding.ASCII.GetBytes(pdf.ToString());
        }

        /// <summary>Writes the GRN PDF under the invoice folder and remembers the path. Returns the relative path, or null when storage is not available.</summary>
        public static async Task<string?> StoreAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            string? basePath,
            GoodsReceipt receipt,
            Invoice invoice,
            string? sapReference,
            CancellationToken cancellationToken)
        {
            InventoryWorkflowEvent? existing = await repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == receipt.BuyerId && x.IsActive && x.Action == ACTION
                    && x.ReferenceType == Common.SILA_REF_INVOICE && x.ReferenceId == invoice.Id
                    && x.Comment != null && x.Comment.Contains(receipt.Id.ToString("N")))
                .FirstOrDefaultAsync(cancellationToken);
            if (existing != null)
            {
                string? stored = SilaFileRules.ResolveUnderRoot(basePath, existing.Comment);
                if (stored != null && File.Exists(stored))
                {
                    return existing.Comment;
                }
            }

            if (string.IsNullOrWhiteSpace(basePath))
            {
                logger.LogError($"GRN PDF storage is not configured. GoodsReceiptId: {receipt.Id}");
                return null;
            }

            List<GoodsReceiptItem> items = await repository.GoodsReceiptItem
                .FindByCondition(x => x.GoodsReceiptId == receipt.Id && x.IsActive)
                .ToListAsync(cancellationToken);
            InventoryLocation? location = await repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == receipt.LocationId);
            BuyerProperty? property = location == null ? null : await repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == location.PropertyId);
            PurchaseOrder? order = await repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == receipt.PurchaseOrderId);
            List<string> lines = new List<string>
            {
                "Goods receipt",
                "GRN " + receipt.GrnNumber,
                "PO " + receipt.PoNumber,
                "Supplier " + (invoice.SupplierName ?? order?.SupplierName ?? string.Empty),
                "Date " + receipt.DateCreated.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                "Company " + (order?.CompanyCode ?? property?.CompanyCode ?? string.Empty),
                "Plant " + (order?.PlantCode ?? property?.PlantCode ?? string.Empty),
                "Storage " + (location?.StorageLocationCode ?? string.Empty),
                "SAP " + (sapReference ?? string.Empty)
            };
            foreach (GoodsReceiptItem item in items)
            {
                lines.Add($"{item.MaterialCode} {item.MaterialName} {item.AcceptedQty.ToString(CultureInfo.InvariantCulture)} {item.Uom}");
            }

            string relative = Path.Combine(Common.SILA_INVOICE_FOLDER, invoice.Id.ToString("N"), "grn-" + receipt.Id.ToString("N") + ".pdf");
            string? fullPath = SilaFileRules.ResolveUnderRoot(basePath, relative);
            if (fullPath == null)
            {
                logger.LogError($"GRN PDF path leaves storage. GoodsReceiptId: {receipt.Id}");
                return null;
            }

            Directory.CreateDirectory(Path.GetDirectoryName(fullPath)!);
            await File.WriteAllBytesAsync(fullPath, Pdf(lines), cancellationToken);
            repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = receipt.BuyerId,
                ReferenceType = Common.SILA_REF_INVOICE,
                ReferenceId = invoice.Id,
                Action = ACTION,
                Comment = relative.Replace('\\', '/'),
                ActorUserId = receipt.ReceivedBy,
                IsActive = true
            });
            return relative.Replace('\\', '/');
        }

        private static string Escape(string value)
        {
            string text = (value ?? string.Empty).Replace("\\", "\\\\", StringComparison.Ordinal).Replace("(", "\\(", StringComparison.Ordinal).Replace(")", "\\)", StringComparison.Ordinal);
            return text.Length > 110 ? text[..110] : text;
        }
    }
}
