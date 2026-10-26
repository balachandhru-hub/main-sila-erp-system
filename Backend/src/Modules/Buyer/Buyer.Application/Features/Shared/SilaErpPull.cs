using System.Text.Json;
using System.Text.Json.Nodes;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The ERP reads of the SILA ME receiving masters (GET_SUPPLIER, GET_PO): which APIs are read and how a failed read is
    /// reported. Records are written by <see cref="SilaSupplierSync"/> and <see cref="SilaPurchaseOrderSync"/>.
    /// </summary>
    public static class SilaErpPull
    {
        /// <summary>The organization's active APIs of the type, the organization-wide one (ALL) first, then by company code.</summary>
        public static async Task<List<ApiIntegrationConfiguration>> ActiveConfigurationsAsync(
            IRepositoryWrapper repository, Guid organizationId, IntegrationProcessType processType, CancellationToken cancellationToken)
        {
            string code = processType.ToString();
            List<ApiIntegrationConfiguration> configurations = await repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(repository, organizationId).Contains(x.BuyerId)
                    && x.ProcessType == code
                    && x.Status == IntegrationConfigurationStatus.ACTIVE
                    && x.IsActive)
                .ToListAsync(cancellationToken);
            return configurations
                .OrderBy(x => x.EntityCode.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase) ? 0 : 1)
                .ThenBy(x => x.EntityCode)
                .ToList();
        }

        /// <summary>The records of one API; a failed call is a 424 that names the API.</summary>
        public static Task<List<JsonElement>> ReadAsync(
            IIntegrationHttpExecutor executor, ILoggerManager logger, ApiIntegrationConfiguration configuration, string what, CancellationToken cancellationToken)
        {
            return ReadAsync(executor, logger, configuration, what, null, cancellationToken);
        }

        /// <summary>
        /// The records of one API, optionally narrowed with an OData <c>$filter</c>. A failed call is a 424 that names the API.
        /// </summary>
        public static Task<List<JsonElement>> ReadAsync(
            IIntegrationHttpExecutor executor,
            ILoggerManager logger,
            ApiIntegrationConfiguration configuration,
            string what,
            string? odataFilter,
            CancellationToken cancellationToken)
        {
            return ReadAsync(executor, logger, configuration, what, odataFilter, null, cancellationToken);
        }

        /// <summary>
        /// The records of one API. <paramref name="adjustUrl"/> can add the item expand after the filter is applied.
        /// </summary>
        public static async Task<List<JsonElement>> ReadAsync(
            IIntegrationHttpExecutor executor,
            ILoggerManager logger,
            ApiIntegrationConfiguration configuration,
            string what,
            string? odataFilter,
            Func<string, string>? adjustUrl,
            CancellationToken cancellationToken,
            bool followPages = false)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(odataFilter))
                {
                    return await executor.PullRecordsAsync(configuration, true, cancellationToken);
                }

                // Full sync for a filtered pull: ignore the watermark so the date/company filter alone scopes the read.
                DateTime? watermark = configuration.LastWatermark;
                configuration.LastWatermark = null;
                string? url = AppendODataFilter(executor.BuildUrl(configuration, false), odataFilter.Trim());
                if (adjustUrl != null)
                {
                    url = adjustUrl(url);
                }

                configuration.LastWatermark = watermark;
                List<JsonElement> records = new List<JsonElement>();
                int page = 0;
                while (!string.IsNullOrWhiteSpace(url) && page < 20)
                {
                    page++;
                    string payload;
                    using (HttpResponseMessage response = await executor.SendAsync(configuration, url, HttpMethod.Get, null, cancellationToken))
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            throw new IntegrationException("REMOTE_HTTP_ERROR", $"The API returned HTTP {(int)response.StatusCode}.", 424);
                        }

                        payload = await response.Content.ReadAsStringAsync(cancellationToken);
                    }

                    records.AddRange(executor.ReadRecords(payload));
                    url = followPages ? NextLink(payload) : null;
                }

                return followPages ? await WithItemPagesAsync(executor, configuration, records, cancellationToken) : records;
            }
            catch (IntegrationException exception)
            {
                logger.LogError($"ERP {what} API call failed. ConfigurationId: {configuration.Id}, Code: {exception.Code}, Error: {SilaLogText.Short(exception.Message)}");
                throw new FailedDependencyCustomException($"The {what} API {configuration.Name} could not be read.", $"{exception.Message} Nothing was changed.");
            }
        }

        /// <summary>The next OData page, when the payload has one. A missing link means this page is the last.</summary>
        public static string? NextLink(string payload)
        {
            try
            {
                using JsonDocument document = JsonDocument.Parse(payload);
                return Link(document.RootElement);
            }
            catch (JsonException)
            {
                return null;
            }
        }

        /// <summary>Follows a paged purchase-order item expand and keeps every item on the purchase order.</summary>
        public static async Task<List<JsonElement>> WithItemPagesAsync(
            IIntegrationHttpExecutor executor,
            ApiIntegrationConfiguration configuration,
            List<JsonElement> records,
            CancellationToken cancellationToken)
        {
            List<JsonElement> complete = new List<JsonElement>(records.Count);
            foreach (JsonElement record in records)
            {
                string? next = ItemNext(record);
                if (next == null)
                {
                    complete.Add(record);
                    continue;
                }

                List<JsonElement> items = ItemArray(record).ToList();
                int page = 0;
                while (!string.IsNullOrWhiteSpace(next) && page < 20)
                {
                    page++;
                    string payload;
                    using (HttpResponseMessage response = await executor.SendAsync(configuration, next, HttpMethod.Get, null, cancellationToken))
                    {
                        if (!response.IsSuccessStatusCode)
                        {
                            throw new IntegrationException("REMOTE_HTTP_ERROR", $"The API returned HTTP {(int)response.StatusCode}.", 424);
                        }

                        payload = await response.Content.ReadAsStringAsync(cancellationToken);
                    }

                    items.AddRange(executor.ReadRecords(payload));
                    next = NextLink(payload);
                }

                complete.Add(ReplaceItems(record, items));
            }

            return complete;
        }

        public static JsonElement ReplaceItems(JsonElement record, IReadOnlyList<JsonElement> items)
        {
            JsonNode? node = JsonNode.Parse(record.GetRawText());
            if (node is not JsonObject header)
            {
                return record;
            }

            JsonArray array = new JsonArray();
            foreach (JsonElement item in items)
            {
                JsonNode? copy = JsonNode.Parse(item.GetRawText());
                if (copy != null)
                {
                    array.Add(copy);
                }
            }

            if (header[SilaPurchaseOrderInvoiceRead.ITEM_EXPAND] is JsonObject expand)
            {
                expand["results"] = array;
                expand.Remove("__next");
                expand.Remove("@odata.nextLink");
            }
            else
            {
                header[SilaPurchaseOrderInvoiceRead.ITEM_EXPAND] = new JsonObject { ["results"] = array };
            }

            return JsonDocument.Parse(header.ToJsonString()).RootElement.Clone();
        }

        private static string? Link(JsonElement element)
        {
            if (element.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            foreach (string name in new[] { "@odata.nextLink", "odata.nextLink", "__next" })
            {
                if (element.TryGetProperty(name, out JsonElement link) && link.ValueKind == JsonValueKind.String)
                {
                    string? url = link.GetString();
                    if (!string.IsNullOrWhiteSpace(url))
                    {
                        return url;
                    }
                }
            }

            if (element.TryGetProperty("d", out JsonElement wrapped))
            {
                return Link(wrapped);
            }

            return null;
        }

        private static string? ItemNext(JsonElement record)
        {
            if (!record.TryGetProperty(SilaPurchaseOrderInvoiceRead.ITEM_EXPAND, out JsonElement items) || items.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            return Link(items);
        }

        private static IEnumerable<JsonElement> ItemArray(JsonElement record)
        {
            if (!record.TryGetProperty(SilaPurchaseOrderInvoiceRead.ITEM_EXPAND, out JsonElement items))
            {
                yield break;
            }

            JsonElement array = items;
            if (items.ValueKind == JsonValueKind.Object && items.TryGetProperty("results", out JsonElement results))
            {
                array = results;
            }

            if (array.ValueKind != JsonValueKind.Array)
            {
                yield break;
            }

            foreach (JsonElement item in array.EnumerateArray())
            {
                yield return item;
            }
        }

        /// <summary>Adds or merges an OData <c>$filter</c> on a URL that may already have a query string.</summary>
        public static string AppendODataFilter(string url, string filter)
        {
            string encoded = Uri.EscapeDataString(filter);
            int filterAt = url.IndexOf("$filter=", StringComparison.OrdinalIgnoreCase);
            if (filterAt < 0)
            {
                return url + (url.Contains('?') ? "&" : "?") + "$filter=" + encoded;
            }

            // Merge with an existing filter (e.g. watermark): (...existing...) and (extra).
            int valueStart = filterAt + "$filter=".Length;
            int valueEnd = url.IndexOf('&', valueStart);
            if (valueEnd < 0)
            {
                valueEnd = url.Length;
            }

            string existing = Uri.UnescapeDataString(url[valueStart..valueEnd]);
            string merged = $"({existing}) and ({filter})";
            return url[..valueStart] + Uri.EscapeDataString(merged) + url[valueEnd..];
        }

        /// <summary>Adds the row outcomes to the pull result, with the first errors.</summary>
        public static void Count(SilaMasterPullResultDto result, List<SilaMasterImportRowDto> rows, int errorLimit)
        {
            result.Created += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_NEW);
            result.Updated += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_UPDATE);
            result.Unchanged += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_UNCHANGED);
            result.Invalid += rows.Count(x => x.Action == SilaReceivingExcel.ACTION_INVALID);
            foreach (SilaMasterImportRowDto row in rows.Where(x => x.Action == SilaReceivingExcel.ACTION_INVALID))
            {
                if (result.Errors.Count >= errorLimit)
                {
                    break;
                }

                result.Errors.Add($"Record {row.RowNumber}{(row.Key.Length > 0 ? $" ({row.Key})" : string.Empty)}: {string.Join(" ", row.Errors)}");
            }
        }
    }
}
