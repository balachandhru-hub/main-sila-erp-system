using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaReplenishmentTransfers
{
    /// <summary>
    /// Raises the replenishment transfers of the selected dashboard rows: one STANDARD transfer (reason "Replenishment")
    /// per source and destination pair, with the same checks as a requested transfer. All transfers are saved together,
    /// or none when one pair is refused.
    /// </summary>
    public class CreateSilaReplenishmentTransfersCommandHandler : IRequestHandler<CreateSilaReplenishmentTransfersCommand, SilaReplenishmentResultDto>
    {
        private const string REASON = "Replenishment";
        private const int MAX_LINES = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaReplenishmentTransfersCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaReplenishmentResultDto> Handle(CreateSilaReplenishmentTransfersCommand request, CancellationToken cancellationToken)
        {
            return SilaRetry.RunAsync(_repository, _logger, nameof(CreateSilaReplenishmentTransfersCommand), () => HandleOnceAsync(request, cancellationToken));
        }

        private async Task<SilaReplenishmentResultDto> HandleOnceAsync(CreateSilaReplenishmentTransfersCommand request, CancellationToken cancellationToken)
        {
            List<SilaReplenishmentLineWriteDto> lines = request.Request.Lines ?? new List<SilaReplenishmentLineWriteDto>();
            _logger.LogInfo($"Creating replenishment transfers. OrganizationId: {request.OrganizationId}, Lines: {lines.Count}");

            if (lines.Count == 0 || lines.Count > MAX_LINES)
            {
                _logger.LogError($"Replenishment line count out of range. Lines: {lines.Count}");
                throw new BadRequestCustomException("Select replenishment rows.", $"Select from 1 to {MAX_LINES} rows to transfer.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> locationIds = await SilaAccess.GetLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            SilaReplenishmentResultDto result = new SilaReplenishmentResultDto();

            foreach (IGrouping<(Guid Source, Guid Destination), SilaReplenishmentLineWriteDto> pair in lines.GroupBy(x => (x.SourceLocationId, x.DestinationLocationId)))
            {
                (InventoryLocation from, InventoryLocation to) = await SilaTransferRules.ValidateLocationsAsync(
                    _repository, _logger, buyer.Id, pair.Key.Source, pair.Key.Destination);
                if (!locationIds.Contains(from.Id) && !locationIds.Contains(to.Id))
                {
                    _logger.LogError($"User has no access to either replenishment location. UserId: {request.UserId}, From: {from.Id}, To: {to.Id}");
                    throw new ForBiddenCustomException("No access to these locations.", "Replenish only locations you are assigned to.");
                }

                string itoNumber = await DocumentNumber.NextAsync(_repository, buyer.Id, DocumentNumber.TRANSFER, 6, cancellationToken);
                InternalTransferOrder transfer = new InternalTransferOrder
                {
                    Id = Guid.NewGuid(),
                    BuyerId = buyer.Id,
                    ItoNumber = itoNumber,
                    Mode = Common.SILA_ITO_STANDARD,
                    FromLocationId = from.Id,
                    ToLocationId = to.Id,
                    Status = Common.SILA_ITO_PENDING_APPROVAL,
                    Reason = REASON,
                    RequestedBy = request.UserId,
                    IsActive = true
                };
                List<SilaTransferLineWriteDto> transferLines = pair
                    .Select(x => new SilaTransferLineWriteDto { MaterialId = x.MaterialId, Quantity = x.Quantity })
                    .ToList();
                (List<InternalTransferOrderItem> items, Dictionary<Guid, ItemBuyerMaster> _) = await SilaTransferRules.BuildItemsAsync(
                    _repository, _logger, buyer.Id, transfer.Id, transferLines, cancellationToken);

                _repository.InternalTransferOrder.Create(transfer);
                foreach (InternalTransferOrderItem item in items)
                {
                    _repository.InternalTransferOrderItem.Create(item);
                }

                ledger.AddEvent(Common.SILA_REF_ITO, transfer.Id, Common.AUDIT_CREATED, REASON);
                result.Transfers.Add(new SilaTransferListItemDto
                {
                    Id = transfer.Id,
                    ItoNumber = transfer.ItoNumber,
                    Mode = transfer.Mode,
                    Status = transfer.Status,
                    FromLocationId = from.Id,
                    FromLocationName = from.LocationName,
                    ToLocationId = to.Id,
                    ToLocationName = to.LocationName,
                    RequestedBy = request.UserId,
                    RequestedOn = DateTime.UtcNow,
                    LineCount = items.Count
                });
            }

            await _repository.SaveAsync();

            _logger.LogInfo($"Replenishment transfers created. Transfers: {result.Transfers.Count}, Lines: {lines.Count}");
            return result;
        }
    }
}
