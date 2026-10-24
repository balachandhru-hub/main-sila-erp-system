using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Configured AI extraction fallbacks. Secrets stay encrypted. Output is the existing invoice OCR model.
    /// </summary>
    public static class SilaOcrAiProviders
    {
        public const string GEMINI = "GEMINI";
        public const string OPENAI = "OPENAI";
        public const string ANTHROPIC = "ANTHROPIC";
        public const string CUSTOM = "CUSTOM";
        public const string CONFIDENCE_UNAVAILABLE = "OCR_DOCUMENT_CONFIDENCE_NOT_AVAILABLE";

        private static readonly string[] Types = { GEMINI, OPENAI, ANTHROPIC, CUSTOM };
        private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

        public static bool PrimaryEnabled(SilaOcrConfiguration settings) => settings.PrimaryOcrEnabled ?? true;

        public static bool AiFallbackEnabled(SilaOcrConfiguration settings) => settings.AiFallbackEnabled ?? false;

        public static List<SilaOcrAiProviderDto> Describe(SilaOcrConfiguration settings)
        {
            return ReadRows(settings.AiProvidersJson).Select(row => new SilaOcrAiProviderDto
            {
                Id = row.Id,
                Provider = row.Provider,
                DisplayName = row.DisplayName,
                Enabled = row.Enabled,
                Priority = row.Priority,
                Model = row.Model,
                BaseUrl = row.BaseUrl,
                CredentialConfigured = row.CredentialConfigured,
                ConnectionStatus = row.CredentialConfigured ? "Configured" : "Not configured"
            }).OrderBy(x => x.Priority).ThenBy(x => x.DisplayName).ToList();
        }

        public static void Apply(
            SilaOcrConfiguration settings,
            SilaOcrConfigurationWriteDto input,
            IIntegrationCredentialProtector protector)
        {
            if (input.PrimaryOcrEnabled != null)
            {
                settings.PrimaryOcrEnabled = input.PrimaryOcrEnabled;
            }

            if (input.AiFallbackEnabled != null)
            {
                settings.AiFallbackEnabled = input.AiFallbackEnabled;
            }

            if (input.Providers == null)
            {
                return;
            }

            Dictionary<Guid, string> secrets = ReadSecrets(settings.AiProviderSecrets, protector);
            List<Stored> rows = new();
            foreach (SilaOcrAiProviderWriteDto item in input.Providers)
            {
                string type = (item.Provider ?? string.Empty).Trim().ToUpperInvariant();
                if (!Types.Contains(type))
                {
                    continue;
                }

                Guid id = item.Id is { } existing && existing != Guid.Empty ? existing : Guid.NewGuid();
                if (!string.IsNullOrWhiteSpace(item.ApiKey))
                {
                    secrets[id] = item.ApiKey.Trim();
                }

                rows.Add(new Stored
                {
                    Id = id,
                    Provider = type,
                    DisplayName = string.IsNullOrWhiteSpace(item.DisplayName) ? type : item.DisplayName.Trim(),
                    Enabled = item.Enabled,
                    Priority = item.Priority,
                    Model = string.IsNullOrWhiteSpace(item.Model) ? null : item.Model.Trim(),
                    BaseUrl = string.IsNullOrWhiteSpace(item.BaseUrl) ? null : item.BaseUrl.Trim(),
                    CredentialConfigured = secrets.ContainsKey(id) && !string.IsNullOrWhiteSpace(secrets[id])
                });
            }

            HashSet<Guid> keep = rows.Select(x => x.Id).ToHashSet();
            foreach (Guid id in secrets.Keys.Where(x => !keep.Contains(x)).ToList())
            {
                secrets.Remove(id);
            }

            settings.AiProvidersJson = JsonSerializer.Serialize(rows);
            settings.AiProviderSecrets = protector.Protect(JsonSerializer.Serialize(secrets));
        }

        public static async Task<(SilaInvoiceOcrResultDto? Result, string? Provider, string? Model, string? Warning)> TryFallbackAsync(
            IHttpClientFactory http,
            SilaOcrConfiguration settings,
            IIntegrationCredentialProtector protector,
            ILoggerManager logger,
            byte[] content,
            string fileName,
            CancellationToken cancellationToken)
        {
            if (!AiFallbackEnabled(settings))
            {
                return (null, null, null, null);
            }

            Dictionary<Guid, string> secrets = ReadSecrets(settings.AiProviderSecrets, protector);
            List<Stored> active = ReadRows(settings.AiProvidersJson)
                .Where(x => x.Enabled && secrets.ContainsKey(x.Id) && !string.IsNullOrWhiteSpace(secrets[x.Id]))
                .OrderBy(x => x.Priority)
                .ToList();
            if (active.Count == 0)
            {
                return (null, null, null, "AI fallback is enabled but no active provider has a credential.");
            }

            string? warning = null;
            foreach (Stored provider in active)
            {
                try
                {
                    SilaInvoiceOcrResultDto? result = await CallAsync(http, provider, secrets[provider.Id], content, fileName, cancellationToken);
                    if (result != null)
                    {
                        return (result, provider.Provider, provider.Model, warning);
                    }

                    warning = (warning == null ? "" : warning + " ") + provider.DisplayName + " returned no invoice fields.";
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    logger.LogError($"AI invoice fallback failed. Provider: {provider.Provider}, Error: {SilaLogText.Short(exception.Message)}");
                    warning = (warning == null ? "" : warning + " ") + provider.DisplayName + " failed.";
                }
            }

            return (null, null, null, warning ?? "AI fallback providers did not return an invoice extraction.");
        }

        private static async Task<SilaInvoiceOcrResultDto?> CallAsync(
            IHttpClientFactory http,
            Stored provider,
            string secret,
            byte[] content,
            string fileName,
            CancellationToken cancellationToken)
        {
            HttpClient client = http.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(60);
            string prompt = "Extract supplier invoice fields as JSON with keys invoiceNumber, invoiceDate, currency, grossAmount, netAmount, taxAmount, supplierName, poNumber, supplierTaxNumber, lines[{description,quantity,uom,unitPrice,amount,taxRate,supplierMaterialCode}]. Return JSON only.";
            HttpRequestMessage request = provider.Provider switch
            {
                GEMINI => Gemini(provider, secret, prompt, content, fileName),
                OPENAI => OpenAi(provider, secret, prompt, content, fileName),
                ANTHROPIC => Anthropic(provider, secret, prompt, content, fileName),
                _ => Custom(provider, secret, prompt, content, fileName)
            };
            HttpResponseMessage answer = await client.SendAsync(request, cancellationToken);
            string body = await answer.Content.ReadAsStringAsync(cancellationToken);
            if (!answer.IsSuccessStatusCode)
            {
                return null;
            }

            return Normalize(ExtractJson(body));
        }

        private static HttpRequestMessage Gemini(Stored provider, string secret, string prompt, byte[] content, string fileName)
        {
            string model = provider.Model ?? "gemini-2.0-flash";
            string root = string.IsNullOrWhiteSpace(provider.BaseUrl) ? "https://generativelanguage.googleapis.com/v1beta" : provider.BaseUrl.TrimEnd('/');
            string url = root + "/models/" + model + ":generateContent?key=" + Uri.EscapeDataString(secret);
            var payload = new
            {
                contents = new[]
                {
                    new
                    {
                        parts = new object[]
                        {
                            new { text = prompt },
                            new { inline_data = new { mime_type = Mime(fileName), data = Convert.ToBase64String(content) } }
                        }
                    }
                }
            };
            return new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent(payload)
            };
        }

        private static HttpRequestMessage OpenAi(Stored provider, string secret, string prompt, byte[] content, string fileName)
        {
            string root = string.IsNullOrWhiteSpace(provider.BaseUrl) ? "https://api.openai.com/v1" : provider.BaseUrl.TrimEnd('/');
            var payload = new
            {
                model = provider.Model ?? "gpt-4.1-mini",
                messages = new object[]
                {
                    new { role = "user", content = new object[]
                    {
                        new { type = "text", text = prompt },
                        new { type = "image_url", image_url = new { url = "data:" + Mime(fileName) + ";base64," + Convert.ToBase64String(content) } }
                    }}
                }
            };
            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, root + "/chat/completions")
            {
                Content = JsonContent(payload)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", secret);
            return request;
        }

        private static HttpRequestMessage Anthropic(Stored provider, string secret, string prompt, byte[] content, string fileName)
        {
            string root = string.IsNullOrWhiteSpace(provider.BaseUrl) ? "https://api.anthropic.com/v1" : provider.BaseUrl.TrimEnd('/');
            var payload = new
            {
                model = provider.Model ?? "claude-3-5-sonnet-latest",
                max_tokens = 2048,
                messages = new[]
                {
                    new
                    {
                        role = "user",
                        content = new object[]
                        {
                            new { type = "text", text = prompt },
                            new { type = "image", source = new { type = "base64", media_type = Mime(fileName), data = Convert.ToBase64String(content) } }
                        }
                    }
                }
            };
            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, root + "/messages")
            {
                Content = JsonContent(payload)
            };
            request.Headers.Add("x-api-key", secret);
            request.Headers.Add("anthropic-version", "2023-06-01");
            return request;
        }

        private static HttpRequestMessage Custom(Stored provider, string secret, string prompt, byte[] content, string fileName)
        {
            string url = string.IsNullOrWhiteSpace(provider.BaseUrl) ? "http://127.0.0.1/" : provider.BaseUrl.Trim();
            var payload = new
            {
                prompt,
                fileName,
                contentType = Mime(fileName),
                contentBase64 = Convert.ToBase64String(content)
            };
            HttpRequestMessage request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = JsonContent(payload)
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", secret);
            return request;
        }

        private static StringContent JsonContent(object payload) =>
            new(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        private static string Mime(string fileName)
        {
            string name = (fileName ?? string.Empty).ToLowerInvariant();
            if (name.EndsWith(".png")) return "image/png";
            if (name.EndsWith(".jpg") || name.EndsWith(".jpeg")) return "image/jpeg";
            return "application/pdf";
        }

        private static string ExtractJson(string body)
        {
            try
            {
                using JsonDocument document = JsonDocument.Parse(body);
                JsonElement root = document.RootElement;
                if (root.TryGetProperty("candidates", out JsonElement candidates) && candidates.GetArrayLength() > 0)
                {
                    JsonElement parts = candidates[0].GetProperty("content").GetProperty("parts");
                    if (parts.GetArrayLength() > 0 && parts[0].TryGetProperty("text", out JsonElement text))
                    {
                        return text.GetString() ?? body;
                    }
                }

                if (root.TryGetProperty("choices", out JsonElement choices) && choices.GetArrayLength() > 0)
                {
                    return choices[0].GetProperty("message").GetProperty("content").GetString() ?? body;
                }

                if (root.TryGetProperty("content", out JsonElement content) && content.ValueKind == JsonValueKind.Array && content.GetArrayLength() > 0)
                {
                    return content[0].GetProperty("text").GetString() ?? body;
                }
            }
            catch (JsonException)
            {
                return body;
            }

            return body;
        }

        private static SilaInvoiceOcrResultDto? Normalize(string text)
        {
            int start = text.IndexOf('{');
            int end = text.LastIndexOf('}');
            if (start < 0 || end <= start)
            {
                return null;
            }

            try
            {
                AiInvoice? parsed = JsonSerializer.Deserialize<AiInvoice>(text[start..(end + 1)], Json);
                if (parsed == null)
                {
                    return null;
                }

                return new SilaInvoiceOcrResultDto
                {
                    Confidence = parsed.Confidence,
                    Fields = new SilaInvoiceOcrFieldsDto
                    {
                        InvoiceNumber = parsed.InvoiceNumber,
                        InvoiceDate = parsed.InvoiceDate,
                        Currency = parsed.Currency,
                        GrossAmount = parsed.GrossAmount,
                        SupplierName = parsed.SupplierName,
                        PoNumber = parsed.PoNumber,
                        SupplierTaxNumber = parsed.SupplierTaxNumber,
                        NetAmount = parsed.NetAmount,
                        TaxAmount = parsed.TaxAmount
                    },
                    Lines = parsed.Lines?.Select(line => new SilaInvoiceOcrLineDto
                    {
                        Description = line.Description,
                        Quantity = line.Quantity,
                        Uom = line.Uom,
                        UnitPrice = line.UnitPrice,
                        Amount = line.Amount,
                        TaxRate = line.TaxRate,
                        SupplierMaterialCode = line.SupplierMaterialCode
                    }).ToList()
                };
            }
            catch (JsonException)
            {
                return null;
            }
        }

        private static List<Stored> ReadRows(string? json)
        {
            if (string.IsNullOrWhiteSpace(json))
            {
                return new List<Stored>();
            }

            try
            {
                return JsonSerializer.Deserialize<List<Stored>>(json, Json) ?? new List<Stored>();
            }
            catch (JsonException)
            {
                return new List<Stored>();
            }
        }

        private static Dictionary<Guid, string> ReadSecrets(string? blob, IIntegrationCredentialProtector? protector)
        {
            if (string.IsNullOrWhiteSpace(blob))
            {
                return new Dictionary<Guid, string>();
            }

            string text = blob;
            if (protector != null)
            {
                try
                {
                    text = protector.Unprotect(blob) ?? blob;
                }
                catch (Exception)
                {
                    return new Dictionary<Guid, string>();
                }
            }

            try
            {
                return JsonSerializer.Deserialize<Dictionary<Guid, string>>(text, Json) ?? new Dictionary<Guid, string>();
            }
            catch (JsonException)
            {
                return new Dictionary<Guid, string>();
            }
        }

        private sealed class Stored
        {
            public Guid Id { get; set; }
            public string Provider { get; set; } = string.Empty;
            public string DisplayName { get; set; } = string.Empty;
            public bool Enabled { get; set; }
            public int Priority { get; set; }
            public string? Model { get; set; }
            public string? BaseUrl { get; set; }
            public bool CredentialConfigured { get; set; }
        }

        private sealed class AiInvoice
        {
            public decimal? Confidence { get; set; }
            public string? InvoiceNumber { get; set; }
            public string? InvoiceDate { get; set; }
            public string? Currency { get; set; }
            public decimal? GrossAmount { get; set; }
            public string? SupplierName { get; set; }
            public string? PoNumber { get; set; }
            public string? SupplierTaxNumber { get; set; }
            public decimal? NetAmount { get; set; }
            public decimal? TaxAmount { get; set; }
            public List<AiLine>? Lines { get; set; }
        }

        private sealed class AiLine
        {
            public string Description { get; set; } = string.Empty;
            public decimal? Quantity { get; set; }
            public string? Uom { get; set; }
            public decimal? UnitPrice { get; set; }
            public decimal? Amount { get; set; }
            public decimal? TaxRate { get; set; }
            public string? SupplierMaterialCode { get; set; }
        }
    }
}
