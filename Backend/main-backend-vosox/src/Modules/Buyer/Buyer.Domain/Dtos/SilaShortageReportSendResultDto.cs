namespace Buyer.Domain.Dtos
{
    public class SilaShortageReportSendResultDto
    {
        public int Recipients { get; set; }
        public int Sent { get; set; }
        /// <summary>SENT, PARTIAL or EMAIL_NOT_CONFIGURED. Never reports success when nothing was sent.</summary>
        public string DeliveryStatus { get; set; } = "SENT";
        public string? Note { get; set; }
    }
}
