using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Converts a quantity into the material's base unit (Item Master BaseUnitOfMeasure) with the material's UOM
    /// conversions, e.g. 1 BTL = 750 ML. A conversion can be used in both directions.
    /// </summary>
    public static class UomConverter
    {
        public static string BaseUomOf(ItemBuyerMaster material)
        {
            return string.IsNullOrWhiteSpace(material.BaseUnitOfMeasure) ? "EA" : material.BaseUnitOfMeasure.Trim().ToUpperInvariant();
        }

        public static async Task<Dictionary<Guid, List<MaterialUomConversion>>> GetConversionsAsync(
            IRepositoryWrapper repository, IEnumerable<Guid> materialIds, CancellationToken cancellationToken)
        {
            List<Guid> ids = materialIds.Distinct().ToList();
            List<MaterialUomConversion> conversions = await repository.MaterialUomConversion
                .FindByCondition(x => ids.Contains(x.MaterialId) && x.IsActive)
                .ToListAsync(cancellationToken);
            return conversions.GroupBy(x => x.MaterialId).ToDictionary(x => x.Key, x => x.ToList());
        }

        /// <summary>The quantity in the base unit. An unknown unit is a 400 that names the missing conversion.</summary>
        public static decimal ToBase(
            ILoggerManager logger,
            ItemBuyerMaster material,
            decimal quantity,
            string? uom,
            Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            string baseUom = BaseUomOf(material);
            string unit = string.IsNullOrWhiteSpace(uom) ? baseUom : uom.Trim().ToUpperInvariant();
            if (unit == baseUom)
            {
                return quantity;
            }

            List<MaterialUomConversion> list = conversions.TryGetValue(material.Id, out List<MaterialUomConversion>? found) ? found : new List<MaterialUomConversion>();
            MaterialUomConversion? forward = list.FirstOrDefault(x => Same(x.FromUom, unit) && Same(x.ToUom, baseUom) && x.Factor > 0);
            if (forward != null)
            {
                return quantity * forward.Factor;
            }

            MaterialUomConversion? backward = list.FirstOrDefault(x => Same(x.FromUom, baseUom) && Same(x.ToUom, unit) && x.Factor > 0);
            if (backward != null)
            {
                return quantity / backward.Factor;
            }

            logger.LogError($"No UOM conversion. MaterialId: {material.Id}, From: {unit}, To: {baseUom}");
            throw new BadRequestCustomException(
                "Unit of measure cannot be converted.",
                $"Add a conversion between {unit} and {baseUom} for material {material.MaterialCode}.");
        }

        private static bool Same(string left, string right)
        {
            return string.Equals(left.Trim(), right, StringComparison.OrdinalIgnoreCase);
        }
    }
}
