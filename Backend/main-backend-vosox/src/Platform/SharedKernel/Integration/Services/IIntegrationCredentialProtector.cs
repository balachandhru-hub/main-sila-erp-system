using SharedKernel.Integration.Entities;

namespace SharedKernel.Integration.Services
{
    public interface IIntegrationCredentialProtector
    {
        string? Protect(string? value);

        string? Unprotect(string? value);

        /// <summary>Whether the configuration's credentials are stored: "Not required", "Configured" or "Missing".</summary>
        string State(ApiIntegrationConfiguration configuration);
    }
}
