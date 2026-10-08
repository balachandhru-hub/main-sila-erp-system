namespace SharedKernel.Integration
{
    /// <summary>
    /// Constants of the API integration engine shared by the Buyer and Supplier services.
    /// </summary>
    public static class IntegrationConstants
    {
        /// <summary>Data protection purpose of the stored API credentials.</summary>
        public const string CREDENTIAL_PURPOSE = "ProcurementSuite.IntegrationCredentials.v1";

        /// <summary>Named HttpClient the executor calls external APIs with.</summary>
        public const string HTTP_CLIENT_INTEGRATIONS = "api-integrations";

        /// <summary>Entity code of an API that serves the whole organization.</summary>
        public const string ENTITY_CODE_ALL = "ALL";

        public const string PAYLOAD_JSON = "JSON";
        public const string PAYLOAD_SOAP = "SOAP";
        public const string PAYLOAD_CXML = "CXML";
        public const string DEFAULT_API_KEY_HEADER = "X-API-KEY";
    }
}
