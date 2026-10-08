using Buyer.Application.Features.Commands.AddWeeklyBucketItems;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.AddSilaPurchaseRequestToBucket
{
    /// <summary>
    /// A manager adds a submitted purchase request to the current weekly bucket of the location's outlet, through the
    /// weekly bucket's own add-item use case. The material must be mapped to a catalog product (CatalogMaterialMapping).
    /// The request then becomes ADDED_TO_BUCKET with the bucket id.
    /// </summary>
    public class AddSilaPurchaseRequestToBucketCommandHandler : IRequestHandler<AddSilaPurchaseRequestToBucketCommand, SilaPurchaseRequestBucketResultDto>
    {
        private const decimal MAX_QUANTITY = 1000000m;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IMediator _mediator;

        public AddSilaPurchaseRequestToBucketCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IMediator mediator)
        {
            _repository = repository;
            _logger = logger;
            _mediator = mediator;
        }

        public Task<SilaPurchaseRequestBucketResultDto> Handle(AddSilaPurchaseRequestToBucketCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(AddSilaPurchaseRequestToBucketCommand), () => SilaTransaction.RunAsync(() => HandleOnceAsync(request, cancellationToken)));
        }

        private async Task<SilaPurchaseRequestBucketResultDto> HandleOnceAsync(AddSilaPurchaseRequestToBucketCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Adding purchase request to the weekly bucket. RequestId: {request.PurchaseRequestId}, UserId: {request.UserId}");

            if (request.Request.Quantity != null && (request.Request.Quantity <= 0 || request.Request.Quantity > MAX_QUANTITY))
            {
                _logger.LogError($"Bucket quantity out of range. Quantity: {request.Request.Quantity}");
                throw new BadRequestCustomException("Invalid quantity.", $"Enter a quantity greater than zero and at most {MAX_QUANTITY:0}.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InternalPurchaseRequest purchaseRequest = await SilaPurchaseRequestRules.GetAsync(
                _repository, _logger, buyer.Id, request.UserId, request.RoleId, request.PurchaseRequestId, cancellationToken);
            SilaPurchaseRequestRules.EnsureSubmitted(_logger, purchaseRequest, "added to the weekly bucket");

            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, purchaseRequest.LocationId);
            if (location.OutletId == null)
            {
                _logger.LogError($"Purchase request location has no outlet. LocationId: {location.Id}");
                throw new BadRequestCustomException(
                    "The location is not an outlet.",
                    "Weekly buckets are requested per outlet; raise the purchase request for an outlet location.");
            }

            List<CatalogMaterialMapping> mappings = await _repository.CatalogMaterialMapping
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.MaterialId == purchaseRequest.MaterialId)
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            CatalogMaterialMapping? mapping = request.Request.CatalogId == null
                ? mappings.FirstOrDefault()
                : mappings.FirstOrDefault(x => x.CatalogId == request.Request.CatalogId);
            if (mapping == null)
            {
                _logger.LogError($"Material is not mapped to a catalog product. MaterialId: {purchaseRequest.MaterialId}");
                throw new BadRequestCustomException(
                    "Map this material to a catalog product first",
                    "Map the material to a supplier catalog product in the catalog mapping, then add the request again.");
            }

            WeeklyBucketAddItemsResultDto added = await _mediator.Send(new AddWeeklyBucketItemsCommand
            {
                OrganizationId = request.OrganizationId,
                UserId = request.UserId,
                Request = new WeeklyBucketItemsWriteDto
                {
                    OutletId = location.OutletId,
                    Items = new List<CatalogItemWriteDto>
                    {
                        new CatalogItemWriteDto { CatalogId = mapping.CatalogId, Quantity = request.Request.Quantity ?? purchaseRequest.Quantity }
                    }
                }
            }, cancellationToken);

            purchaseRequest.Status = Common.SILA_PR_ADDED_TO_BUCKET;
            purchaseRequest.WeeklyBucketId = added.BucketId;
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_PURCHASE_REQUEST, purchaseRequest.Id, Common.SILA_PR_ADDED_TO_BUCKET, added.BucketCode);
            await _repository.SaveAsync();

            _logger.LogInfo($"Purchase request added to the weekly bucket. RequestId: {purchaseRequest.Id}, BucketCode: {added.BucketCode}");
            return new SilaPurchaseRequestBucketResultDto
            {
                PurchaseRequestId = purchaseRequest.Id,
                WeeklyBucketId = added.BucketId,
                BucketCode = added.BucketCode
            };
        }
    }
}
