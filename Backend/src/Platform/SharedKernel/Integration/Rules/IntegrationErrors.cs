using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Services;

namespace SharedKernel.Integration.Rules
{
    /// <summary>
    /// Translates a failure of an integration engine into the solution's exceptions, so the
    /// exception middleware answers with the standard message / description body.
    /// </summary>
    public static class IntegrationErrors
    {
        public static BaseCustomException ToCustomException(IntegrationException exception)
        {
            string description = $"Code: {exception.Code}";
            return exception.Status switch
            {
                404 => new NotFoundCustomException(exception.Message, description),
                409 => new ConflictCustomException(exception.Message, description),
                424 => new FailedDependencyCustomException(exception.Message, description),
                _ => new BadRequestCustomException(exception.Message, description),
            };
        }
    }
}
