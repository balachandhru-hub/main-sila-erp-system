using Microsoft.AspNetCore.DataProtection;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;

namespace SharedKernel.Integration.Services
{
    /// <summary>
    /// Encrypts the API credentials stored on an integration configuration (ASP.NET data protection).
    /// </summary>
    public class IntegrationCredentialProtector : IIntegrationCredentialProtector
    {
        private readonly IDataProtector _protector;

        public IntegrationCredentialProtector(IDataProtectionProvider provider)
        {
            _protector = provider.CreateProtector(IntegrationConstants.CREDENTIAL_PURPOSE);
        }

        public string? Protect(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : _protector.Protect(value);
        }

        public string? Unprotect(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : _protector.Unprotect(value);
        }

        public string State(ApiIntegrationConfiguration configuration)
        {
            if (configuration.AuthenticationType == IntegrationAuthenticationType.NONE)
            {
                return "Not required";
            }

            bool configured = !string.IsNullOrWhiteSpace(configuration.ProtectedPassword)
                || !string.IsNullOrWhiteSpace(configuration.ProtectedClientSecret)
                || !string.IsNullOrWhiteSpace(configuration.ProtectedBearerToken)
                || !string.IsNullOrWhiteSpace(configuration.ProtectedApiKey);
            return configured ? "Configured" : "Missing";
        }
    }
}
