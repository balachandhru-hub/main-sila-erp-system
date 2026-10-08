using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.LoggerServices;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Validates the field mappings sent for an integration configuration and builds the rows that
    /// replace the stored ones.
    /// </summary>
    public static class IntegrationMappingRules
    {
        public static List<ApiFieldMapping> Build(ILoggerManager logger, ApiIntegrationConfiguration configuration, List<FieldMappingInputDto> inputs)
        {
            bool invalid = inputs.Any(input => string.IsNullOrWhiteSpace(input.SourceField) || string.IsNullOrWhiteSpace(input.TargetField)
                || !IntegrationTargetFieldRegistry.Contains(input.TargetField.Trim())
                || !IntegrationProcessCatalog.OwnsTarget(configuration.ProcessType, input.TargetField.Trim())
                || input.SourceField.Trim().Contains(' ') || input.SourceField.Length > 250);
            if (invalid)
            {
                logger.LogError($"Integration mapping is invalid. ConfigurationId: {configuration.Id}");
                throw new BadRequestCustomException("Invalid field mapping.", "Every mapping must use a target field of this API type and a valid source field.");
            }

            // Each API type names its required fields in the process catalog.
            string[] requiredTargets = IntegrationProcessCatalog.Find(configuration.ProcessType)?.RequiredTargets ?? Array.Empty<string>();
            List<string> missingTargets = requiredTargets
                .Where(target => !inputs.Any(input => input.TargetField.Trim().Equals(target, StringComparison.OrdinalIgnoreCase)))
                .ToList();
            if (missingTargets.Count > 0)
            {
                logger.LogError($"Required mappings are missing. ConfigurationId: {configuration.Id}, Missing: {string.Join(", ", missingTargets)}");
                throw new BadRequestCustomException("Required mapping is missing.", $"Map these fields: {string.Join(", ", missingTargets)}.");
            }

            if (inputs.GroupBy(input => input.TargetField.Trim(), StringComparer.OrdinalIgnoreCase).Any(group => group.Count() > 1))
            {
                logger.LogError($"A target field is mapped twice. ConfigurationId: {configuration.Id}");
                throw new BadRequestCustomException("Invalid field mapping.", "A target field can be mapped only once.");
            }

            return inputs.Select(input => new ApiFieldMapping
            {
                Id = Guid.NewGuid(),
                ConfigurationId = configuration.Id,
                SourceField = input.SourceField.Trim(),
                TargetField = input.TargetField.Trim(),
                // "NONE" (or anything unknown) means the value is taken as it is.
                Transformation = input.Transformation?.Trim().ToUpperInvariant() switch
                {
                    "TRIM" => "TRIM",
                    "UPPER" => "UPPER",
                    "LOWER" => "LOWER",
                    _ => null
                },
                NullPolicy = input.NullPolicy,
                DefaultValue = input.DefaultValue,
                IsValidated = true
            }).ToList();
        }
    }
}
