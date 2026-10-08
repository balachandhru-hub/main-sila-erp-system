namespace Buyer.Domain.Dtos
{
    public class IntegrationSendResultDto
    {
        /// <summary>False when the API never answered (it could not be reached, timed out, or sign-in failed).</summary>
        public bool Answered { get; set; }

        /// <summary>True when the document may exist although no clear answer came back.</summary>
        public bool OutcomeUnknown { get; set; }
        public int StatusCode { get; set; }
        public string? ResponseBody { get; set; }

        /// <summary>
        /// The document number found in the whole answer of the API (a successful call only). It is read before ResponseBody is cut
        /// to its limit: a long answer, such as the purchase order S/4 returns, is cut in the middle of its JSON, and the number
        /// can no longer be read from the part that is kept.
        /// </summary>
        public string? DocumentNumber { get; set; }
        public string? ErrorCode { get; set; }
        public string? ErrorMessage { get; set; }
        public long DurationMs { get; set; }
    }
}
