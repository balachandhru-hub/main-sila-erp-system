namespace SharedKernel.Integration.Dtos
{
    /// <summary>Only the request body template of an integration and the format it is sent in.</summary>
    public class IntegrationRequestBodyInputDto
    {
        public string? PayloadFormat { get; set; }
        public string? RequestBody { get; set; }
    }
}
