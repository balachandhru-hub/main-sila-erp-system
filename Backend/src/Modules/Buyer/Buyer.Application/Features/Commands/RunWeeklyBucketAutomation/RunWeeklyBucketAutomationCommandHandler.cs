using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.RunWeeklyBucketAutomation
{
    public class RunWeeklyBucketAutomationCommandHandler : IRequestHandler<RunWeeklyBucketAutomationCommand, int>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly ISupplierSalesOrderClient _supplierSalesOrderClient;
        private readonly IUserContext _userContext;
        private readonly IConfiguration _configuration;
        private readonly ILoggerManager _logger;

        public RunWeeklyBucketAutomationCommandHandler(
            IRepositoryWrapper repository,
            IMediator mediator,
            ISupplierSalesOrderClient supplierSalesOrderClient,
            IUserContext userContext,
            IConfiguration configuration,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _supplierSalesOrderClient = supplierSalesOrderClient;
            _userContext = userContext;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task<int> Handle(RunWeeklyBucketAutomationCommand request, CancellationToken cancellationToken)
        {
            // Only an approved bucket gets its purchase orders; nothing is created before approval.
            List<WeeklyBucket> buckets = await _repository.WeeklyBucket
                .FindByCondition(x => x.BuyerId == request.BuyerId && x.IsActive && x.Status == Common.WEEKLY_BUCKET_APPROVED)
                .ToListAsync(cancellationToken);
            DateTime now = DateTime.UtcNow;

            int runs = 0;
            foreach (WeeklyBucket bucket in buckets)
            {
                cancellationToken.ThrowIfCancellationRequested();
                if (now >= WeeklyBucketRules.WeekendStart(bucket.Year, bucket.WeekNumber, _configuration))
                {
                    await CreatePurchaseOrdersAsync(bucket, cancellationToken);
                    runs++;
                }
            }

            return runs;
        }

        // A failure leaves the bucket PO_FAILED (retry endpoint) and does not stop the others.
        private async Task CreatePurchaseOrdersAsync(WeeklyBucket bucket, CancellationToken cancellationToken)
        {
            Guid actor = bucket.FrozenBy ?? Guid.Empty;
            _logger.LogInfo($"Weekend reached: creating purchase orders. WeeklyBucketId: {bucket.Id}, BucketCode: {bucket.BucketCode}");
            WeeklyBucketRules.AddAudit(_repository, bucket.Id, actor == Guid.Empty ? null : actor, Common.AUDIT_AUTO_CREATE, "Weekend reached.");
            await _repository.SaveAsync();

            WeeklyBucketIntegrationProcessor processor = new WeeklyBucketIntegrationProcessor(
                _repository,
                _mediator,
                new BuyerPurchaseDocumentGateway(_mediator, _logger),
                _supplierSalesOrderClient,
                _userContext,
                _logger);
            await processor.SendPurchaseOrdersAsync(bucket.Id, actor, cancellationToken);
        }
    }
}
