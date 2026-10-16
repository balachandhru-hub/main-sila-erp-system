using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Converts a quantity into the material's base unit (Item Master BaseUnitOfMeasure) with the material's UOM
    /// conversions, e.g. 1 BTL = 750 ML, so 30 ML is 0.04 BTL. A conversion can be used in both directions, and
    /// litres/millilitres and kilograms/grams convert without a material row. Bottle aliases (BOTTLE, BOT, BTL) match.
    /// </summary>
    public static class UomConverter
    {
        public static string BaseUomOf(ItemBuyerMaster material)
        {
            return string.IsNullOrWhiteSpace(material.BaseUnitOfMeasure) ? "EA" : Canonical(material.BaseUnitOfMeasure);
        }

        /// <summary>One code for the units a recipe treats as the same, e.g. BOTTLE and BTL.</summary>
        public static string Canonical(string? uom)
        {
            string key = (uom ?? string.Empty).Trim().ToUpperInvariant();
            return key switch
            {
                "KILO" or "KILOGRAM" or "KILOGRAMS" => "KG",
                "GRAM" or "GRAMS" => "G",
                "LITRE" or "LITER" or "LITRES" or "LITERS" or "LT" => "L",
                "MILLILITRE" or "MILLILITER" or "MILLILITERS" or "MLS" => "ML",
                "EACH" or "UNIT" or "UNITS" => "EA",
                "PIECE" or "PIECES" or "PCS" => "PC",
                "BOTTLE" or "BOTTLES" or "BOT" or "BT" => "BTL",
                _ => key,
            };
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

        /// <summary>The quantity in the base unit, or null when no conversion reaches it.</summary>
        public static decimal? TryToBase(
            ItemBuyerMaster material,
            decimal quantity,
            string? uom,
            Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            string baseUom = BaseUomOf(material);
            string unit = string.IsNullOrWhiteSpace(uom) ? baseUom : Canonical(uom);
            if (unit == baseUom)
            {
                return quantity;
            }

            List<MaterialUomConversion> list = conversions.TryGetValue(material.Id, out List<MaterialUomConversion>? found)
                ? found
                : new List<MaterialUomConversion>();
            return Convert(quantity, unit, baseUom, list);
        }

        /// <summary>The quantity in the base unit. An unknown unit is a 400 that names the missing conversion.</summary>
        public static decimal ToBase(
            ILoggerManager logger,
            ItemBuyerMaster material,
            decimal quantity,
            string? uom,
            Dictionary<Guid, List<MaterialUomConversion>> conversions)
        {
            decimal? result = TryToBase(material, quantity, uom, conversions);
            if (result != null)
            {
                return result.Value;
            }

            string baseUom = BaseUomOf(material);
            string unit = string.IsNullOrWhiteSpace(uom) ? baseUom : Canonical(uom);
            logger.LogError($"No UOM conversion. MaterialId: {material.Id}, From: {unit}, To: {baseUom}");
            throw new BadRequestCustomException(
                "Unit of measure cannot be converted.",
                $"Add a conversion between {unit} and {baseUom} for material {material.MaterialCode}.");
        }

        private static decimal? Convert(decimal quantity, string from, string to, List<MaterialUomConversion> rows)
        {
            Dictionary<string, List<(string To, decimal Factor)>> edges = new Dictionary<string, List<(string, decimal)>>(StringComparer.OrdinalIgnoreCase);
            void Add(string left, string right, decimal factor)
            {
                if (left == right || factor == 0)
                {
                    return;
                }

                if (!edges.TryGetValue(left, out List<(string To, decimal Factor)>? list))
                {
                    list = new List<(string, decimal)>();
                    edges[left] = list;
                }

                list.Add((right, factor));
            }

            Add("KG", "G", 1000m);
            Add("G", "KG", 0.001m);
            Add("L", "ML", 1000m);
            Add("ML", "L", 0.001m);
            foreach (MaterialUomConversion row in rows)
            {
                if (row.Factor <= 0)
                {
                    continue;
                }

                string left = Canonical(row.FromUom);
                string right = Canonical(row.ToUom);
                Add(left, right, row.Factor);
                Add(right, left, 1m / row.Factor);
            }

            Dictionary<string, decimal> visited = new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase) { [from] = 1m };
            Queue<string> queue = new Queue<string>();
            queue.Enqueue(from);
            while (queue.Count > 0)
            {
                string current = queue.Dequeue();
                if (!edges.TryGetValue(current, out List<(string To, decimal Factor)>? next))
                {
                    continue;
                }

                foreach ((string target, decimal factor) in next)
                {
                    if (visited.ContainsKey(target))
                    {
                        continue;
                    }

                    visited[target] = visited[current] * factor;
                    if (target == to)
                    {
                        return decimal.Round(quantity * visited[target], 6, MidpointRounding.AwayFromZero);
                    }

                    queue.Enqueue(target);
                }
            }

            return null;
        }
    }
}
