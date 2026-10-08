using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Material price changes: a new unit price never overwrites the approved one directly. It is stored as a
    /// MaterialPriceChange (MP000001) that goes through the MATERIAL_PRICE approval flow; the last approval writes the
    /// price, converted to the base unit, to the material. Used by the price panel, the Excel import and the ERP pull.
    /// </summary>
    public static class SilaMaterialPricing
    {
        public const string NUMBER_PREFIX = "MP";
        public const int APPROVAL_VERSION = 1;
        public const int MAX_REASON_LENGTH = 500;

        /// <summary>The approval scope of a price change: the company code of the buyer's first property, if any.</summary>
        public static async Task<ApprovalScope> GetScopeAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            string? companyCode = await repository.BuyerProperty
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .OrderBy(x => x.DateCreated)
                .Select(x => x.CompanyCode)
                .FirstOrDefaultAsync(cancellationToken);
            return new ApprovalScope { CompanyCode = string.IsNullOrWhiteSpace(companyCode) ? null : companyCode };
        }

        /// <summary>
        /// Checks a requested price: greater than zero, a 3-letter currency (default: the current currency of the
        /// material), a price unit the material can convert to its base unit and a reason. Returns the problems found.
        /// </summary>
        public static List<string> Validate(
            ILoggerManager logger,
            ItemBuyerMaster material,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            decimal unitPrice,
            string? currency,
            string? priceUom,
            string? reason,
            out string normalizedCurrency,
            out string normalizedUom)
        {
            List<string> errors = new List<string>();
            normalizedCurrency = string.IsNullOrWhiteSpace(currency) ? material.Currency?.Trim().ToUpperInvariant() ?? string.Empty : currency.Trim().ToUpperInvariant();
            normalizedUom = string.IsNullOrWhiteSpace(priceUom) ? UomConverter.BaseUomOf(material) : priceUom.Trim().ToUpperInvariant();
            if (unitPrice <= 0 || unitPrice > SilaInputRules.MAX_QUANTITY)
            {
                errors.Add("Enter a unit price greater than zero and at most 1,000,000,000.");
            }

            if (normalizedUom.Length > SilaInputRules.CODE_LENGTH)
            {
                errors.Add($"The price unit can have at most {SilaInputRules.CODE_LENGTH} characters.");
            }

            if (!SilaMaterialRules.IsCurrency(normalizedCurrency))
            {
                errors.Add("Enter the 3-letter currency code of the price, e.g. AED.");
            }

            if (string.IsNullOrWhiteSpace(reason))
            {
                errors.Add("Enter the reason for the price change.");
            }
            else if (reason.Trim().Length > MAX_REASON_LENGTH)
            {
                errors.Add($"The reason can have at most {MAX_REASON_LENGTH} characters.");
            }

            try
            {
                _ = UomConverter.ToBase(logger, material, 1, normalizedUom, conversions);
            }
            catch (BadRequestCustomException)
            {
                errors.Add($"Add a conversion between {normalizedUom} and {UomConverter.BaseUomOf(material)} first, or price the material in its base unit.");
            }

            return errors;
        }

        /// <summary>
        /// Creates the price change and starts its approval (MATERIAL_PRICE flow, version 1). Throws 400 when the
        /// request is invalid or no flow exists, 409 when a change of the material is already waiting. The caller saves.
        /// </summary>
        public static async Task<MaterialPriceChange> CreateAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            ItemBuyerMaster material,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            decimal unitPrice,
            string? currency,
            string? priceUom,
            DateTime? effectiveFrom,
            string reason,
            Guid userId,
            ApprovalScope scope,
            CancellationToken cancellationToken,
            Guid? outletLocationId = null)
        {
            if (outletLocationId != null)
            {
                bool outlet = await repository.InventoryLocation
                    .FindByCondition(x => x.Id == outletLocationId && x.BuyerId == buyerId && x.IsActive && x.LocationType == Common.SILA_LOCATION_OUTLET)
                    .AnyAsync(cancellationToken);
                if (!outlet)
                {
                    logger.LogError($"Price change outlet not found. OutletLocationId: {outletLocationId}, BuyerId: {buyerId}");
                    throw new NotFoundCustomException("Outlet not found.", "Select an active outlet location of this organization, or leave it empty for the default price.");
                }
            }

            List<string> errors = Validate(logger, material, conversions, unitPrice, currency, priceUom, reason, out string normalizedCurrency, out string normalizedUom);
            if (errors.Count > 0)
            {
                logger.LogError($"Invalid price change. MaterialId: {material.Id}, Errors: {errors.Count}");
                throw new BadRequestCustomException("The price change is not valid.", string.Join(" ", errors));
            }

            bool pending = await repository.MaterialPriceChange
                .FindByCondition(x => x.BuyerId == buyerId && x.MaterialId == material.Id && x.IsActive && x.Status == Common.SILA_PRICE_PENDING_APPROVAL)
                .AnyAsync(cancellationToken);
            if (pending)
            {
                logger.LogError($"Price change already pending. MaterialId: {material.Id}");
                throw new ConflictCustomException(
                    "A price change is already waiting for approval.",
                    $"Wait until the pending price change of {material.MaterialCode} is approved or rejected.");
            }

            MaterialPriceChange change = new MaterialPriceChange
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                RequestNumber = await DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.PRICE_CHANGE, 6, cancellationToken),
                MaterialId = material.Id,
                OutletLocationId = outletLocationId,
                CurrentUnitCost = outletLocationId == null
                    ? material.UnitCost
                    : await repository.MaterialOutletPrice
                        .FindByCondition(x => x.BuyerId == buyerId && x.MaterialId == material.Id && x.OutletLocationId == outletLocationId && x.IsActive)
                        .Select(x => (decimal?)x.UnitCost)
                        .FirstOrDefaultAsync(cancellationToken) ?? material.UnitCost,
                ProposedUnitCost = unitPrice,
                Currency = normalizedCurrency,
                PriceUom = normalizedUom,
                EffectiveFrom = effectiveFrom?.Date,
                Reason = reason.Trim(),
                Status = Common.SILA_PRICE_PENDING_APPROVAL,
                RequestedBy = userId,
                IsActive = true
            };

            // Starting first: no change row is added when the flow is missing.
            await SilaApprovals.StartAsync(
                repository, logger, buyerId, Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE, Common.SILA_REF_MATERIAL_PRICE,
                change.Id, APPROVAL_VERSION, scope, cancellationToken);
            repository.MaterialPriceChange.Create(change);
            return change;
        }

        /// <summary>
        /// Writes an approved change: the price per base unit and the currency, to the material (default price) or, for an
        /// outlet change, to the outlet price of the material. The caller saves.
        /// </summary>
        public static async Task ApplyApprovedAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            MaterialPriceChange change,
            ItemBuyerMaster material,
            Dictionary<Guid, List<MaterialUomConversion>> conversions,
            CancellationToken cancellationToken)
        {
            decimal baseQuantity = UomConverter.ToBase(logger, material, 1, change.PriceUom, conversions);
            decimal unitCost = Math.Round(change.ProposedUnitCost / baseQuantity, 4);
            if (change.OutletLocationId == null)
            {
                material.UnitCost = unitCost;
                material.Currency = change.Currency;
                repository.ItemBuyerMaster.Update(material);
                return;
            }

            MaterialOutletPrice? price = await repository.MaterialOutletPrice.FindFirstByConditionAsync(
                x => x.BuyerId == change.BuyerId && x.MaterialId == material.Id && x.OutletLocationId == change.OutletLocationId);
            if (price == null)
            {
                repository.MaterialOutletPrice.Create(new MaterialOutletPrice
                {
                    Id = Guid.NewGuid(),
                    BuyerId = change.BuyerId,
                    MaterialId = material.Id,
                    OutletLocationId = change.OutletLocationId.Value,
                    UnitCost = unitCost,
                    Currency = change.Currency,
                    IsActive = true
                });
                return;
            }

            price.UnitCost = unitCost;
            price.Currency = change.Currency;
            price.IsActive = true;
            repository.MaterialOutletPrice.Update(price);
        }
    }
}
