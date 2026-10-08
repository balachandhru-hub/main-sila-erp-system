using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>Lookups shared by the SILA ME alert use cases.</summary>
    public static class SilaAlertRules
    {
        /// <summary>Reference type of the workflow events of an alert (audit log).</summary>
        public const string REF_ALERT = "ALERT";

        /// <summary>An alert of the buyer, tracked. An alert with a location needs access to that location.</summary>
        public static async Task<InventoryAlert> GetAlertAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid userId, Guid roleId, Guid alertId, CancellationToken cancellationToken)
        {
            InventoryAlert? alert = await repository.InventoryAlert.FindFirstByConditionAsync(x => x.Id == alertId && x.BuyerId == buyerId && x.IsActive);
            if (alert == null)
            {
                logger.LogError($"Inventory alert not found. AlertId: {alertId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Alert not found.", "Open an alert of this organization.");
            }

            if (alert.LocationId != null)
            {
                await SilaAccess.EnsureLocationAccessAsync(repository, logger, buyerId, userId, roleId, alert.LocationId.Value, cancellationToken);
            }

            return alert;
        }

        public static bool IsOpen(InventoryAlert alert)
        {
            return alert.Status == Common.SILA_ALERT_NEW || alert.Status == Common.SILA_ALERT_ACKNOWLEDGED;
        }
    }
}
