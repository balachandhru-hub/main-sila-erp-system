namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// SAP S/4 goods receipt posted through the POST_GRN configuration named FIVE S4 - POST GRN
    /// (API_MATERIAL_DOCUMENT_SRV / A_MaterialDocumentHeader). Shape matches the previous SILAME
    /// S4HanaPostGrnAdapter: GoodsMovementCode 01, movement type 101.
    /// </summary>
    public static class SilaGrnSap
    {
        public const string API_CONFIG_NAME = "FIVE S4 - POST GRN";
        public const string GOODS_MOVEMENT_CODE = "01";
        public const string GOODS_MOVEMENT_TYPE = "101";
        public const string GOODS_MOVEMENT_REF_DOC_TYPE = "B";
    }
}
