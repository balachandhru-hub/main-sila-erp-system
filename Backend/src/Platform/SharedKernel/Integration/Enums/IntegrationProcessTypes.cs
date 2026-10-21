namespace SharedKernel.Integration.Enums
{
    /// <summary>
    /// Reads a stored API type without throwing when the database has a code this build does not list.
    /// Listing integrations must never fail because of one new process type.
    /// </summary>
    public static class IntegrationProcessTypes
    {
        public static bool TryRead(string? value, out IntegrationProcessType type)
        {
            string code = (value ?? string.Empty).Trim();
            if (code.Length == 0
                || !Enum.TryParse(code, ignoreCase: true, out type)
                || !Enum.IsDefined(type)
                || !string.Equals(type.ToString(), code, StringComparison.OrdinalIgnoreCase))
            {
                type = default;
                return false;
            }

            return true;
        }

        public static IntegrationProcessType? ReadOrNull(string? value)
        {
            return TryRead(value, out IntegrationProcessType type) ? type : null;
        }
    }
}
