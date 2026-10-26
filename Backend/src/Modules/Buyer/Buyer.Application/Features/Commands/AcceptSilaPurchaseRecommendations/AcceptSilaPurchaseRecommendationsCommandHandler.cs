using Buyer.Application.Features.Commands.AddSilaPurchaseRequestToBucket;
using Buyer.Application.Features.Commands.CreateSilaPurchaseRequest;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.AcceptSilaPurchaseRecommendations
{
    /// <summary>
    /// Buyer-reviewed recommendations become inputs to the existing purchase-request → weekly-bucket PO path.
    /// Does not create a purchase order and does not auto-order.
    /// </summary>
    public class AcceptSilaPurchaseRecommendationsCommandHandler : IRequestHandler<AcceptSilaPurchaseRecommendationsCommand, SilaPurchaseRecommendationAcceptResultDto>
    {
        private const int MAX_LINES = 80;

        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public AcceptSilaPurchaseRecommendationsCommandHandler(IMediator mediator, ILoggerManager logger)
        {
            _mediator = mediator;
            _logger = logger;
        }

        public async Task<SilaPurchaseRecommendationAcceptResultDto> Handle(AcceptSilaPurchaseRecommendationsCommand request, CancellationToken cancellationToken)
        {
            List<SilaPurchaseRecommendationAcceptLineDto> lines = (request.Request.Lines ?? new List<SilaPurchaseRecommendationAcceptLineDto>())
                .Where(x => x.Quantity > 0)
                .ToList();
            if (lines.Count == 0)
            {
                throw new BadRequestCustomException("Select at least one recommendation.", "Choose the lines to add and set a quantity greater than zero.");
            }

            if (lines.Count > MAX_LINES)
            {
                throw new BadRequestCustomException("Too many recommendations.", $"Add at most {MAX_LINES} lines at a time.");
            }

            SilaPurchaseRecommendationAcceptResultDto result = new SilaPurchaseRecommendationAcceptResultDto();
            foreach (SilaPurchaseRecommendationAcceptLineDto line in lines)
            {
                SilaPurchaseRecommendationAcceptLineResultDto row = new SilaPurchaseRecommendationAcceptLineResultDto
                {
                    MaterialId = line.MaterialId,
                    LocationId = line.LocationId
                };
                try
                {
                    SilaPurchaseRequestDto created = await _mediator.Send(new CreateSilaPurchaseRequestCommand
                    {
                        OrganizationId = request.OrganizationId,
                        UserId = request.UserId,
                        RoleId = request.RoleId,
                        Request = new SilaPurchaseRequestWriteDto
                        {
                            LocationId = line.LocationId,
                            MaterialId = line.MaterialId,
                            Quantity = line.Quantity,
                            Uom = line.Uom,
                            Source = SilaPurchaseRequestRules.SOURCE_REPLENISHMENT,
                            Reason = "Recommendation"
                        }
                    }, cancellationToken);
                    row.PurchaseRequestId = created.Id;
                    row.RequestNumber = created.RequestNumber;
                    result.PurchaseRequests.Add(created);
                    if (request.Request.AddToBucket)
                    {
                        SilaPurchaseRequestBucketResultDto bucket = await _mediator.Send(new AddSilaPurchaseRequestToBucketCommand
                        {
                            OrganizationId = request.OrganizationId,
                            UserId = request.UserId,
                            RoleId = request.RoleId,
                            PurchaseRequestId = created.Id,
                            Request = new SilaPurchaseRequestBucketWriteDto { Quantity = line.Quantity }
                        }, cancellationToken);
                        row.WeeklyBucketId = bucket.WeeklyBucketId;
                        row.BucketCode = bucket.BucketCode;
                    }
                }
                catch (Exception exception) when (exception is BadRequestCustomException or ConflictCustomException or NotFoundCustomException)
                {
                    _logger.LogError($"Recommendation line was not added. MaterialId: {line.MaterialId}, LocationId: {line.LocationId}, Error: {exception.Message}");
                    row.Error = exception.Message;
                }

                result.Lines.Add(row);
            }

            if (result.PurchaseRequests.Count == 0)
            {
                string detail = string.Join(" ", result.Lines.Select(x => x.Error).Where(x => !string.IsNullOrWhiteSpace(x)).Take(3));
                throw new BadRequestCustomException(
                    "None of the selected recommendations could be added.",
                    string.IsNullOrWhiteSpace(detail) ? "Review catalog mapping, quantity and any open purchase request." : detail);
            }

            _logger.LogInfo($"Recommendations accepted into purchase requests. Created: {result.PurchaseRequests.Count}");
            return result;
        }
    }
}
