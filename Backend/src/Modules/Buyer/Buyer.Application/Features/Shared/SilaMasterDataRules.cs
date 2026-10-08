using System.Text.RegularExpressions;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Validation, normalisation and read models of the SILA ME receiving masters (Supplier Master, Company Code Master),
    /// shared by the create/update commands, the Excel imports and the ERP pulls; and the fuzzy supplier name match.
    /// </summary>
    public static class SilaMasterDataRules
    {
        public const string STATUS_ACTIVE = "ACTIVE";
        public const string STATUS_INACTIVE = "INACTIVE";
        /// <summary>A blocked supplier keeps its history but gets no new purchase orders or invoice matches.</summary>
        public const string STATUS_BLOCKED = "BLOCKED";
        public static readonly string[] SupplierStatuses = { STATUS_ACTIVE, STATUS_INACTIVE, STATUS_BLOCKED };
        public static readonly string[] CompanyCodeStatuses = { STATUS_ACTIVE, STATUS_INACTIVE };

        /// <summary>The columns of the Supplier Master workbook, in order; the import reads them by name.</summary>
        public static readonly string[] SupplierColumns = { "SupplierCode", "Name", "TaxNumber", "Aliases", "Country", "Status", "LegalName", "City", "Address", "Currency" };

        /// <summary>The columns of the Company Code Master workbook, in order.</summary>
        public static readonly string[] CompanyCodeColumns = { "Code", "Name", "Country", "Currency" };

        private const int CODE_LENGTH = 50;
        private const int NAME_LENGTH = 200;
        private const int TAX_LENGTH = 50;
        private const int ALIAS_LENGTH = 200;
        private const int ALIASES_LENGTH = 1000;
        private const int CITY_LENGTH = 100;
        private const int ADDRESS_LENGTH = 500;

        private static readonly Regex CodePattern = new Regex(@"^[A-Za-z0-9][A-Za-z0-9_./-]*$", RegexOptions.Compiled);
        private static readonly Regex CountryPattern = new Regex(@"^[A-Z]{2,3}$", RegexOptions.Compiled);
        private static readonly Regex CurrencyPattern = new Regex(@"^[A-Z]{3}$", RegexOptions.Compiled);

        // Words that do not tell suppliers apart ("Gulf Foods LLC" is "Gulf Foods").
        private static readonly HashSet<string> LegalWords = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
        {
            "LLC", "L", "C", "LTD", "LIMITED", "CO", "COMPANY", "INC", "CORP", "CORPORATION", "FZE", "FZCO", "FZ", "FZC", "LLP", "PLC",
            "GMBH", "SA", "SPA", "BV", "EST", "ESTABLISHMENT", "THE", "AND", "TRADING", "GROUP", "PVT", "PRIVATE"
        };

        /// <summary>The supplier fields trimmed and upper-cased where codes are expected.</summary>
        public static SilaSupplierWriteDto Normalize(SilaSupplierWriteDto input)
        {
            return new SilaSupplierWriteDto
            {
                SupplierCode = (input.SupplierCode ?? string.Empty).Trim().ToUpperInvariant(),
                Name = (input.Name ?? string.Empty).Trim(),
                TaxNumber = Clean(input.TaxNumber)?.ToUpperInvariant(),
                Aliases = (input.Aliases ?? new List<string>())
                    .SelectMany(alias => (alias ?? string.Empty).Split(',', ';'))
                    .Select(alias => alias.Trim())
                    .Where(alias => alias.Length > 0)
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToList(),
                Country = Clean(input.Country)?.ToUpperInvariant(),
                Status = string.IsNullOrWhiteSpace(input.Status) ? STATUS_ACTIVE : input.Status.Trim().ToUpperInvariant(),
                SupplierOrganizationId = input.SupplierOrganizationId == Guid.Empty ? null : input.SupplierOrganizationId,
                LegalName = Clean(input.LegalName),
                City = Clean(input.City),
                Address = Clean(input.Address),
                Currency = Clean(input.Currency)?.ToUpperInvariant()
            };
        }

        /// <summary>What is wrong with a normalised supplier; empty when it can be saved.</summary>
        public static List<string> SupplierErrors(SilaSupplierWriteDto supplier)
        {
            List<string> errors = new List<string>();
            if (supplier.SupplierCode.Length == 0)
            {
                errors.Add("Supplier code is required.");
            }
            else if (supplier.SupplierCode.Length > CODE_LENGTH || !CodePattern.IsMatch(supplier.SupplierCode))
            {
                errors.Add($"Supplier code must be at most {CODE_LENGTH} letters, digits or _ . / -.");
            }

            if (supplier.Name.Length == 0)
            {
                errors.Add("Supplier name is required.");
            }
            else if (supplier.Name.Length > NAME_LENGTH)
            {
                errors.Add($"Supplier name must be at most {NAME_LENGTH} characters.");
            }

            if (supplier.TaxNumber != null && supplier.TaxNumber.Length > TAX_LENGTH)
            {
                errors.Add($"Tax number must be at most {TAX_LENGTH} characters.");
            }

            List<string> aliases = supplier.Aliases ?? new List<string>();
            if (aliases.Any(alias => alias.Length > ALIAS_LENGTH) || string.Join(",", aliases).Length > ALIASES_LENGTH)
            {
                errors.Add($"Aliases must be at most {ALIAS_LENGTH} characters each and {ALIASES_LENGTH} in total.");
            }

            if (supplier.Country != null && !CountryPattern.IsMatch(supplier.Country))
            {
                errors.Add("Country must be a 2 or 3 letter ISO code, for example AE.");
            }

            if (!SupplierStatuses.Contains(supplier.Status))
            {
                errors.Add("Status must be ACTIVE, INACTIVE or BLOCKED.");
            }

            if ((supplier.LegalName?.Length ?? 0) > NAME_LENGTH)
            {
                errors.Add($"Legal name must be at most {NAME_LENGTH} characters.");
            }

            if ((supplier.City?.Length ?? 0) > CITY_LENGTH)
            {
                errors.Add($"City must be at most {CITY_LENGTH} characters.");
            }

            if ((supplier.Address?.Length ?? 0) > ADDRESS_LENGTH)
            {
                errors.Add($"Address must be at most {ADDRESS_LENGTH} characters.");
            }

            if (supplier.Currency != null && !CurrencyPattern.IsMatch(supplier.Currency))
            {
                errors.Add("Currency must be a 3 letter ISO code, for example AED.");
            }

            return errors;
        }

        /// <summary>Copies a normalised supplier onto the row; returns whether anything changed.</summary>
        public static bool Apply(SilaSupplier entity, SilaSupplierWriteDto supplier)
        {
            string? aliases = supplier.Aliases == null || supplier.Aliases.Count == 0 ? null : string.Join(",", supplier.Aliases);
            bool changed = entity.SupplierCode != supplier.SupplierCode
                || entity.Name != supplier.Name
                || entity.TaxNumber != supplier.TaxNumber
                || entity.Aliases != aliases
                || entity.Country != supplier.Country
                || entity.Status != supplier.Status
                || entity.SupplierOrganizationId != supplier.SupplierOrganizationId
                || entity.LegalName != supplier.LegalName
                || entity.City != supplier.City
                || entity.Address != supplier.Address
                || entity.Currency != supplier.Currency
                || !entity.IsActive;
            entity.LegalName = supplier.LegalName;
            entity.City = supplier.City;
            entity.Address = supplier.Address;
            entity.Currency = supplier.Currency;
            entity.SupplierCode = supplier.SupplierCode;
            entity.Name = supplier.Name;
            entity.TaxNumber = supplier.TaxNumber;
            entity.Aliases = aliases;
            entity.Country = supplier.Country;
            entity.Status = supplier.Status ?? STATUS_ACTIVE;
            entity.SupplierOrganizationId = supplier.SupplierOrganizationId;
            entity.IsActive = true;
            return changed;
        }

        public static SilaSupplierDto ToDto(SilaSupplier supplier)
        {
            return new SilaSupplierDto
            {
                Id = supplier.Id,
                SupplierCode = supplier.SupplierCode,
                Name = supplier.Name,
                TaxNumber = supplier.TaxNumber,
                Aliases = SplitAliases(supplier.Aliases),
                Country = supplier.Country,
                Status = supplier.Status,
                SupplierOrganizationId = supplier.SupplierOrganizationId,
                UpdatedOn = supplier.DateUpdated == default ? supplier.DateCreated : supplier.DateUpdated,
                Trn = supplier.TaxNumber,
                LegalName = supplier.LegalName,
                City = supplier.City,
                Address = supplier.Address,
                Currency = supplier.Currency,
                IsBlocked = supplier.Status == STATUS_BLOCKED
            };
        }

        public static List<string> SplitAliases(string? aliases)
        {
            return (aliases ?? string.Empty).Split(',').Select(x => x.Trim()).Where(x => x.Length > 0).ToList();
        }

        public static SilaCompanyCodeWriteDto Normalize(SilaCompanyCodeWriteDto input)
        {
            return new SilaCompanyCodeWriteDto
            {
                Code = (input.Code ?? string.Empty).Trim().ToUpperInvariant(),
                Name = (input.Name ?? string.Empty).Trim(),
                Country = Clean(input.Country)?.ToUpperInvariant(),
                Currency = Clean(input.Currency)?.ToUpperInvariant()
            };
        }

        public static List<string> CompanyCodeErrors(SilaCompanyCodeWriteDto companyCode)
        {
            List<string> errors = new List<string>();
            if (companyCode.Code.Length == 0)
            {
                errors.Add("Company code is required.");
            }
            else if (companyCode.Code.Length > CODE_LENGTH || !CodePattern.IsMatch(companyCode.Code)
                || companyCode.Code.Equals(SharedKernel.Integration.IntegrationConstants.ENTITY_CODE_ALL, StringComparison.OrdinalIgnoreCase))
            {
                errors.Add($"Company code must be at most {CODE_LENGTH} letters, digits or _ . / - (ALL is reserved).");
            }

            if (companyCode.Name.Length == 0)
            {
                errors.Add("Company name is required.");
            }
            else if (companyCode.Name.Length > NAME_LENGTH)
            {
                errors.Add($"Company name must be at most {NAME_LENGTH} characters.");
            }

            if (companyCode.Country != null && !CountryPattern.IsMatch(companyCode.Country))
            {
                errors.Add("Country must be a 2 or 3 letter ISO code, for example AE.");
            }

            if (companyCode.Currency != null && !CurrencyPattern.IsMatch(companyCode.Currency))
            {
                errors.Add("Currency must be a 3 letter ISO code, for example AED.");
            }

            return errors;
        }

        public static bool Apply(CompanyCodeMaster entity, SilaCompanyCodeWriteDto companyCode)
        {
            bool changed = entity.Code != companyCode.Code || entity.Name != companyCode.Name
                || entity.Country != companyCode.Country || entity.Currency != companyCode.Currency || !entity.IsActive;
            entity.Code = companyCode.Code;
            entity.Name = companyCode.Name;
            entity.Country = companyCode.Country;
            entity.Currency = companyCode.Currency;
            entity.IsActive = true;
            return changed;
        }

        public static SilaCompanyCodeDto ToDto(CompanyCodeMaster companyCode)
        {
            return new SilaCompanyCodeDto
            {
                Id = companyCode.Id,
                Code = companyCode.Code,
                Name = companyCode.Name,
                Country = companyCode.Country,
                Currency = companyCode.Currency,
                UpdatedOn = companyCode.DateUpdated == default ? companyCode.DateCreated : companyCode.DateUpdated,
                Status = string.IsNullOrWhiteSpace(companyCode.Status) ? STATUS_ACTIVE : companyCode.Status
            };
        }

        /// <summary>A supplier name reduced to its distinctive words in upper case ("Gulf Foods L.L.C." is "GULF FOODS").</summary>
        public static string NameKey(string? name)
        {
            IEnumerable<string> words = Words(name).Where(word => !LegalWords.Contains(word));
            return string.Join(' ', words);
        }

        /// <summary>How alike two supplier names are, 0 (nothing in common) to 100 (the same name).</summary>
        public static int Similarity(string? left, string? right)
        {
            string leftKey = NameKey(left);
            string rightKey = NameKey(right);
            if (leftKey.Length == 0 || rightKey.Length == 0)
            {
                return 0;
            }

            if (leftKey == rightKey)
            {
                return 100;
            }

            if (leftKey.Contains(rightKey, StringComparison.Ordinal) || rightKey.Contains(leftKey, StringComparison.Ordinal))
            {
                return 85;
            }

            HashSet<string> leftWords = leftKey.Split(' ').ToHashSet();
            HashSet<string> rightWords = rightKey.Split(' ').ToHashSet();
            int common = leftWords.Intersect(rightWords).Count();
            int all = leftWords.Union(rightWords).Count();
            return all == 0 ? 0 : common * 80 / all;
        }

        /// <summary>A tax number without spaces, dashes and dots, for comparison.</summary>
        public static string TaxKey(string? taxNumber)
        {
            return new string((taxNumber ?? string.Empty).Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant();
        }

        private static IEnumerable<string> Words(string? name)
        {
            string letters = new string((name ?? string.Empty).Select(c => char.IsLetterOrDigit(c) ? char.ToUpperInvariant(c) : ' ').ToArray());
            return letters.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        }

        private static string? Clean(string? value)
        {
            return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        }
    }
}
