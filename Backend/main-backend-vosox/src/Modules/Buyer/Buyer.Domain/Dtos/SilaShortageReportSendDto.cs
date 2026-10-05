namespace Buyer.Domain.Dtos
{
    /// <summary>Emails the shortage report summary of the filtered period to up to 10 addresses.</summary>
    public class SilaShortageReportSendDto : SilaShortageReportFilterDto
    {
        public List<string> ToEmails { get; set; } = new List<string>();
        public List<string>? CcEmails { get; set; }
        public string? Subject { get; set; }
        public string? Message { get; set; }
    }
}
