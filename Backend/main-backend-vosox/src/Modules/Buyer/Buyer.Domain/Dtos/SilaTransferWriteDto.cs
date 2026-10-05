namespace Buyer.Domain.Dtos
{
    public class SilaTransferWriteDto
    {
        public Guid FromLocationId { get; set; }
        public Guid ToLocationId { get; set; }
        public string? Reason { get; set; }
        public DateTime? RequiredBy { get; set; }
        /// <summary>
        /// Quick transfers only: the requester (at the destination) already took the stock from the source. The source
        /// location confirms the handover, which posts the movement, or disputes it.
        /// </summary>
        public bool AlreadyCollected { get; set; }

        /// <summary>
        /// Standard transfers from Live Inventory: assign every line material to the destination (stocking row, type
        /// REGULAR) when it is not stocked there yet.
        /// </summary>
        public bool AddToLocation { get; set; }
        public List<SilaTransferLineWriteDto> Items { get; set; } = new();
    }
}
