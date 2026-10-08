namespace Buyer.Domain.Dtos
{
    public class SilaStockCountSubmitDto
    {
        /// <summary>True records every uncounted material as counted 0; otherwise uncounted materials block the submit.</summary>
        public bool CountMissingAsZero { get; set; }
    }
}
