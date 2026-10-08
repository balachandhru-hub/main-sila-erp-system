using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RespondSilaEnquiry
{
    public class RespondSilaEnquiryCommandHandler : IRequestHandler<RespondSilaEnquiryCommand, Unit>
    {
        private const string EVENT_RESPONDED = "RESPONDED";
        private const int MAX_RESPONSE_LENGTH = 2000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public RespondSilaEnquiryCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(RespondSilaEnquiryCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Responding to shortage enquiry. EnquiryId: {request.EnquiryId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockShortageEnquiry enquiry = await SilaEnquiryRules.GetEnquiryAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.EnquiryId, cancellationToken);
            if (enquiry.Status != Common.SILA_ENQUIRY_SENT
                && enquiry.Status != Common.SILA_ENQUIRY_RESPONDED
                && enquiry.Status != Common.SILA_ENQUIRY_MORE_INFORMATION)
            {
                _logger.LogError($"Enquiry cannot be answered. EnquiryId: {enquiry.Id}, Status: {enquiry.Status}");
                throw new BadRequestCustomException("Enquiry is closed.", $"Enquiry {enquiry.EnquiryNumber} is {enquiry.Status} and cannot be answered again.");
            }

            string category = (request.Request.JustificationCategory ?? string.Empty).Trim().ToUpperInvariant();
            if (!SilaEnquiryRules.JustificationCategories.Contains(category))
            {
                _logger.LogError($"Invalid justification category. Category: {request.Request.JustificationCategory}");
                throw new BadRequestCustomException("Justification category is not valid.", "Choose one of the listed justification categories.");
            }

            if (string.IsNullOrWhiteSpace(request.Request.Response))
            {
                _logger.LogError($"Enquiry response is empty. EnquiryId: {enquiry.Id}");
                throw new BadRequestCustomException("Response is required.", "Explain the shortage before sending the response.");
            }

            if (request.Request.Response.Trim().Length > MAX_RESPONSE_LENGTH)
            {
                _logger.LogError($"Enquiry response too long. EnquiryId: {enquiry.Id}, Length: {request.Request.Response.Length}");
                throw new BadRequestCustomException("Response is too long.", $"Keep the response within {MAX_RESPONSE_LENGTH} characters.");
            }

            if (enquiry.Status == Common.SILA_ENQUIRY_MORE_INFORMATION)
            {
                // The new answer goes back to the cost controller for a decision.
                StockCountItem? item = await _repository.StockCountItem.FindFirstByConditionAsync(x => x.Id == enquiry.StockCountItemId && x.IsActive);
                if (item != null && item.ReviewStatus == Common.SILA_ENQUIRY_MORE_INFORMATION)
                {
                    item.ReviewStatus = null;
                }
            }

            enquiry.JustificationCategory = category;
            enquiry.Response = request.Request.Response.Trim();
            enquiry.Status = Common.SILA_ENQUIRY_RESPONDED;
            enquiry.RespondedBy = request.UserId;
            enquiry.RespondedOn = DateTime.UtcNow;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ENQUIRY, enquiry.Id, EVENT_RESPONDED, $"{category}: {enquiry.Response}");
            await _repository.SaveAsync();

            _logger.LogInfo($"Shortage enquiry answered. EnquiryId: {enquiry.Id}, Category: {category}");
            return Unit.Value;
        }
    }
}
