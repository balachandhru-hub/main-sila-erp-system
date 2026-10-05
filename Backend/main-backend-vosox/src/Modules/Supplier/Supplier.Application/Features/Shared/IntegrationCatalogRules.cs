using System.Text.Json;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using Supplier.Domain.Dto;

namespace Supplier.Application.Features.Shared
{
    /// <summary>
    /// Reads one mapped record of a supplier's catalog or product stock API. A record that lacks a
    /// required value is reported as <see cref="InvalidOperationException"/>; the run counts it as failed.
    /// </summary>
    public static class IntegrationCatalogRules
    {
        public static SupplierCatalogSyncItemDto ReadCatalogItem(IntegrationProcessType processType, IReadOnlyList<ApiFieldMapping> mappings, JsonElement record)
        {
            if (processType == IntegrationProcessType.GET_CATALOG_STOCK)
            {
                string? stockSku = IntegrationRecordReader.Read(mappings, "CatalogStock.Sku", record);
                decimal? stock = IntegrationRecordReader.ParseDecimal(IntegrationRecordReader.Read(mappings, "CatalogStock.AvailableStock", record));
                if (string.IsNullOrWhiteSpace(stockSku) || stock == null || stock < 0)
                {
                    throw new InvalidOperationException("SKU and a stock of zero or more are required.");
                }

                return new SupplierCatalogSyncItemDto
                {
                    Sku = stockSku,
                    AvailableStock = stock,
                    DiscountPercent = IntegrationRecordReader.ParseDecimal(IntegrationRecordReader.Read(mappings, "CatalogStock.DiscountPercent", record))
                };
            }

            string? sku = IntegrationRecordReader.Read(mappings, "Catalog.Sku", record);
            string? name = IntegrationRecordReader.Read(mappings, "Catalog.Name", record);
            decimal? price = IntegrationRecordReader.ParseDecimal(IntegrationRecordReader.Read(mappings, "Catalog.Price", record));
            string? currency = IntegrationRecordReader.Read(mappings, "Catalog.Currency", record);
            string? unitOfMeasure = IntegrationRecordReader.Read(mappings, "Catalog.UnitOfMeasure", record);
            if (string.IsNullOrWhiteSpace(sku) || string.IsNullOrWhiteSpace(name) || price == null || price < 0
                || string.IsNullOrWhiteSpace(currency) || string.IsNullOrWhiteSpace(unitOfMeasure))
            {
                throw new InvalidOperationException("SKU, name, price, currency and unit of measure are required.");
            }

            return new SupplierCatalogSyncItemDto
            {
                Sku = sku,
                Name = name,
                Description = IntegrationRecordReader.Read(mappings, "Catalog.Description", record),
                Price = price,
                Currency = currency,
                UnitOfMeasure = unitOfMeasure,
                AvailableStock = IntegrationRecordReader.ParseDecimal(IntegrationRecordReader.Read(mappings, "Catalog.AvailableStock", record)),
                DiscountPercent = IntegrationRecordReader.ParseDecimal(IntegrationRecordReader.Read(mappings, "Catalog.DiscountPercent", record))
            };
        }
    }
}
