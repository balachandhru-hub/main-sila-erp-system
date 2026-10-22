using Buyer.Application.Features.Shared;

namespace Buyer.Tests.Shared
{
    public class SilaCreditMemoSapResponseTests
    {
        private const string Complete = """
            {"d":{"__metadata":{"id":"https://host/sap/opu/odata/sap/API_SUPPLIERINVOICE_PROCESS_SRV/A_SupplierInvoice(SupplierInvoice='5105601149',FiscalYear='2026')","type":"API_SUPPLIERINVOICE_PROCESS_SRV.A_SupplierInvoiceType"},"SupplierInvoice":"5105601149","FiscalYear":"2026","SupplierInvoiceIDByInvcgParty":"CM000001","SupplierInvoiceIsCreditMemo":"1"}}
            """;

        [Fact]
        public void ReadSupplierInvoice_ReadsODataV2Entity()
        {
            Assert.Equal("5105601149", SilaCreditMemoPosting.ReadSupplierInvoice(Complete));
            Assert.Equal("2026", SilaCreditMemoPosting.ReadFiscalYear(Complete));
        }

        [Fact]
        public void DisplayMessage_SuccessUsesCreditMemoIdAndFiscalYear()
        {
            string message = SilaCreditMemoPosting.DisplayMessage("POSTED", new Buyer.Domain.Entities.InventoryErpPosting
            {
                Status = "POSTED",
                ErpReference = "5105601149",
                ErpHttpStatus = 201,
                ErpResponsePayload = Complete
            });
            Assert.Equal("Posted successfully. SAP Credit Memo 5105601149 / 2026.", message);
        }

        [Fact]
        public void DisplayMessage_DoesNotDumpSuccessfulSapJson()
        {
            string truncated = Complete + new string('x', 5000);
            truncated = truncated[..4000];
            string message = SilaCreditMemoPosting.DisplayMessage("POSTED", new Buyer.Domain.Entities.InventoryErpPosting
            {
                Status = "POSTED",
                ErpHttpStatus = 201,
                ErpResponsePayload = truncated
            });
            Assert.Equal("Posted successfully. SAP Credit Memo 5105601149 / 2026.", message);
            Assert.DoesNotContain("{", message);
        }

        [Fact]
        public void ReadSupplierInvoice_ReadsTruncatedSanitisedPayload()
        {
            string truncated = Complete + new string('x', 5000);
            truncated = truncated[..4000];
            Assert.False(IsJson(truncated));
            Assert.Equal("5105601149", SilaCreditMemoPosting.ReadSupplierInvoice(truncated));
            Assert.Equal("2026", SilaCreditMemoPosting.ReadFiscalYear(truncated));
            Assert.DoesNotContain("CM000001", SilaCreditMemoPosting.ReadSupplierInvoice(truncated));
        }

        private static bool IsJson(string body)
        {
            try
            {
                System.Text.Json.JsonDocument.Parse(body);
                return true;
            }
            catch (System.Text.Json.JsonException)
            {
                return false;
            }
        }
    }
}
