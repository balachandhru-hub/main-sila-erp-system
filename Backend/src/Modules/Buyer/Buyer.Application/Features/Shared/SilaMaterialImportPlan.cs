using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>What a validated material Excel import will write: changed materials, conversions and price change requests.</summary>
    public class SilaMaterialImportPlan
    {
        public SilaMaterialImportResultDto Result { get; set; } = new();
        public List<ItemBuyerMaster> ChangedMaterials { get; set; } = new();
        public List<MaterialUomConversion> NewConversions { get; set; } = new();
        public List<MaterialUomConversion> UpdatedConversions { get; set; } = new();
        public List<SilaMaterialExcelRow> PriceRows { get; set; } = new();
        /// <summary>Materials of the file by code (case-insensitive).</summary>
        public Dictionary<string, ItemBuyerMaster> Materials { get; set; } = new(StringComparer.OrdinalIgnoreCase);
        /// <summary>Active conversions per material, including the ones of the file.</summary>
        public Dictionary<Guid, List<MaterialUomConversion>> Conversions { get; set; } = new();

        public bool CanApply => Result.FileErrors.Count == 0 && Result.InvalidRows == 0;
    }
}
