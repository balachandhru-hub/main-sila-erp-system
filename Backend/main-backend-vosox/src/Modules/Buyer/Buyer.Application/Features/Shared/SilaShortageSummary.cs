using Buyer.Domain.Common;
using Buyer.Domain.Dtos;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Totals and groupings of the shortage report lines.</summary>
    public static class SilaShortageSummary
    {
        public static SilaShortageTotalsDto Totals(List<SilaShortageLineDto> lines)
        {
            List<SilaShortageLineDto> justified = lines.Where(x => x.JustificationCategory != null).ToList();
            List<SilaShortageLineDto> accepted = lines.Where(SilaShortageReportRules.IsAccepted).ToList();
            List<SilaShortageLineDto> rejected = lines.Where(SilaShortageReportRules.IsRejected).ToList();
            List<SilaShortageLineDto> posted = lines.Where(x => x.Posted).ToList();
            return new SilaShortageTotalsDto
            {
                Lines = lines.Count,
                ShortageQty = lines.Sum(x => x.ShortageQty),
                ShortageValue = lines.Sum(x => x.ShortageValue),
                JustifiedLines = justified.Count,
                JustifiedValue = justified.Sum(x => x.ShortageValue),
                AcceptedLines = accepted.Count,
                AcceptedValue = accepted.Sum(x => x.ShortageValue),
                RejectedLines = rejected.Count,
                RejectedValue = rejected.Sum(x => x.ShortageValue),
                PostedLines = posted.Count,
                PostedValue = posted.Sum(x => x.ShortageValue),
                AwaitingValue = lines
                    .Where(x => x.EnquiryStatus == Common.SILA_ENQUIRY_SENT || x.EnquiryStatus == Common.SILA_ENQUIRY_MORE_INFORMATION)
                    .Sum(x => x.ShortageValue),
                UnresolvedValue = lines
                    .Where(x => !SilaShortageReportRules.IsAccepted(x) && !SilaShortageReportRules.IsRejected(x))
                    .Sum(x => x.ShortageValue),
                ApprovedValue = lines.Where(x => x.ApprovedOn != null).Sum(x => x.ShortageValue),
                SapPostedValue = lines.Where(x => x.SapStatus == Common.SILA_POSTING_POSTED).Sum(x => x.ShortageValue),
                SapPendingValue = lines
                    .Where(x => x.SapStatus == Common.SILA_POSTING_PENDING || x.SapStatus == Common.SILA_POSTING_UNKNOWN)
                    .Sum(x => x.ShortageValue),
                SapFailedValue = lines.Where(x => x.SapStatus == Common.SILA_POSTING_FAILED).Sum(x => x.ShortageValue),
                Locations = lines.Select(x => x.LocationId).Distinct().Count(),
                Materials = lines.Select(x => x.MaterialId).Distinct().Count()
            };
        }

        public static List<SilaShortageGroupDto> ByLocation(List<SilaShortageLineDto> lines)
        {
            return lines
                .GroupBy(x => x.LocationId)
                .Select(group => Group(group.Key.ToString(), group.First().LocationName ?? group.Key.ToString(), group.ToList()))
                .OrderByDescending(x => x.ShortageValue)
                .ToList();
        }

        public static List<SilaShortageGroupDto> ByReason(List<SilaShortageLineDto> lines)
        {
            return lines
                .GroupBy(x => x.JustificationCategory ?? SilaShortageReportRules.NOT_JUSTIFIED)
                .Select(group => Group(group.Key, group.Key, group.ToList()))
                .OrderByDescending(x => x.ShortageValue)
                .ToList();
        }

        private static SilaShortageGroupDto Group(string key, string name, List<SilaShortageLineDto> lines)
        {
            return new SilaShortageGroupDto
            {
                Key = key,
                Name = name,
                Lines = lines.Count,
                ShortageQty = lines.Sum(x => x.ShortageQty),
                ShortageValue = lines.Sum(x => x.ShortageValue),
                PostedValue = lines.Where(x => x.Posted).Sum(x => x.ShortageValue)
            };
        }
    }
}
