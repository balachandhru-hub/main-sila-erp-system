using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Applies the records of a GET_MATERIAL pull (target fields Material.*) to the material master: unknown codes become
    /// new materials, known ones get their description and group updated, and a price that differs from the approved one
    /// becomes a price change request (approval) — the approved price is never overwritten. The base unit of an existing
    /// material is not changed (stock is kept in it). The caller saves.
    /// </summary>
    public static class SilaMaterialErpSync
    {
        public const string SOURCE_ERP = "ERP";
        private const int MAX_CODE_LENGTH = 40;
        private const int MAX_FAILURES = 200;

        public static async Task ApplyAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid userId,
            string companyCode,
            List<ApiFieldMapping> mappings,
            List<JsonElement> records,
            SilaMaterialErpPullResultDto result,
            CancellationToken cancellationToken)
        {
            List<string> codes = records
                .Select(record => IntegrationRecordReader.Read(mappings, "Material.Code", record)?.Trim().ToUpperInvariant())
                .Where(code => !string.IsNullOrEmpty(code))
                .Select(code => code!)
                .Distinct()
                .ToList();
            Dictionary<string, ItemBuyerMaster> materials = new Dictionary<string, ItemBuyerMaster>(StringComparer.OrdinalIgnoreCase);
            foreach (ItemBuyerMaster material in await repository.ItemBuyerMaster
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && codes.Contains(x.MaterialCode))
                .ToListAsync(cancellationToken))
            {
                materials.TryAdd(material.MaterialCode.Trim(), material);
            }

            Dictionary<Guid, MaterialPriceChange> pending = await SilaMaterialRules.GetPendingChangesAsync(
                repository, buyerId, materials.Values.Select(x => x.Id), cancellationToken);
            ApprovalScope scope = await SilaMaterialPricing.GetScopeAsync(repository, buyerId, cancellationToken);
            bool flowExists = await FlowExistsAsync(repository, logger, buyerId, scope, cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> noConversions = new Dictionary<Guid, List<MaterialUomConversion>>();
            HashSet<string> seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            string reason = $"ERP material pull, company code {companyCode}";
            string? syncedCompanyCode = string.IsNullOrWhiteSpace(companyCode) || companyCode.Trim().ToUpperInvariant() == "ALL" ? null : companyCode.Trim();

            foreach (JsonElement record in records)
            {
                result.Read++;
                string code = IntegrationRecordReader.Read(mappings, "Material.Code", record)?.Trim().ToUpperInvariant() ?? string.Empty;
                string? description = Clean(IntegrationRecordReader.Read(mappings, "Material.Description", record), 500);
                string? baseUom = Clean(IntegrationRecordReader.Read(mappings, "Material.BaseUom", record), 20)?.ToUpperInvariant();
                string? group = Clean(IntegrationRecordReader.Read(mappings, "Material.MaterialGroup", record), 100);
                string? priceText = IntegrationRecordReader.Read(mappings, "Material.UnitPrice", record);
                decimal? price = IntegrationRecordReader.ParseDecimal(priceText);
                string? currency = Clean(IntegrationRecordReader.Read(mappings, "Material.Currency", record), 3)?.ToUpperInvariant();

                if (code.Length == 0 || code.Length > MAX_CODE_LENGTH)
                {
                    Fail(result, $"Record {result.Read}: the material code is missing or longer than {MAX_CODE_LENGTH} characters.");
                    continue;
                }

                if (!seen.Add(code))
                {
                    Fail(result, $"{code}: appears more than once in the ERP response; only the first record was used.");
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(priceText) && price == null)
                {
                    Fail(result, $"{code}: the unit price '{priceText}' is not a number.");
                    continue;
                }

                bool isNew = !materials.TryGetValue(code, out ItemBuyerMaster? material);
                bool changed = false;
                if (material == null)
                {
                    if (string.IsNullOrEmpty(baseUom))
                    {
                        Fail(result, $"{code}: the base unit of measure is missing; a new material needs one.");
                        continue;
                    }

                    material = NewMaterial(buyerId, code, description, baseUom, group, currency);
                    material.CompanyCode = syncedCompanyCode;
                    repository.ItemBuyerMaster.Create(material);
                    materials[code] = material;
                }
                else
                {
                    changed = Update(material, description, group);
                    if (syncedCompanyCode != null && material.CompanyCode != syncedCompanyCode)
                    {
                        material.CompanyCode = syncedCompanyCode;
                        changed = true;
                    }

                    if (changed)
                    {
                        repository.ItemBuyerMaster.Update(material);
                    }
                }

                bool priceRequested = false;
                if (price != null && price.Value != material.UnitCost)
                {
                    if (pending.ContainsKey(material.Id))
                    {
                        Note(result, $"{code}: ERP price {price} not requested, a price change is already waiting for approval.");
                    }
                    else if (!flowExists)
                    {
                        Note(result, $"{code}: ERP price {price} not requested, no {Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE} approval flow exists (material fields were saved).");
                    }
                    else
                    {
                        List<string> errors = SilaMaterialPricing.Validate(
                            logger, material, noConversions, price.Value, currency, null, reason, out _, out _);
                        if (errors.Count > 0)
                        {
                            Note(result, $"{code}: ERP price not requested. {string.Join(" ", errors)}");
                        }
                        else
                        {
                            await SilaMaterialPricing.CreateAsync(
                                repository, logger, buyerId, material, noConversions, price.Value, currency, null, null, reason, userId, scope, cancellationToken);
                            priceRequested = true;
                            result.PriceChanges++;
                        }
                    }
                }

                CountOutcome(result, isNew, changed || priceRequested);
            }
        }

        private static async Task<bool> FlowExistsAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, ApprovalScope scope, CancellationToken cancellationToken)
        {
            try
            {
                _ = await SilaApprovals.ResolveFlowAsync(repository, logger, buyerId, Common.SILA_APPROVAL_TYPE_MATERIAL_PRICE, scope, cancellationToken);
                return true;
            }
            catch (BadRequestCustomException)
            {
                return false;
            }
        }

        private static ItemBuyerMaster NewMaterial(Guid buyerId, string code, string? description, string baseUom, string? group, string? currency)
        {
            return new ItemBuyerMaster
            {
                Id = Guid.NewGuid(),
                BuyerId = buyerId,
                MaterialCode = code,
                Description = description ?? code,
                MaterialGroup = group ?? string.Empty,
                ProductType = string.Empty,
                BaseUnitOfMeasure = baseUom,
                OrderUnitOfMeasure = baseUom,
                AlternateUnitOfMeasure = string.Empty,
                ValuationClass = string.Empty,
                UnitOfMeasureMapping = string.Empty,
                Currency = currency,
                Source = SOURCE_ERP,
                IsActive = true
            };
        }

        private static bool Update(ItemBuyerMaster material, string? description, string? group)
        {
            bool changed = false;
            if (description != null && description != material.Description)
            {
                material.Description = description;
                changed = true;
            }

            if (group != null && group != material.MaterialGroup)
            {
                material.MaterialGroup = group;
                changed = true;
            }

            return changed;
        }

        private static void CountOutcome(SilaMaterialErpPullResultDto result, bool isNew, bool changed)
        {
            if (isNew)
            {
                result.New++;
            }
            else if (changed)
            {
                result.Changed++;
            }
            else
            {
                result.Unchanged++;
            }
        }

        private static void Fail(SilaMaterialErpPullResultDto result, string message)
        {
            result.Failed++;
            Note(result, message);
        }

        /// <summary>A message about a record that was still applied (e.g. its price was not requested).</summary>
        private static void Note(SilaMaterialErpPullResultDto result, string message)
        {
            if (result.Failures.Count < MAX_FAILURES)
            {
                result.Failures.Add(message);
            }
        }

        private static string? Clean(string? value, int maxLength)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return null;
            }

            string trimmed = value.Trim();
            return trimmed.Length > maxLength ? trimmed.Substring(0, maxLength) : trimmed;
        }
    }
}
