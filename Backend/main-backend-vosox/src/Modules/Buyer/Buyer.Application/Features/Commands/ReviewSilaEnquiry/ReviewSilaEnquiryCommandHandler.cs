using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReviewSilaEnquiry
{
    public class ReviewSilaEnquiryCommandHandler : IRequestHandler<ReviewSilaEnquiryCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReviewSilaEnquiryCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(ReviewSilaEnquiryCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Reviewing shortage enquiry. EnquiryId: {request.EnquiryId}, Accept: {request.Request.Accept}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockShortageEnquiry enquiry = await SilaEnquiryRules.GetEnquiryAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.EnquiryId, cancellationToken);
            if (enquiry.Status != Common.SILA_ENQUIRY_RESPONDED)
            {
                _logger.LogError($"Enquiry cannot be reviewed. EnquiryId: {enquiry.Id}, Status: {enquiry.Status}");
                throw new BadRequestCustomException(
                    "Enquiry cannot be reviewed.",
                    enquiry.Status == Common.SILA_ENQUIRY_SENT
                        ? $"Enquiry {enquiry.EnquiryNumber} has no response from the location yet."
                        : $"Enquiry {enquiry.EnquiryNumber} is already {enquiry.Status}.");
            }

            if (!request.Request.Accept && string.IsNullOrWhiteSpace(request.Request.Comment))
            {
                _logger.LogError($"Rejection without a comment. EnquiryId: {enquiry.Id}");
                throw new BadRequestCustomException("Comment is required.", "Say why the justification is rejected.");
            }

            SilaInputRules.MaxLength(_logger, request.Request.Comment, SilaInputRules.COMMENT_LENGTH, "comment");

            enquiry.Status = request.Request.Accept ? Common.SILA_ENQUIRY_ACCEPTED : Common.SILA_ENQUIRY_REJECTED;
            enquiry.ReviewComment = string.IsNullOrWhiteSpace(request.Request.Comment) ? null : request.Request.Comment.Trim();
            enquiry.ReviewedBy = request.UserId;
            enquiry.ReviewedOn = DateTime.UtcNow;

            // The enquiry decision is the decision on the count line: a rejected shortage is not posted.
            StockCountItem? item = await _repository.StockCountItem.FindFirstByConditionAsync(x => x.Id == enquiry.StockCountItemId && x.IsActive);
            if (item != null)
            {
                item.ReviewStatus = request.Request.Accept ? SilaStockCountRules.LINE_REVIEW_ACCEPTED : SilaStockCountRules.LINE_REVIEW_REJECTED;
                item.ReviewComment = enquiry.ReviewComment;
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ENQUIRY, enquiry.Id, enquiry.Status, enquiry.ReviewComment);
            await _repository.SaveAsync();

            _logger.LogInfo($"Shortage enquiry reviewed. EnquiryId: {enquiry.Id}, Status: {enquiry.Status}");
            return Unit.Value;
        }
    }
}
