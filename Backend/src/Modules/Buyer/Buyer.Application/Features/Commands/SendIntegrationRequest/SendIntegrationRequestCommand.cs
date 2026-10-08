using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Commands.SendIntegrationRequest
{
    /// <summary>
    /// Sends one document (a purchase order) to the organization's API with the saved sign-in, once.
    /// </summary>
    public class SendIntegrationRequestCommand : IRequest<IntegrationSendResultDto>
    {
        public Guid OrganizationId { get; set; }
        public Guid ConfigurationId { get; set; }
        /// <summary>The document to send, already in the API's payload format.</summary>
        public string Body { get; set; } = string.Empty;
        /// <summary>Headers of this one call, for example an idempotency key.</summary>
        public Dictionary<string, string>? Headers { get; set; }

        /// <summary>Characters of the answer kept; an answer that is read (an invoice extraction) needs more than the default.</summary>
        public int ResponseLimit { get; set; } = 4000;
    }
}
