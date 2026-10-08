namespace Buyer.Domain.Dtos
{
    /// <summary>The buyer's quick-transfer policy (read and write).</summary>
    public class SilaQuickTransferPolicyDto
    {
        /// <summary>Quick transfers may be raised.</summary>
        public bool Enabled { get; set; } = true;
        /// <summary>Largest quantity of one line, in the base unit; null = no limit.</summary>
        public decimal? MaximumQuantity { get; set; }
        /// <summary>A quick transfer needs no approval of the source location.</summary>
        public bool SkipManagerApproval { get; set; } = true;
        /// <summary>Quick transfers from one outlet to another outlet are allowed.</summary>
        public bool OutletToOutletAllowed { get; set; } = true;
        /// <summary>Stock recorded as already collected waits for the source location to confirm the handover.</summary>
        public bool SourceConfirmationRequired { get; set; } = true;

        /// <summary>Largest value (quantity Ã— unit cost) of one quick transfer; null = no limit.</summary>
        public decimal? MaximumValue { get; set; }

        /// <summary>The destination confirms the receipt; false posts the stock straight to the destination.</summary>
        public bool DestinationConfirmationRequired { get; set; } = true;

        /// <summary>Every quick transfer raises an alert for the source location.</summary>
        public bool ManagerNotification { get; set; }

        /// <summary>Location types a quick transfer may leave (STORE, OUTLET); empty = all.</summary>
        public List<string> AllowedSourceTypes { get; set; } = new();

        /// <summary>Location types a quick transfer may reach (STORE, OUTLET); empty = all.</summary>
        public List<string> AllowedDestinationTypes { get; set; } = new();
    }
}
