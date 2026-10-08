using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Posts SILA ME stock movements inside one command: updates the location balance, writes the immutable
    /// inventory transaction, raises the negative-stock alert, queues the ERP posting of the business document and
    /// records workflow events. Create one per command; the command saves once at the end.
    /// </summary>
    public class InventoryLedger
    {
        private readonly IRepositoryWrapper _repository;
        private readonly Guid _buyerId;
        private readonly Guid _userId;
        private readonly Dictionary<(Guid LocationId, Guid MaterialId), InventoryBalance> _balances = new();
        private readonly List<InventoryAlert> _newAlerts = new();

        public InventoryLedger(IRepositoryWrapper repository, Guid buyerId, Guid userId)
        {
            _repository = repository;
            _buyerId = buyerId;
            _userId = userId;
        }

        public async Task<InventoryTransaction> PostAsync(InventoryMovement movement, CancellationToken cancellationToken)
        {
            InventoryBalance balance = await GetBalanceAsync(movement.LocationId, movement.Material, cancellationToken);
            bool incoming = movement.Direction == Common.SILA_DIRECTION_IN;
            balance.OnHandQty += incoming ? movement.BaseQuantity : -movement.BaseQuantity;
            balance.LastMovementOn = DateTime.UtcNow;
            decimal? unitCost = movement.UnitCost ?? movement.Material.UnitCost ?? balance.UnitCost;
            if (unitCost != null)
            {
                balance.UnitCost = unitCost;
            }

            string transactionNumber = await DocumentNumber.NextAsync(_repository, _buyerId, DocumentNumber.INVENTORY_TRANSACTION, 6, cancellationToken);
            InventoryTransaction transaction = new InventoryTransaction
            {
                Id = Guid.NewGuid(),
                BuyerId = _buyerId,
                TransactionNumber = transactionNumber,
                TransactionType = movement.TransactionType,
                LocationId = movement.LocationId,
                MaterialId = movement.Material.Id,
                Direction = movement.Direction,
                Quantity = movement.BaseQuantity,
                BaseUom = balance.BaseUom,
                EnteredQuantity = movement.EnteredQuantity,
                EnteredUom = string.IsNullOrWhiteSpace(movement.EnteredUom) ? balance.BaseUom : movement.EnteredUom.Trim().ToUpperInvariant(),
                UnitCost = unitCost,
                Value = unitCost == null ? null : unitCost * movement.BaseQuantity,
                ReferenceType = movement.ReferenceType,
                ReferenceId = movement.ReferenceId,
                ReferenceNumber = movement.ReferenceNumber,
                Reason = movement.Reason,
                BusinessDate = movement.BusinessDate ?? DateTime.UtcNow.Date,
                IsActive = true
            };
            _repository.InventoryTransaction.Create(transaction);

            if (!incoming && balance.OnHandQty < 0)
            {
                await RaiseAlertAsync(new InventoryAlert
                {
                    AlertType = Common.SILA_ALERT_NEGATIVE_STOCK,
                    Severity = Common.SILA_SEVERITY_CRITICAL,
                    Title = $"Negative stock: {movement.Material.Description}",
                    Message = $"On hand is {balance.OnHandQty:0.####} {balance.BaseUom} after {movement.ReferenceNumber}. Assigned to the cost controller for review: request a physical inventory to correct it.",
                    LocationId = movement.LocationId,
                    MaterialId = movement.Material.Id,
                    ReferenceType = movement.ReferenceType,
                    ReferenceId = movement.ReferenceId,
                    RecommendedAction = Common.SILA_ACTION_REQUEST_PHYSICAL_INVENTORY
                }, cancellationToken);
            }

            return transaction;
        }

        /// <summary>Adds (or with a negative quantity removes) stock on its way to the location.</summary>
        public async Task AddInTransitAsync(Guid locationId, ItemBuyerMaster material, decimal baseQuantity, CancellationToken cancellationToken)
        {
            InventoryBalance balance = await GetBalanceAsync(locationId, material, cancellationToken);
            balance.InTransitQty = Math.Max(0, balance.InTransitQty + baseQuantity);
        }

        /// <summary>Queues the document for the InventoryErpPostingJob, which posts it to the ERP.</summary>
        public InventoryErpPosting QueueErpPosting(string referenceType, Guid referenceId, string referenceNumber, Guid? locationId, string movementType)
        {
            InventoryErpPosting posting = new InventoryErpPosting
            {
                Id = Guid.NewGuid(),
                BuyerId = _buyerId,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                ReferenceNumber = referenceNumber,
                LocationId = locationId,
                MovementType = movementType,
                Status = Common.SILA_POSTING_PENDING,
                Attempts = 0,
                IsActive = true
            };
            _repository.InventoryErpPosting.Create(posting);
            return posting;
        }

        public void AddEvent(string referenceType, Guid referenceId, string action, string? comment)
        {
            _repository.InventoryWorkflowEvent.Create(new InventoryWorkflowEvent
            {
                Id = Guid.NewGuid(),
                BuyerId = _buyerId,
                ReferenceType = referenceType,
                ReferenceId = referenceId,
                Action = action,
                Comment = comment,
                ActorUserId = _userId,
                IsActive = true
            });
        }

        /// <summary>Raises the alert unless an open alert of the same kind exists for the same location and material.</summary>
        public async Task RaiseAlertAsync(InventoryAlert alert, CancellationToken cancellationToken)
        {
            bool open = _newAlerts.Any(x => x.AlertType == alert.AlertType && x.LocationId == alert.LocationId && x.MaterialId == alert.MaterialId)
                || await _repository.InventoryAlert.FindByCondition(x => x.BuyerId == _buyerId
                        && x.IsActive
                        && x.AlertType == alert.AlertType
                        && x.LocationId == alert.LocationId
                        && x.MaterialId == alert.MaterialId
                        && (x.Status == Common.SILA_ALERT_NEW || x.Status == Common.SILA_ALERT_ACKNOWLEDGED))
                    .AnyAsync(cancellationToken);
            if (open)
            {
                return;
            }

            alert.Id = Guid.NewGuid();
            alert.BuyerId = _buyerId;
            alert.Status = Common.SILA_ALERT_NEW;
            alert.IsActive = true;
            _newAlerts.Add(alert);
            _repository.InventoryAlert.Create(alert);
        }

        private async Task<InventoryBalance> GetBalanceAsync(Guid locationId, ItemBuyerMaster material, CancellationToken cancellationToken)
        {
            if (_balances.TryGetValue((locationId, material.Id), out InventoryBalance? cached))
            {
                return cached;
            }

            InventoryBalance? balance = await _repository.InventoryBalance.FindFirstByConditionAsync(
                x => x.LocationId == locationId && x.MaterialId == material.Id);
            if (balance == null)
            {
                balance = new InventoryBalance
                {
                    Id = Guid.NewGuid(),
                    BuyerId = _buyerId,
                    LocationId = locationId,
                    MaterialId = material.Id,
                    BaseUom = UomConverter.BaseUomOf(material),
                    UnitCost = material.UnitCost,
                    IsActive = true
                };
                _repository.InventoryBalance.Create(balance);
            }

            _balances[(locationId, material.Id)] = balance;
            return balance;
        }
    }
}
