namespace Buyer.Domain.Dtos
{
    /// <summary>A material's stock per location, within the properties of the caller's locations.</summary>
    public class SilaLiveInventoryDetailDto
    {
        public Guid MaterialId { get; set; }
        public string MaterialCode { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string BaseUom { get; set; } = string.Empty;
        public decimal? UnitCost { get; set; }
        public string? Currency { get; set; }
        public decimal OnHandQty { get; set; }
        public decimal InTransitQty { get; set; }
        public List<SilaLiveInventoryLocationDto> Locations { get; set; } = new();
        /// <summary>The location the recommendation is for (the requested one, else the caller's first location).</summary>
        public Guid? CurrentLocationId { get; set; }
        public decimal RequiredQty { get; set; }
        /// <summary>On hand at the current location.</summary>
        public decimal LocalAvailable { get; set; }
        /// <summary>Required minus what the current location has, never below zero.</summary>
        public decimal Shortage { get; set; }
        /// <summary>SUFFICIENT | REQUEST_TRANSFER | CREATE_PR | NO_LOCATION</summary>
        public string Recommendation { get; set; } = string.Empty;
        public string RecommendationReason { get; set; } = string.Empty;
        /// <summary>REQUEST_TRANSFER, QUICK_TRANSFER, ADD_TO_LOCATION, ONE_TIME_TRANSFER, REDISTRIBUTE_STOCK, CREATE_PR, REQUEST_ITEM, REQUEST_PHYSICAL_INVENTORY, most useful first.</summary>
        public List<string> NextActions { get; set; } = new();
        /// <summary>The location of the same property with the most transferable stock.</summary>
        public Guid? BestSourceLocationId { get; set; }
        public string? BestSourceName { get; set; }
        public decimal BestSourceTransferableQty { get; set; }

        /// <summary>STOCK | NON_STOCK | SERVICE from the material master.</summary>
        public string? InventoryType { get; set; }
        public bool InventoryItem { get; set; }
        public bool BatchManaged { get; set; }
        public bool ExpiryManaged { get; set; }
        public bool SerialManaged { get; set; }

        /// <summary>The current location has no active stocking row for the material.</summary>
        public bool NotStockedAtLocation { get; set; }

        /// <summary>ACTIVE | INACTIVE | NOT_STOCKED at the current location.</summary>
        public string? LocalStockingStatus { get; set; }

        /// <summary>REDISTRIBUTE_STOCK target: a location of the property under its threshold the current location can supply.</summary>
        public Guid? RedistributeToLocationId { get; set; }
        public string? RedistributeToName { get; set; }
        public decimal RedistributeQty { get; set; }
    }
}
