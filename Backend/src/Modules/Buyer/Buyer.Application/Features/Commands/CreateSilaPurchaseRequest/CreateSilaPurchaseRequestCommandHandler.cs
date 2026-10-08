using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaPurchaseRequest
{
    /// <summary>
    /// Raises an internal purchase request (PR000001) for a material at a store or outlet the user works with, when no
    /// internal stock covers the need. The quantity is stored in the base unit. One open request per location and material.
    /// </summary>
    public class CreateSilaPurchaseRequestCommandHandler : IRequestHandler<CreateSilaPurchaseRequestCommand, SilaPurchaseRequestDto>
    {
        private const int MAX_REASON = 500;
        private const decimal MAX_QUANTITY = 1000000m;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public CreateSilaPurchaseRequestCommandHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public Task<SilaPurchaseRequestDto> Handle(CreateSilaPurchaseRequestCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaPurchaseRequestCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaPurchaseRequestDto> HandleOnceAsync(CreateSilaPurchaseRequestCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating purchase request. OrganizationId: {request.OrganizationId}, LocationId: {request.Request.LocationId}, MaterialId: {request.Request.MaterialId}");

            SilaPurchaseRequestWriteDto input = request.Request;
            string source = string.IsNullOrWhiteSpace(input.Source) ? SilaPurchaseRequestRules.SOURCE_MANUAL : input.Source.Trim().ToUpperInvariant();
            string? reason = string.IsNullOrWhiteSpace(input.Reason) ? null : input.Reason.Trim();
            if (input.Quantity <= 0 || input.Quantity > MAX_QUANTITY)
            {
                _logger.LogError($"Purchase request quantity out of range. Quantity: {input.Quantity}");
                throw new BadRequestCustomException("Invalid quantity.", $"Enter a quantity greater than zero and at most {MAX_QUANTITY:0}.");
            }

            if (!SilaPurchaseRequestRules.Sources.Contains(source))
            {
                _logger.LogError($"Invalid purchase request source. Source: {source}");
                throw new BadRequestCustomException("Invalid source.", "Use LIVE_INVENTORY, REPLENISHMENT, ALERT or MANUAL as the source.");
            }

            if (reason != null && reason.Length > MAX_REASON)
            {
                _logger.LogError($"Purchase request reason too long. Length: {reason.Length}");
                throw new BadRequestCustomException("The reason is too long.", $"Enter at most {MAX_REASON} characters.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryLocation location = await SilaAccess.GetLocationAsync(_repository, _logger, buyer.Id, input.LocationId);
            await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, location.Id, cancellationToken);
            if (location.LocationType == Common.SILA_LOCATION_VENUE)
            {
                _logger.LogError($"Purchase request for a venue. LocationId: {location.Id}");
                throw new BadRequestCustomException("A venue holds no stock.", "Raise the purchase request for a store or outlet of the venue.");
            }

            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                _repository, _logger, buyer.Id, new List<Guid> { input.MaterialId }, cancellationToken);
            ItemBuyerMaster material = materials[input.MaterialId];
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                _repository, materials.Keys, cancellationToken);
            decimal baseQuantity = UomConverter.ToBase(_logger, material, input.Quantity, input.Uom, conversions);

            InternalPurchaseRequest? open = await _repository.InternalPurchaseRequest
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.LocationId == location.Id
                    && x.MaterialId == material.Id && x.Status == Common.SILA_PR_SUBMITTED)
                .FirstOrDefaultAsync(cancellationToken);
            if (open != null)
            {
                _logger.LogError($"Open purchase request exists. RequestNumber: {open.RequestNumber}");
                throw new ConflictCustomException(
                    $"{open.RequestNumber} is already open for this material.",
                    "Add the open purchase request to the weekly bucket, or cancel it before raising a new one.");
            }

            InternalPurchaseRequest purchaseRequest = new InternalPurchaseRequest
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                RequestNumber = await SilaPurchaseRequestRules.NextNumberAsync(_repository, buyer.Id, cancellationToken),
                LocationId = location.Id,
                MaterialId = material.Id,
                Quantity = baseQuantity,
                Uom = UomConverter.BaseUomOf(material),
                Reason = reason,
                Status = Common.SILA_PR_SUBMITTED,
                RequestedBy = request.UserId,
                Source = source,
                IsActive = true
            };
            _repository.InternalPurchaseRequest.Create(purchaseRequest);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_PURCHASE_REQUEST, purchaseRequest.Id, Common.AUDIT_CREATED, reason);
            await _repository.SaveAsync();

            List<SilaPurchaseRequestDto> result = await SilaPurchaseRequestRules.ToDtosAsync(
                _repository, _identityApiClient, _logger, buyer.Id, new List<InternalPurchaseRequest> { purchaseRequest }, cancellationToken);
            _logger.LogInfo($"Purchase request created. RequestId: {purchaseRequest.Id}, RequestNumber: {purchaseRequest.RequestNumber}");
            return result[0];
        }
    }
}
