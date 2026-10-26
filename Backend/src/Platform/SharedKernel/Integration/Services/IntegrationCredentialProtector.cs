using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;

namespace SharedKernel.Integration.Services
{
    /// <summary>
    /// Encrypts API credentials. Data Protection is tried first (existing UAT blobs).
    /// When this host does not have that key ring, Encryption:AesKey unwraps AES-wrapped values
    /// so FIVE S4-GRN REVERSAL can send without replacing the frozen 101 posting row.
    /// </summary>
    public class IntegrationCredentialProtector : IIntegrationCredentialProtector
    {
        private const string AES_KEY = "Encryption:AesKey";
        private readonly IDataProtector _protector;
        private readonly byte[]? _aesKey;

        public IntegrationCredentialProtector(IDataProtectionProvider provider, IConfiguration configuration)
        {
            _protector = provider.CreateProtector(IntegrationConstants.CREDENTIAL_PURPOSE);
            string? key = configuration[AES_KEY];
            if (!string.IsNullOrWhiteSpace(key))
            {
                byte[] raw = Convert.FromBase64String(key);
                if (raw.Length == 32)
                {
                    _aesKey = raw;
                }
            }
        }

        public string? Protect(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            // Keep writing Data Protection blobs for existing hosts. Unprotect also
            // reads Encryption:AesKey wraps so a host without the UAT key ring can
            // still send FIVE S4-GRN REVERSAL after that row is AES-wrapped.
            return _protector.Protect(value);
        }

        public string? Unprotect(string? value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            CryptographicException? dataProtectionError = null;
            try
            {
                return _protector.Unprotect(value);
            }
            catch (CryptographicException exception)
            {
                dataProtectionError = exception;
            }

            if (_aesKey != null && !value.StartsWith("CfDJ8", StringComparison.Ordinal))
            {
                try
                {
                    return AesUnprotect(value, _aesKey);
                }
                catch (FormatException)
                {
                    // Not an AES blob.
                }
                catch (CryptographicException)
                {
                    // Wrong key or corrupt AES blob.
                }
            }

            throw dataProtectionError;
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

        private static string AesUnprotect(string value, byte[] key)
        {
            byte[] packed = Convert.FromBase64String(value);
            if (packed.Length <= 16)
            {
                throw new CryptographicException("AES credential blob is too short.");
            }

            using Aes aes = Aes.Create();
            aes.Key = key;
            byte[] iv = new byte[16];
            byte[] cipher = new byte[packed.Length - 16];
            Buffer.BlockCopy(packed, 0, iv, 0, 16);
            Buffer.BlockCopy(packed, 16, cipher, 0, cipher.Length);
            aes.IV = iv;
            using ICryptoTransform decryptor = aes.CreateDecryptor();
            byte[] plain = decryptor.TransformFinalBlock(cipher, 0, cipher.Length);
            return System.Text.Encoding.UTF8.GetString(plain);
        }
    }
}
