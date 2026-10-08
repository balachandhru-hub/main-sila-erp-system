using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaTransfer
{
    /// <summary>
    /// Requests a standard internal transfer between two locations of the same property. It waits for the approval
    /// of the source location.
    /// </summary>
    public class CreateSilaTransferCommandHandler : IRequestHandler<CreateSilaTransferCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaTransferCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<Guid> Handle(CreateSilaTransferCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaTransferCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<Guid> HandleOnceAsync(CreateSilaTransferCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating transfer. OrganizationId: {request.OrganizationId}, From: {request.Request.FromLocationId}, To: {request.Request.ToLocationId}");

            SilaTransferRules.ValidateHeader(_logger, request.Request);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            (InventoryLocation from, InventoryLocation to) = await SilaTransferRules.ValidateLocationsAsync(
                _repository, _logger, buyer.Id, request.Request.FromLocationId, request.Request.ToLocationId);

            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            if (!locationIds.Contains(from.Id) && !locationIds.Contains(to.Id))
            {
                _logger.LogError($"User has no access to either transfer location. UserId: {request.UserId}, From: {from.Id}, To: {to.Id}");
                throw new ForBiddenCustomException("No access to these locations.", "Request transfers for a location you are assigned to.");
            }

            InternalTransferOrder transfer = new InternalTransferOrder
            {
                Id = Guid.NewGuid(),
                BuyerId = buyer.Id,
                ItoNumber = await SilaTransferRules.NextNumberAsync(_repository, buyer.Id, cancellationToken),
                Mode = Common.SILA_ITO_STANDARD,
                FromLocationId = from.Id,
                ToLocationId = to.Id,
                Status = Common.SILA_ITO_PENDING_APPROVAL,
                Reason = request.Request.Reason?.Trim(),
                RequiredBy = request.Request.RequiredBy,
                RequestedBy = request.UserId,
                IsActive = true
            };
            (List<InternalTransferOrderItem> items, Dictionary<Guid, ItemBuyerMaster> _) = await SilaTransferRules.BuildItemsAsync(
                _repository, _logger, buyer.Id, transfer.Id, request.Request.Items, cancellationToken);

            _repository.InternalTransferOrder.Create(transfer);
            foreach (InternalTransferOrderItem item in items)
            {
                _repository.InternalTransferOrderItem.Create(item);
            }

            if (request.Request.AddToLocation)
            {
                if (!locationIds.Contains(to.Id))
                {
                    _logger.LogError($"Add-to-location without access to the destination. UserId: {request.UserId}, To: {to.Id}");
                    throw new ForBiddenCustomException("No access to the destination.", "Only a user of the destination can add materials to it.");
                }

                int added = await SilaLocationStocking.EnsureStockedAsync(_repository, to.Id, items.Select(x => x.MaterialId), cancellationToken);
                _logger.LogInfo($"Materials added to the destination. LocationId: {to.Id}, Added: {added}");
            }

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.AUDIT_CREATED, transfer.Reason);
            await _repository.SaveAsync();

            _logger.LogInfo($"Transfer created. TransferId: {transfer.Id}, ItoNumber: {transfer.ItoNumber}, Lines: {items.Count}");
            return transfer.Id;
        }
    }
}
