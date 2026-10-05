using System.Globalization;
using System.Text.Json;
using Buyer.Application.Features.Commands.SendIntegrationRequest;
using Buyer.Application.Features.Queries.ResolveIntegration;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Reads an invoice with the buyer's external extraction API (EXTRACT_INVOICE): the file is sent as
    /// {fileName, contentType, contentBase64} and the answer is read through the InvoiceExtraction.* mapping. A field that
    /// is not mapped is read under its own camelCase name, at the root or under "fields" (the built-in OCR answer shape).
    /// </summary>
    public static class SilaInvoiceExternalReader
    {
        // An extraction answer carries the lines, so much more of it is kept than for a posting answer.
        private const int RESPONSE_LIMIT = 500000;
        private const string AREA = "InvoiceExtraction";

        public static async Task<SilaInvoiceReader.Reading> ReadAsync(
            IMediator mediator, IRepositoryWrapper repository, ILoggerManager logger, Guid organizationId, Invoice invoice, byte[] content, CancellationToken cancellationToken)
        {
            IntegrationApiDto api = await mediator.Send(new ResolveIntegrationQuery
            {
                OrganizationId = organizationId,
                ProcessType = IntegrationProcessType.EXTRACT_INVOICE
            }, cancellationToken);
            if (!api.Configured || api.ConfigurationId == null)
            {
                logger.LogError($"External invoice extraction is not configured. OrganizationId: {organizationId}");
                throw new FailedDependencyCustomException(
                    "The external invoice reader is not configured.",
                    "Configure and activate an EXTRACT_INVOICE API under Integration, or switch the OCR settings to the built-in reader.");
            }

            string body = JsonSerializer.Serialize(new Dictionary<string, string>
            {
                ["fileName"] = invoice.FileName,
                ["contentType"] = SilaReceivingRules.InvoiceContentType(invoice.FileName) ?? "application/octet-stream",
                ["contentBase64"] = Convert.ToBase64String(content)
            });
            IntegrationSendResultDto sent;
            try
            {
                sent = await mediator.Send(new SendIntegrationRequestCommand
                {
                    OrganizationId = organizationId,
                    ConfigurationId = api.ConfigurationId.Value,
                    Body = body,
                    Headers = new Dictionary<string, string> { ["X-Correlation-Id"] = invoice.Id.ToString() },
                    ResponseLimit = RESPONSE_LIMIT
                }, cancellationToken);
            }
            catch (BaseCustomException exception)
            {
                logger.LogError($"External invoice extraction refused. InvoiceId: {invoice.Id}, HttpStatus: {exception.Code}");
                return new SilaInvoiceReader.Reading { Method = SilaOcrSettings.METHOD_EXTERNAL, Failure = "The external invoice reader is not active. Activate it under Integration." };
            }

            if (!sent.Answered || sent.StatusCode < 200 || sent.StatusCode >= 300)
            {
                return new SilaInvoiceReader.Reading
                {
                    Method = SilaOcrSettings.METHOD_EXTERNAL,
                    Unreachable = !sent.Answered,
                    Failure = sent.Answered
                        ? $"The external invoice reader returned HTTP {sent.StatusCode}. Type the invoice fields yourself."
                        : $"{sent.ErrorMessage ?? "The external invoice reader could not be reached."} Type the invoice fields yourself."
                };
            }

            List<ApiFieldMapping> mappings = await repository.ApiFieldMapping
                .FindByCondition(x => x.ConfigurationId == api.ConfigurationId.Value && x.IsActive)
                .ToListAsync(cancellationToken);
            SilaInvoiceOcrResultDto? result = Map(logger, mappings, sent.ResponseBody);
            return result == null
                ? new SilaInvoiceReader.Reading { Method = SilaOcrSettings.METHOD_EXTERNAL, Failure = "The external invoice reader answered without invoice fields. Type the invoice fields yourself." }
                : new SilaInvoiceReader.Reading { Method = SilaOcrSettings.METHOD_EXTERNAL, Result = result };
        }

        private static SilaInvoiceOcrResultDto? Map(ILoggerManager logger, List<ApiFieldMapping> mappings, string? body)
        {
            if (string.IsNullOrWhiteSpace(body))
            {
                return null;
            }

            try
            {
                using JsonDocument json = JsonDocument.Parse(body);
                JsonElement root = json.RootElement;
                if (root.ValueKind != JsonValueKind.Object)
                {
                    return null;
                }

                SilaInvoiceOcrFieldsDto fields = new SilaInvoiceOcrFieldsDto
                {
                    InvoiceNumber = Read(mappings, root, "InvoiceNumber"),
                    InvoiceDate = Read(mappings, root, "InvoiceDate"),
                    Currency = Read(mappings, root, "Currency"),
                    GrossAmount = Number(Read(mappings, root, "GrossAmount")),
                    SupplierName = Read(mappings, root, "SupplierName"),
                    SupplierTaxNumber = Read(mappings, root, "SupplierTaxNumber"),
                    PoNumber = Read(mappings, root, "PoNumber")
                };
                List<SilaInvoiceOcrLineDto> lines = new List<SilaInvoiceOcrLineDto>();
                ApiFieldMapping? linesMapping = Mapping(mappings, "Lines");
                JsonElement? array = IntegrationRecordReader.ReadPath(root, linesMapping?.SourceField ?? "lines");
                if (array != null && array.Value.ValueKind == JsonValueKind.Array)
                {
                    foreach (JsonElement line in array.Value.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.Object))
                    {
                        lines.Add(new SilaInvoiceOcrLineDto
                        {
                            Description = ReadLine(mappings, line, "Description"),
                            Quantity = Number(ReadLine(mappings, line, "Quantity")),
                            UnitPrice = Number(ReadLine(mappings, line, "UnitPrice")),
                            Amount = Number(ReadLine(mappings, line, "Amount"))
                        });
                    }
                }

                decimal? confidence = Number(Read(mappings, root, "Confidence"));
                return new SilaInvoiceOcrResultDto
                {
                    Text = Read(mappings, root, "Text"),
                    Confidence = confidence > 1 ? confidence / 100 : confidence,
                    Fields = fields,
                    Lines = lines
                };
            }
            catch (JsonException exception)
            {
                logger.LogError($"External invoice extraction answer is not valid JSON. Error: {SilaLogText.Short(exception.Message)}");
                return null;
            }
        }

        private static string? Read(List<ApiFieldMapping> mappings, JsonElement root, string field)
        {
            ApiFieldMapping? mapping = Mapping(mappings, field);
            if (mapping != null)
            {
                return IntegrationRecordReader.MapValue(mapping, root);
            }

            string name = char.ToLowerInvariant(field[0]) + field[1..];
            return Text(IntegrationRecordReader.ReadPath(root, name)) ?? Text(IntegrationRecordReader.ReadPath(root, "fields." + name));
        }

        private static string? ReadLine(List<ApiFieldMapping> mappings, JsonElement line, string field)
        {
            ApiFieldMapping? mapping = Mapping(mappings, "Lines." + field);
            return mapping != null
                ? IntegrationRecordReader.MapValue(mapping, line)
                : Text(IntegrationRecordReader.ReadPath(line, char.ToLowerInvariant(field[0]) + field[1..]));
        }

        private static ApiFieldMapping? Mapping(List<ApiFieldMapping> mappings, string field)
        {
            return mappings.FirstOrDefault(x => x.TargetField.Equals($"{AREA}.{field}", StringComparison.OrdinalIgnoreCase));
        }

        private static string? Text(JsonElement? value)
        {
            if (value == null || value.Value.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined or JsonValueKind.Object or JsonValueKind.Array)
            {
                return null;
            }

            return value.Value.ValueKind == JsonValueKind.String ? value.Value.GetString() : value.Value.ToString();
        }

        private static decimal? Number(string? value)
        {
            return decimal.TryParse(value?.Replace(",", string.Empty).Trim(), NumberStyles.Number, CultureInfo.InvariantCulture, out decimal number) ? number : null;
        }
    }
}
