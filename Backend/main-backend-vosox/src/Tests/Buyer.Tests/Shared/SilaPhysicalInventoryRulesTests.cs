using Buyer.Application.Features.Shared;
using Buyer.Tests.Support;
using SharedKernel.ExceptionHandler;

namespace Buyer.Tests.Shared
{
    public class SilaPhysicalInventoryRulesTests
    {
        private const int Iterations = 500;

        public static IEnumerable<object[]> OneWeek()
        {
            // 2026-10-05 is a Monday; one start day per day of the week, with a time part that must be ignored.
            for (int offset = 0; offset < 7; offset++)
            {
                yield return new object[] { new DateTime(2026, 10, 5, 15, 30, 0).AddDays(offset) };
            }
        }

        [Theory]
        [MemberData(nameof(OneWeek))]
        public void RandomWorkingDay_IsAWeekdayFromTomorrowWithinSevenDays(DateTime today)
        {
            for (int i = 0; i < Iterations; i++)
            {
                DateTime day = SilaPhysicalInventoryRules.RandomWorkingDay(today);
                Assert.Equal(TimeSpan.Zero, day.TimeOfDay);
                Assert.True(day > today.Date, $"{day:yyyy-MM-dd} is not after {today:yyyy-MM-dd}");
                Assert.True(day <= today.Date.AddDays(SilaPhysicalInventoryRules.RANDOM_DAYS), $"{day:yyyy-MM-dd} is more than 7 days ahead");
                Assert.NotEqual(DayOfWeek.Saturday, day.DayOfWeek);
                Assert.NotEqual(DayOfWeek.Sunday, day.DayOfWeek);
            }
        }

        [Fact]
        public void RandomWorkingDay_CoversEveryWorkingDayOfTheWindow()
        {
            DateTime today = new DateTime(2026, 10, 9); // Friday: window Sat 10 .. Fri 16, working days Mon 12 .. Fri 16
            HashSet<DateTime> seen = new HashSet<DateTime>();
            for (int i = 0; i < Iterations; i++)
            {
                seen.Add(SilaPhysicalInventoryRules.RandomWorkingDay(today));
            }

            HashSet<DateTime> expected = Enumerable.Range(12, 5).Select(day => new DateTime(2026, 10, day)).ToHashSet();
            Assert.Equal(expected, seen);
        }

        [Fact]
        public void ResolveDate_Null_IsARandomWorkingDay()
        {
            DateTime today = DateTime.UtcNow.Date;
            DateTime date = SilaPhysicalInventoryRules.ResolveDate(new FakeLogger(), null);
            Assert.InRange(date, today.AddDays(1), today.AddDays(SilaPhysicalInventoryRules.RANDOM_DAYS));
            Assert.NotEqual(DayOfWeek.Saturday, date.DayOfWeek);
            Assert.NotEqual(DayOfWeek.Sunday, date.DayOfWeek);
        }

        [Theory]
        [InlineData(0)]
        [InlineData(1)]
        [InlineData(90)]
        public void ResolveDate_TodayUpTo90DaysAhead_IsKeptWithoutTime(int daysAhead)
        {
            DateTime requested = DateTime.UtcNow.Date.AddDays(daysAhead).AddHours(10);
            DateTime date = SilaPhysicalInventoryRules.ResolveDate(new FakeLogger(), requested);
            Assert.Equal(requested.Date, date);
        }

        [Theory]
        [InlineData(-1)]
        [InlineData(91)]
        public void ResolveDate_OutOfRange_IsBadRequest(int daysAhead)
        {
            FakeLogger logger = new FakeLogger();
            DateTime requested = DateTime.UtcNow.Date.AddDays(daysAhead);
            Assert.Throws<BadRequestCustomException>(() => SilaPhysicalInventoryRules.ResolveDate(logger, requested));
            Assert.Single(logger.Errors);
        }

        [Fact]
        public void ValidateReason_IsTrimmed()
        {
            Assert.Equal("Negative stock", SilaPhysicalInventoryRules.ValidateReason(new FakeLogger(), "  Negative stock  "));
        }

        [Theory]
        [InlineData(null)]
        [InlineData("")]
        [InlineData("   ")]
        public void ValidateReason_Empty_IsBadRequest(string? reason)
        {
            Assert.Throws<BadRequestCustomException>(() => SilaPhysicalInventoryRules.ValidateReason(new FakeLogger(), reason));
        }

        [Fact]
        public void ValidateReason_LongerThanMax_IsBadRequest()
        {
            string atMax = new string('a', SilaPhysicalInventoryRules.MAX_REASON_LENGTH);
            Assert.Equal(atMax, SilaPhysicalInventoryRules.ValidateReason(new FakeLogger(), atMax));
            Assert.Throws<BadRequestCustomException>(() => SilaPhysicalInventoryRules.ValidateReason(new FakeLogger(), atMax + "a"));
        }
    }
}
