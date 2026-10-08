using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.QuickCreateWeeklyBucketPurchaseOrders
{
    public class QuickCreateWeeklyBucketPurchaseOrdersCommandHandler : IRequestHandler<QuickCreateWeeklyBucketPurchaseOrdersCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly ISupplierSalesOrderClient _supplierSalesOrderClient;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public QuickCreateWeeklyBucketPurchaseOrdersCommandHandler(
            IRepositoryWrapper repository,
            IMediator mediator,
            ISupplierSalesOrderClient supplierSalesOrderClient,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _supplierSalesOrderClient = supplierSalesOrderClient;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task<Unit> Handle(QuickCreateWeeklyBucketPurchaseOrdersCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Quick create of weekly bucket purchase orders. WeeklyBucketId: {request.WeeklyBucketId}, UserId: {request.UserId}");

            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                x => x.OrganizationId == request.OrganizationId && x.IsActive);
            if (buyer == null)
            {
                _logger.LogError($"Buyer not found. OrganizationId: {request.OrganizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            WeeklyBucket? bucket = await _repository.WeeklyBucket.GetTrackedAsync(request.WeeklyBucketId, buyer.Id, cancellationToken);
            if (bucket == null)
            {
                _logger.LogError($"Weekly bucket not found. WeeklyBucketId: {request.WeeklyBucketId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Weekly bucket not found.", "No weekly bucket exists for this buyer organization.");
            }

            // Purchase orders are created after approval only.
            if (bucket.Status != Common.WEEKLY_BUCKET_APPROVED)
            {
                _logger.LogError($"Weekly bucket is not approved. WeeklyBucketId: {bucket.Id}, Status: {bucket.Status}");
                throw new BadRequestCustomException(
                    "Purchase orders cannot be created yet.",
                    "Quick Create is available only for a weekly bucket that is fully approved and has no purchase orders yet.");
            }

            WeeklyBucketRules.AddAudit(_repository, bucket.Id, request.UserId, Common.AUDIT_QUICK_CREATE, "Store manager used Quick Create.");
            await _repository.SaveAsync();

            WeeklyBucketIntegrationProcessor processor = new WeeklyBucketIntegrationProcessor(
                _repository,
                _mediator,
                new BuyerPurchaseDocumentGateway(_mediator, _logger),
                _supplierSalesOrderClient,
                _userContext,
                _logger);
            await processor.SendPurchaseOrdersAsync(bucket.Id, request.UserId, cancellationToken);
            if (bucket.Status == Common.WEEKLY_BUCKET_PO_FAILED)
            {
                _logger.LogError($"Quick create failed. WeeklyBucketId: {bucket.Id}, Error: {bucket.LastError}");
                throw new PreConditionFailedCustomException(
                    "Not every purchase order was created.",
                    bucket.LastError ?? "The configured purchase order API did not accept the document.");
            }

            _logger.LogInfo($"Quick create finished. WeeklyBucketId: {bucket.Id}, Status: {bucket.Status}");
            return Unit.Value;
        }
    }
}
