namespace Buyer.Application.Features.Shared
{
    /// <summary>Why a location write is refused: Kind is BAD_REQUEST, NOT_FOUND or CONFLICT.</summary>
    public class SilaLocationIssue
    {
        public const string BAD_REQUEST = "BAD_REQUEST";
        public const string NOT_FOUND = "NOT_FOUND";
        public const string CONFLICT = "CONFLICT";

        public string Kind { get; set; } = BAD_REQUEST;
        public string Message { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;

        public static SilaLocationIssue Of(string kind, string message, string description)
        {
            return new SilaLocationIssue { Kind = kind, Message = message, Description = description };
        }
    }
}
