using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.ReviewSilaStockCountItem
{
    /// <summary>
    /// Cost controller review of one line of a submitted count: ACCEPT the variance, send the line back for RECOUNT
    /// (the count reopens for that line only), ask the location for MORE_INFORMATION on the shortage enquiry, or REJECT
    /// the variance (it is not posted when the count is approved).
    /// </summary>
    public class ReviewSilaStockCountItemCommandHandler : IRequestHandler<ReviewSilaStockCountItemCommand, Unit>
    {
        private const int MAX_COMMENT_LENGTH = 1000;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public ReviewSilaStockCountItemCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(ReviewSilaStockCountItemCommand request, CancellationToken cancellationToken)
        {
            string decision = (request.Request.Decision ?? string.Empty).Trim().ToUpperInvariant();
            _logger.LogInfo($"Reviewing count line. StockCountId: {request.StockCountId}, ItemId: {request.ItemId}, Decision: {decision}, UserId: {request.UserId}");

            string? comment = string.IsNullOrWhiteSpace(request.Request.Comment) ? null : request.Request.Comment.Trim();
            ValidateDecision(decision, comment);

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            StockCount count = await SilaStockCountRules.GetCountAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.StockCountId, cancellationToken);
            if (count.Status != Common.SILA_COUNT_SUBMITTED && count.Status != Common.SILA_COUNT_ENQUIRY_PENDING)
            {
                _logger.LogError($"Count lines cannot be reviewed. StockCountId: {count.Id}, Status: {count.Status}");
                throw new BadRequestCustomException(
                    "Count cannot be reviewed.",
                    $"Count {count.CountNumber} is {count.Status}. Lines can be reviewed only after the count is submitted and before it is approved.");
            }

            StockCountItem? item = await _repository.StockCountItem.FindFirstByConditionAsync(
                x => x.Id == request.ItemId && x.StockCountId == count.Id && x.IsActive);
            if (item == null)
            {
                _logger.LogError($"Count line not found. ItemId: {request.ItemId}, StockCountId: {count.Id}");
                throw new NotFoundCustomException("Count line not found.", "Select a material of this stock count.");
            }

            StockShortageEnquiry? enquiry = await _repository.StockShortageEnquiry.FindFirstByConditionAsync(
                x => x.StockCountItemId == item.Id && x.BuyerId == buyer.Id && x.IsActive);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);

            if (decision == SilaStockCountRules.REVIEW_RECOUNT)
            {
                SilaStockCountRules.ResetForRecount(item, comment!);
                if (enquiry != null)
                {
                    // The recount replaces the shortage; a new enquiry is sent if the recount is still short.
                    enquiry.IsActive = false;
                    ledger.AddEvent(Common.SILA_REF_ENQUIRY, enquiry.Id, "WITHDRAWN", $"Recount requested: {comment}");
                }

                count.Status = Common.SILA_COUNT_IN_PROGRESS;
                ledger.AddEvent(Common.SILA_REF_STOCK_COUNT, count.Id, SilaStockCountRules.EVENT_REOPENED, $"Recount {item.MaterialCode}: {comment}");
            }
            else if (decision == SilaStockCountRules.REVIEW_MORE_INFORMATION)
            {
                if (enquiry == null)
                {
                    _logger.LogError($"More information asked on a line without an enquiry. ItemId: {item.Id}, Status: {item.Status}");
                    throw new BadRequestCustomException(
                        "No enquiry on this line.",
                        "More information can be asked only on a shortage line. Accept, reject or ask a recount of this line instead.");
                }

                enquiry.Status = Common.SILA_ENQUIRY_MORE_INFORMATION;
                enquiry.ReviewComment = comment;
                enquiry.ReviewedBy = request.UserId;
                enquiry.ReviewedOn = DateTime.UtcNow;
                item.ReviewStatus = Common.SILA_ENQUIRY_MORE_INFORMATION;
                item.ReviewComment = comment;
                count.Status = Common.SILA_COUNT_ENQUIRY_PENDING;
                ledger.AddEvent(Common.SILA_REF_ENQUIRY, enquiry.Id, Common.SILA_ENQUIRY_MORE_INFORMATION, comment);
            }
            else
            {
                if (item.Status == Common.SILA_COUNT_LINE_NOT_COUNTED)
                {
                    _logger.LogError($"Uncounted line cannot be reviewed. ItemId: {item.Id}");
                    throw new BadRequestCustomException("Line is not counted.", "Ask a recount of this line instead.");
                }

                bool accept = decision == SilaStockCountRules.REVIEW_ACCEPT;
                item.ReviewStatus = accept ? SilaStockCountRules.LINE_REVIEW_ACCEPTED : SilaStockCountRules.LINE_REVIEW_REJECTED;
                item.ReviewComment = comment;
                if (enquiry != null && enquiry.Status != Common.SILA_ENQUIRY_ACCEPTED && enquiry.Status != Common.SILA_ENQUIRY_REJECTED)
                {
                    enquiry.Status = accept ? Common.SILA_ENQUIRY_ACCEPTED : Common.SILA_ENQUIRY_REJECTED;
                    enquiry.ReviewComment = comment;
                    enquiry.ReviewedBy = request.UserId;
                    enquiry.ReviewedOn = DateTime.UtcNow;
                    ledger.AddEvent(Common.SILA_REF_ENQUIRY, enquiry.Id, enquiry.Status, comment);
                }
            }

            ledger.AddEvent(Common.SILA_REF_STOCK_COUNT, count.Id, $"LINE_{decision}", $"{item.MaterialCode}{(comment == null ? string.Empty : $": {comment}")}");
            await _repository.SaveAsync();

            _logger.LogInfo($"Count line reviewed. StockCountId: {count.Id}, ItemId: {item.Id}, Decision: {decision}, CountStatus: {count.Status}");
            return Unit.Value;
        }

        private void ValidateDecision(string decision, string? comment)
        {
            string[] decisions =
            {
                SilaStockCountRules.REVIEW_ACCEPT,
                SilaStockCountRules.REVIEW_RECOUNT,
                SilaStockCountRules.REVIEW_MORE_INFORMATION,
                SilaStockCountRules.REVIEW_REJECT
            };
            if (!decisions.Contains(decision))
            {
                _logger.LogError($"Invalid review decision. Decision: {decision}");
                throw new BadRequestCustomException("Decision is not valid.", "Use ACCEPT, RECOUNT, MORE_INFORMATION or REJECT.");
            }

            if (decision != SilaStockCountRules.REVIEW_ACCEPT && comment == null)
            {
                _logger.LogError($"Review comment missing. Decision: {decision}");
                throw new BadRequestCustomException("Comment is required.", "Tell the location why the line is sent back or rejected.");
            }

            if (comment != null && comment.Length > MAX_COMMENT_LENGTH)
            {
                _logger.LogError($"Review comment too long. Length: {comment.Length}");
                throw new BadRequestCustomException("Comment is too long.", $"Keep the comment within {MAX_COMMENT_LENGTH} characters.");
            }
        }
    }
}
