using Buyer.Application.Features.Shared;

namespace Buyer.Tests.Shared
{
    /// <summary>ERP payloads are stored for the tracker with credentials masked and truncated.</summary>
    public class SilaErpPayloadTests
    {
        [Fact]
        public void Sanitise_MasksJsonFormAndXmlSecrets()
        {
            string json = SilaErpPayload.Sanitise("{\"user\":\"sap\",\"password\":\"p@ss\\\"word\",\"api_key\": 12345,\"qty\":2}")!;
            Assert.Contains("\"password\":\"***\"", json);
            Assert.Contains("\"api_key\": \"***\"", json);
            Assert.Contains("\"user\":\"sap\"", json);
            Assert.Contains("\"qty\":2", json);
            Assert.DoesNotContain("p@ss", json);

            Assert.Equal("grant=client&client_secret=***&scope=x", SilaErpPayload.Sanitise("grant=client&client_secret=abc&scope=x"));
            Assert.Equal("<a><Token>***</Token><b>1</b></a>", SilaErpPayload.Sanitise("<a><Token>xyz</Token><b>1</b></a>"));
        }

        [Fact]
        public void Sanitise_TruncatesAndKeepsEmptyAsNull()
        {
            Assert.Null(SilaErpPayload.Sanitise(null));
            Assert.Null(SilaErpPayload.Sanitise(string.Empty));
            Assert.Equal(SilaErpPayload.MAX_LENGTH, SilaErpPayload.Sanitise(new string('x', 10000))!.Length);
        }
    }
}
