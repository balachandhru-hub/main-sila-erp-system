using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Rules of the SILA ME material master: the inventory fields (inventory type, batch / expiry / serial management,
    /// standard and moving average price) and the price status of a material (APPROVED, MISSING, PENDING_APPROVAL).
    /// </summary>
    public static class SilaMaterialRules
    {
        public const string SOURCE_ITEM_MASTER = "ITEM_MASTER";
        public const string PRICE_CONTROL_STANDARD = "S";
        public const string PRICE_CONTROL_MOVING = "V";

        public const string INVENTORY_TYPE_STOCK = "STOCK";
        public const string INVENTORY_TYPE_NON_STOCK = "NON_STOCK";
        public const string INVENTORY_TYPE_SERVICE = "SERVICE";
        public const string PRICE_STATUS_MISSING = "MISSING";
        public const int MAX_SHELF_LIFE_DAYS = 3650;
        public const int MAX_BARCODE_LENGTH = 64;

        public static readonly string[] InventoryTypes = { INVENTORY_TYPE_STOCK, INVENTORY_TYPE_NON_STOCK, INVENTORY_TYPE_SERVICE };

        public static readonly string[] PriceStatuses = { Common.SILA_PRICE_APPROVED, PRICE_STATUS_MISSING, Common.SILA_PRICE_PENDING_APPROVAL };

        private static readonly Regex CurrencyPattern = new Regex("^[A-Z]{3}$", RegexOptions.Compiled);

        /// <summary>
        /// Validates the inventory fields and, when they are valid, copies them onto the material (barcode uniqueness is
        /// checked by the caller). STOCK makes the material an inventory item; an inventory item without a type is STOCK.
        /// </summary>
        public static List<string> Apply(ItemBuyerMaster material, SilaMaterialInventoryWriteDto request)
        {
            List<string> errors = new List<string>();
            string? inventoryType = string.IsNullOrWhiteSpace(request.InventoryType) ? null : request.InventoryType.Trim().ToUpperInvariant();
            if (inventoryType != null && !InventoryTypes.Contains(inventoryType))
            {
                errors.Add("Inventory type must be STOCK, NON_STOCK or SERVICE.");
            }

            bool isInventoryItem = request.IsInventoryItem || inventoryType == INVENTORY_TYPE_STOCK;
            if (isInventoryItem && inventoryType == INVENTORY_TYPE_SERVICE)
            {
                errors.Add("A SERVICE material cannot be an inventory item. Choose STOCK, or clear the inventory item flag.");
            }

            if (isInventoryItem && inventoryType == null)
            {
                inventoryType = INVENTORY_TYPE_STOCK;
            }

            if (request.ExpiryManaged && (request.ShelfLifeDays == null || request.ShelfLifeDays < 1 || request.ShelfLifeDays > MAX_SHELF_LIFE_DAYS))
            {
                errors.Add($"Enter the shelf life in days (1-{MAX_SHELF_LIFE_DAYS}) for an expiry managed material.");
            }

            if (request.StandardPrice < 0 || request.MovingAveragePrice < 0)
            {
                errors.Add("Standard price and moving average price cannot be negative.");
            }

            string? barcode = string.IsNullOrWhiteSpace(request.Barcode) ? null : request.Barcode.Trim();
            if (barcode != null && barcode.Length > MAX_BARCODE_LENGTH)
            {
                errors.Add($"The barcode can have at most {MAX_BARCODE_LENGTH} characters.");
            }

            if (errors.Count > 0)
            {
                return errors;
            }

            material.Barcode = barcode;
            material.InventoryType = inventoryType;
            material.IsInventoryItem = isInventoryItem;
            material.BatchManaged = request.BatchManaged;
            material.ExpiryManaged = request.ExpiryManaged;
            material.ShelfLifeDays = request.ExpiryManaged ? request.ShelfLifeDays : null;
            material.SerialManaged = request.SerialManaged;
            material.StandardPrice = request.StandardPrice;
            material.MovingAveragePrice = request.MovingAveragePrice;
            return errors;
        }

        /// <summary>APPROVED (unit cost set, nothing pending), PENDING_APPROVAL or MISSING.</summary>
        public static string PriceStatusOf(ItemBuyerMaster material, bool hasPendingChange)
        {
            if (hasPendingChange)
            {
                return Common.SILA_PRICE_PENDING_APPROVAL;
            }

            return material.UnitCost != null ? Common.SILA_PRICE_APPROVED : PRICE_STATUS_MISSING;
        }

        /// <summary>The ids of the buyer's materials that have a price change waiting for approval (a server-side subquery).</summary>
        public static IQueryable<Guid> PendingMaterialIds(IRepositoryWrapper repository, Guid buyerId)
        {
            return repository.MaterialPriceChange
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL)
                .Select(x => x.MaterialId);
        }

        /// <summary>The pending price change of each of the materials, in one query.</summary>
        public static async Task<Dictionary<Guid, MaterialPriceChange>> GetPendingChangesAsync(
            IRepositoryWrapper repository, Guid buyerId, IEnumerable<Guid> materialIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = materialIds.Distinct().ToList();
            List<MaterialPriceChange> pending = await repository.MaterialPriceChange
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL && ids.Contains(x.MaterialId))
                .ToListAsync(cancellationToken);
            return pending
                .GroupBy(x => x.MaterialId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(change => change.DateCreated).First());
        }

        /// <summary>Filters materials by price status; an unknown status is ignored by the caller's validation.</summary>
        public static IQueryable<ItemBuyerMaster> FilterByPriceStatus(
            IQueryable<ItemBuyerMaster> query, IRepositoryWrapper repository, Guid buyerId, string? priceStatus)
        {
            if (string.IsNullOrWhiteSpace(priceStatus))
            {
                return query;
            }

            IQueryable<Guid> pending = PendingMaterialIds(repository, buyerId);
            return priceStatus.Trim().ToUpperInvariant() switch
            {
                Common.SILA_PRICE_APPROVED => query.Where(x => x.UnitCost != null && !pending.Contains(x.Id)),
                Common.SILA_PRICE_PENDING_APPROVAL => query.Where(x => pending.Contains(x.Id)),
                PRICE_STATUS_MISSING => query.Where(x => x.UnitCost == null && !pending.Contains(x.Id)),
                _ => query
            };
        }

        public static bool IsCurrency(string? value)
        {
            return value != null && CurrencyPattern.IsMatch(value);
        }

        /// <summary>The material as the material master lists it.</summary>
        public static SilaMaterialDto ToDto(ItemBuyerMaster material, List<MaterialUomConversion>? conversions, MaterialPriceChange? pending)
        {
            return new SilaMaterialDto
            {
                Id = material.Id,
                MaterialCode = material.MaterialCode ?? string.Empty,
                Description = material.Description ?? string.Empty,
                MaterialGroup = material.MaterialGroup,
                BaseUom = UomConverter.BaseUomOf(material),
                UnitCost = material.UnitCost,
                Currency = material.Currency,
                Barcode = material.Barcode,
                IsInventoryItem = material.IsInventoryItem,
                InventoryType = material.InventoryType,
                BatchManaged = material.BatchManaged,
                ExpiryManaged = material.ExpiryManaged,
                ShelfLifeDays = material.ShelfLifeDays,
                SerialManaged = material.SerialManaged,
                StandardPrice = material.StandardPrice,
                MovingAveragePrice = material.MovingAveragePrice,
                PriceStatus = PriceStatusOf(material, pending != null),
                PendingPriceChangeId = pending?.Id,
                ProposedUnitCost = pending?.ProposedUnitCost,
                ProposedPriceUom = pending?.PriceUom,
                Conversions = conversions == null
                    ? new List<SilaUomConversionDto>()
                    : conversions.OrderBy(c => c.FromUom).Select(c => new SilaUomConversionDto
                    {
                        Id = c.Id,
                        FromUom = c.FromUom,
                        ToUom = c.ToUom,
                        Factor = c.Factor
                    }).ToList(),
                Source = material.Source ?? SOURCE_ITEM_MASTER,
                UpdatedAt = material.DateUpdated,
                CompanyCode = material.CompanyCode,
                PriceControl = material.StandardPrice != null ? PRICE_CONTROL_STANDARD : material.MovingAveragePrice != null ? PRICE_CONTROL_MOVING : null,
                ValuationClass = NullIfEmpty(material.ValuationClass),
                MaterialType = NullIfEmpty(material.ProductType),
                Category = NullIfEmpty(material.MaterialGroup),
                AlternateUom = NullIfEmpty(material.AlternateUnitOfMeasure),
                OrderUom = NullIfEmpty(material.OrderUnitOfMeasure)
            };
        }

        /// <summary>The last approved price change of each material (price unit and approval date), in one query.</summary>
        public static async Task ApplyApprovedPricesAsync(
            IRepositoryWrapper repository, Guid buyerId, List<SilaMaterialDto> materials, CancellationToken cancellationToken)
        {
            List<Guid> ids = materials.Select(x => x.Id).ToList();
            Dictionary<Guid, MaterialPriceChange> approved = (await repository.MaterialPriceChange
                    .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.Status == Common.SILA_PRICE_APPROVED && ids.Contains(x.MaterialId))
                    .ToListAsync(cancellationToken))
                .GroupBy(x => x.MaterialId)
                .ToDictionary(x => x.Key, x => x.OrderByDescending(change => change.DecidedOn ?? change.DateCreated).First());
            foreach (SilaMaterialDto material in materials)
            {
                if (approved.TryGetValue(material.Id, out MaterialPriceChange? change))
                {
                    material.ApprovedPriceUom = change.PriceUom ?? material.BaseUom;
                    material.PriceApprovedOn = change.DecidedOn;
                }
                else if (material.UnitCost != null)
                {
                    material.ApprovedPriceUom = material.BaseUom;
                }
            }
        }

        private static string? NullIfEmpty(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value;
        }
    }
}
