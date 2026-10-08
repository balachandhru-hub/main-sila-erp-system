using Microsoft.AspNetCore.Mvc.Filters;
using SharedKernel.ExceptionHandler;

namespace SharedKernel.Attributes
{
    /// <summary>
    /// Allows the endpoints only to callers whose organization is of the given type
    /// (the "OrganizationType" claim of the token, for example "Buyer" or "Supplier").
    /// </summary>
    [AttributeUsage(AttributeTargets.Class | AttributeTargets.Method)]
    public sealed class OrganizationTypeAttribute : ActionFilterAttribute
    {
        private readonly string _organizationType;

        public OrganizationTypeAttribute(string organizationType)
        {
            _organizationType = organizationType;
        }

        public override void OnActionExecuting(ActionExecutingContext context)
        {
            string? callerType = context.HttpContext.User.FindFirst("OrganizationType")?.Value;
            if (!string.Equals(callerType, _organizationType, StringComparison.OrdinalIgnoreCase))
            {
                throw new ForBiddenCustomException(
                    "Not available for this organization.",
                    $"These endpoints belong to {_organizationType.ToLowerInvariant()} organizations.");
            }
        }
    }
}
