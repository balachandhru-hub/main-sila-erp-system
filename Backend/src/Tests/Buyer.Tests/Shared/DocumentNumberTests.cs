using Buyer.Application.Features.Shared;

namespace Buyer.Tests.Shared
{
    public class DocumentNumberTests
    {
        [Theory]
        [InlineData("ITO", 1, "ITO000001")]
        [InlineData("PI", 42, "PI000042")]
        [InlineData("GRN", 999999, "GRN999999")]
        public void Format_DefaultsToSixDigits(string prefix, int sequence, string expected)
        {
            Assert.Equal(expected, DocumentNumber.Format(prefix, sequence));
        }

        [Theory]
        [InlineData("RI", 1, 5, "RI00001")]
        [InlineData("RI", 12345, 5, "RI12345")]
        [InlineData("RS", 7, 6, "RS000007")]
        public void Format_PadsToTheGivenDigits(string prefix, int sequence, int digits, string expected)
        {
            Assert.Equal(expected, DocumentNumber.Format(prefix, sequence, digits));
        }

        [Theory]
        [InlineData("RI", 123456, 5, "RI123456")]
        [InlineData("ITO", 1234567, 6, "ITO1234567")]
        public void Format_SequenceBeyondDigits_IsNotTruncated(string prefix, int sequence, int digits, string expected)
        {
            Assert.Equal(expected, DocumentNumber.Format(prefix, sequence, digits));
        }
    }
}
