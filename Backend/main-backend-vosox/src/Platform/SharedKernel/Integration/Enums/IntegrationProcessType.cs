using System.Text.Json.Serialization;

namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// API types. Buyer types are configured in the Buyer service, supplier types in the Supplier service. Sent and read as its name.
    /// </summary>
    [JsonConverter(typeof(JsonStringEnumConverter))]
    public enum IntegrationProcessType
    {
        POST_PO,
        GET_STOCK,
        GET_MATERIAL,
        GET_CONTRACT,
        POST_SUPPLIER,
        GET_CATALOG,
        GET_CATALOG_STOCK,
        POST_SALES_ORDER,
        POST_GOODS_MOVEMENT,
        /// <summary>Stock-count adjustment (API config FIVE_POS_UPDATE). Same routing as a goods movement; not a second endpoint.</summary>
        UPDATE_STOCK,
        POST_GRN,
        GET_POS_SALE,
        POST_INVOICE,
        GET_SUPPLIER,
        GET_PO,
        EXTRACT_INVOICE,
        POST_CONTRACT
    }
}
