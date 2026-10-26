namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// SAP S/4 goods receipt posted through the POST_GRN configuration named FIVE S4-GRN POSTING
    /// (API_MATERIAL_DOCUMENT_SRV / A_MaterialDocumentHeader). Shape matches the previous SILAME
    /// S4HanaPostGrnAdapter: GoodsMovementCode 01, movement type 101.
    /// </summary>
    public static class SilaGrnSap
    {
        /// <summary>Canonical integration name (same style as FIVE S4-INVOICE POSTING).</summary>
        public const string API_CONFIG_NAME = "FIVE S4-GRN POSTING";

        /// <summary>Earlier seed name kept as an alias so existing ACTIVE rows still use the SAP body.</summary>
        public const string API_CONFIG_NAME_LEGACY = "FIVE S4 - POST GRN";

        public const string GOODS_MOVEMENT_CODE = "01";
        public const string GOODS_MOVEMENT_TYPE = "101";
        public const string GOODS_MOVEMENT_REF_DOC_TYPE = "B";

        public static bool IsConfiguredName(string? name)
        {
            if (string.IsNullOrWhiteSpace(name))
            {
                return false;
            }

            string text = name.Trim();
            return text.Equals(API_CONFIG_NAME, StringComparison.OrdinalIgnoreCase)
                || text.Equals(API_CONFIG_NAME_LEGACY, StringComparison.OrdinalIgnoreCase);
        }
    }
}
