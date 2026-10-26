using SharedKernel.Integration.Enums;
using Xunit;

namespace Buyer.Tests.Shared
{
    public class IntegrationProtocolMapTests
    {
        [Theory]
        [InlineData("REST", IntegrationProtocol.REST)]
        [InlineData("REST_API", IntegrationProtocol.REST)]
        [InlineData("ODATA_V2", IntegrationProtocol.ODATA_V2)]
        [InlineData("ODataV2", IntegrationProtocol.ODATA_V2)]
        [InlineData("ODATA_V4", IntegrationProtocol.ODATA_V4)]
        [InlineData("OData", IntegrationProtocol.ODATA_V4)]
        [InlineData("ODATA", IntegrationProtocol.ODATA_V4)]
        [InlineData("SOAP", IntegrationProtocol.SOAP)]
        public void TryParse_AcceptsCanonicalAndLegacyAliases(string stored, IntegrationProtocol expected)
        {
            Assert.True(IntegrationProtocolMap.TryParse(stored, out IntegrationProtocol protocol));
            Assert.Equal(expected, protocol);
            Assert.Equal(expected.ToString(), IntegrationProtocolMap.ToStored(protocol));
        }
    }
}
