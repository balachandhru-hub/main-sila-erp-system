namespace Buyer.Domain.Dtos
{
    /// <summary>Shortage report: totals and groupings over every matching line, plus one page of the lines.</summary>
    public class SilaShortageReportDto
    {
        public DateTime From { get; set; }
        public DateTime To { get; set; }
        public SilaShortageTotalsDto Totals { get; set; } = new SilaShortageTotalsDto();
        public List<SilaShortageGroupDto> ByLocation { get; set; } = new List<SilaShortageGroupDto>();
        public List<SilaShortageGroupDto> ByReason { get; set; } = new List<SilaShortageGroupDto>();
        public int TotalLines { get; set; }
        public List<SilaShortageLineDto> Lines { get; set; } = new List<SilaShortageLineDto>();
    }
}
