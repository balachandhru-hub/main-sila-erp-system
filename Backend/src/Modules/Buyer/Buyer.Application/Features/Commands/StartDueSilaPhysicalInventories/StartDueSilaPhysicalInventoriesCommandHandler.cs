using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.StartDueSilaPhysicalInventories
{
    /// <summary>
    /// Run by the PhysicalInventoryJob: each due request opens its count and is saved on its own, so one failing
    /// location does not stop the others. A location with a count already in progress is tried again on the next run.
    /// </summary>
    public class StartDueSilaPhysicalInventoriesCommandHandler : IRequestHandler<StartDueSilaPhysicalInventoriesCommand, int>
    {
        private const int BATCH_SIZE = 500;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public StartDueSilaPhysicalInventoriesCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<int> Handle(StartDueSilaPhysicalInventoriesCommand request, CancellationToken cancellationToken)
        {
            return HandleOnceAsync(request, cancellationToken);
        }

        private async Task<int> HandleOnceAsync(StartDueSilaPhysicalInventoriesCommand request, CancellationToken cancellationToken)
        {
            DateTime today = DateTime.UtcNow.Date;
            _logger.LogInfo($"Starting due physical inventories. Today: {today:yyyy-MM-dd}, BuyerId: {request.BuyerId}");

            List<PhysicalInventoryRequest> due = await _repository.PhysicalInventoryRequest
                .FindByCondition(x => x.IsActive && x.Status == Common.SILA_PI_SCHEDULED && x.ScheduledDate <= today
                    && (request.BuyerId == null || x.BuyerId == request.BuyerId))
                .OrderBy(x => x.ScheduledDate)
                .Take(BATCH_SIZE)
                .ToListAsync(cancellationToken);

            int started = 0;
            foreach (PhysicalInventoryRequest physicalInventory in due)
            {
                try
                {
                    InventoryLedger ledger = new InventoryLedger(_repository, physicalInventory.BuyerId, physicalInventory.RequestedBy);
                    bool opened = await SilaPhysicalInventoryRules.StartCountAsync(_repository, _logger, ledger, physicalInventory, cancellationToken);
                    if (!opened)
                    {
                        continue;
                    }

                    _repository.PhysicalInventoryRequest.Update(physicalInventory);
                    await _repository.SaveAsync();
                    started++;
                }
                catch (Exception exception) when (exception is not OperationCanceledException)
                {
                    // Nothing of this request was saved; the next run tries again. Drop its unsaved rows so the next
                    // request does not try to save them again.
                    SilaRetry.DiscardChanges(_repository);
                    _logger.LogError($"Physical inventory could not start. RequestId: {physicalInventory.Id}, Error: {SilaLogText.Short(exception.Message)}");
                }
            }

            _logger.LogInfo($"Due physical inventories processed. Due: {due.Count}, Started: {started}");
            return started;
        }
    }
}
