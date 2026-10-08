using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The buyer's quick-transfer policy (one row per buyer) and its enforcement on quick transfers. A buyer without a
    /// saved policy uses the defaults: enabled, no manager approval, outlet to outlet allowed, source confirmation required.
    /// </summary>
    public static class SilaQuickTransferRules
    {
        public const string ALERT_QUICK_TRANSFER = "QUICK_TRANSFER";
        public static readonly string[] LocationTypes = { Common.SILA_LOCATION_STORE, Common.SILA_LOCATION_OUTLET };

        /// <summary>The saved policy, or the default policy (not stored) when the buyer has none.</summary>
        public static async Task<QuickTransferPolicy> GetPolicyAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            QuickTransferPolicy? policy = await repository.QuickTransferPolicy
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            return policy ?? Default(buyerId);
        }

        public static QuickTransferPolicy Default(Guid buyerId)
        {
            return new QuickTransferPolicy
            {
                BuyerId = buyerId,
                Enabled = true,
                MaximumQuantity = null,
                SkipManagerApproval = true,
                OutletToOutletAllowed = true,
                SourceConfirmationRequired = true,
                IsActive = true
            };
        }

        public static SilaQuickTransferPolicyDto ToDto(QuickTransferPolicy policy)
        {
            return new SilaQuickTransferPolicyDto
            {
                Enabled = policy.Enabled,
                MaximumQuantity = policy.MaximumQuantity,
                SkipManagerApproval = policy.SkipManagerApproval,
                OutletToOutletAllowed = policy.OutletToOutletAllowed,
                SourceConfirmationRequired = policy.SourceConfirmationRequired,
                MaximumValue = policy.MaximumValue,
                DestinationConfirmationRequired = policy.DestinationConfirmationRequired ?? true,
                ManagerNotification = policy.ManagerNotification ?? false,
                AllowedSourceTypes = Types(policy.AllowedSourceTypes),
                AllowedDestinationTypes = Types(policy.AllowedDestinationTypes)
            };
        }

        /// <summary>"STORE,OUTLET" to [STORE, OUTLET]; null or empty is [] (all types).</summary>
        public static List<string> Types(string? list)
        {
            return string.IsNullOrWhiteSpace(list)
                ? new List<string>()
                : list.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
        }

        /// <summary>Validated, upper-cased, distinct types as a comma list; null when empty or all types.</summary>
        public static string? JoinTypes(ILoggerManager logger, List<string>? types, string field)
        {
            List<string> values = (types ?? new List<string>())
                .Where(x => !string.IsNullOrWhiteSpace(x))
                .Select(x => SilaInputRules.OneOf(logger, x, LocationTypes, field))
                .Distinct()
                .ToList();
            return values.Count == 0 || values.Count == LocationTypes.Length ? null : string.Join(",", values);
        }

        /// <summary>Refuses a quick transfer the policy does not allow. Quantities are the base quantities of the lines.</summary>
        public static void Enforce(
            ILoggerManager logger, QuickTransferPolicy policy, InventoryLocation from, InventoryLocation to, List<InternalTransferOrderItem> items,
            decimal? totalValue = null)
        {
            if (!policy.Enabled)
            {
                logger.LogError($"Quick transfers are disabled. BuyerId: {policy.BuyerId}");
                throw new BadRequestCustomException("Quick transfers are disabled.", "Raise a standard transfer, or ask your administrator to enable quick transfers.");
            }

            if (!policy.OutletToOutletAllowed
                && from.LocationType == Common.SILA_LOCATION_OUTLET
                && to.LocationType == Common.SILA_LOCATION_OUTLET)
            {
                logger.LogError($"Outlet to outlet quick transfer refused. From: {from.Id}, To: {to.Id}");
                throw new BadRequestCustomException("Quick transfers between outlets are not allowed.", "Raise a standard transfer, or take the stock from a store.");
            }

            List<string> sources = Types(policy.AllowedSourceTypes);
            if (sources.Count > 0 && !sources.Contains(from.LocationType))
            {
                logger.LogError($"Quick transfer source type not allowed. From: {from.Id}, Type: {from.LocationType}");
                throw new BadRequestCustomException(
                    $"Quick transfers from a {from.LocationType.ToLowerInvariant()} are not allowed.",
                    "Raise a standard transfer, or take the stock from an allowed location type.");
            }

            List<string> destinations = Types(policy.AllowedDestinationTypes);
            if (destinations.Count > 0 && !destinations.Contains(to.LocationType))
            {
                logger.LogError($"Quick transfer destination type not allowed. To: {to.Id}, Type: {to.LocationType}");
                throw new BadRequestCustomException(
                    $"Quick transfers to a {to.LocationType.ToLowerInvariant()} are not allowed.",
                    "Raise a standard transfer instead.");
            }

            if (policy.MaximumValue != null && totalValue != null && totalValue.Value > policy.MaximumValue.Value)
            {
                logger.LogError($"Quick transfer above the maximum value. Value: {totalValue}, Maximum: {policy.MaximumValue}");
                throw new BadRequestCustomException(
                    "The quick transfer is above the maximum value.",
                    $"Quick transfer at most {policy.MaximumValue.Value:0.##} in value, or raise a standard transfer.");
            }

            if (policy.MaximumQuantity != null)
            {
                InternalTransferOrderItem? tooLarge = items.FirstOrDefault(x => x.RequestedQty > policy.MaximumQuantity.Value);
                if (tooLarge != null)
                {
                    logger.LogError($"Quick transfer line above the maximum. MaterialId: {tooLarge.MaterialId}, Quantity: {tooLarge.RequestedQty}");
                    throw new BadRequestCustomException(
                        $"{tooLarge.MaterialName} is above the quick-transfer maximum.",
                        $"Quick transfer at most {policy.MaximumQuantity.Value:0.####} per line, or raise a standard transfer.");
                }
            }
        }
    }
}
