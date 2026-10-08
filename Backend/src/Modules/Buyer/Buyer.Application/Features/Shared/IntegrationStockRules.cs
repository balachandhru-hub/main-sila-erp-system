using System.Text.Json;
using Buyer.Domain.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Reads one mapped record of the buyer's stock API. Used by the pull of that API and by the live
    /// stock lookup, so both read a record the same way. A record that lacks a required value is
    /// reported as <see cref="InvalidOperationException"/>; the caller decides what that means.
    /// </summary>
    public static class IntegrationStockRules
    {
        public static StockInHandItemDto ReadStock(IReadOnlyList<ApiFieldMapping> mappings, JsonElement record)
        {
            string? materialCode = IntegrationRecordReader.Read(mappings, "Stock.MaterialCode", record);
            decimal? quantity = IntegrationRecordReader.ParseDecimal(IntegrationRecordReader.Read(mappings, "Stock.Quantity", record));
            if (string.IsNullOrWhiteSpace(materialCode) || quantity == null)
            {
                throw new InvalidOperationException("Material code and quantity are required.");
            }

            return new StockInHandItemDto
            {
                MaterialCode = materialCode,
                Quantity = quantity.Value,
                Plant = IntegrationRecordReader.Read(mappings, "Stock.Plant", record),
                StorageLocation = IntegrationRecordReader.Read(mappings, "Stock.StorageLocation", record),
                Uom = IntegrationRecordReader.Read(mappings, "Stock.Uom", record)
            };
        }
    }
}
