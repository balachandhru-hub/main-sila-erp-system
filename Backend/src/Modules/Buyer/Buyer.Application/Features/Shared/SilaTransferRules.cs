using Microsoft.EntityFrameworkCore;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// Rules shared by the internal transfer order (ITO) use cases: location checks, line building, the dispatch
    /// stock movement and the actions the signed-in user may take.
    /// </summary>
    public static class SilaTransferRules
    {
        public const string ACTION_APPROVE = "APPROVE";
        public const string ACTION_REJECT = "REJECT";
        public const string ACTION_DISPATCH = "DISPATCH";
        public const string ACTION_RECEIVE = "RECEIVE";
        public const string ACTION_CANCEL = "CANCEL";
        public const string ACTION_CONFIRM_HANDOVER = "CONFIRM_HANDOVER";
        public const string ACTION_DISPUTE = "DISPUTE";

        public const int MAX_LINES = 500;

        /// <summary>Header input of a new transfer: reason length and a sane required-by date.</summary>
        public static void ValidateHeader(ILoggerManager logger, SilaTransferWriteDto request)
        {
            SilaInputRules.MaxLength(logger, request.Reason, SilaInputRules.COMMENT_LENGTH, "reason");
            SilaInputRules.SaneDate(logger, request.RequiredBy, "required-by date", 1, 1);
        }

        /// <summary>A comment sent with a transfer action is at most 500 characters.</summary>
        public static void ValidateComment(ILoggerManager logger, string? comment)
        {
            SilaInputRules.MaxLength(logger, comment, SilaInputRules.COMMENT_LENGTH, "comment");
        }

        /// <summary>An ITO of the buyer, tracked. Not found is a 404.</summary>
        public static async Task<InternalTransferOrder> GetTransferAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid transferId)
        {
            InternalTransferOrder? transfer = await repository.InternalTransferOrder.FindFirstByConditionAsync(
                x => x.Id == transferId && x.BuyerId == buyerId && x.IsActive);
            if (transfer == null)
            {
                logger.LogError($"Transfer not found. TransferId: {transferId}, BuyerId: {buyerId}");
                throw new NotFoundCustomException("Transfer not found.", "Open a transfer order of this organization.");
            }

            return transfer;
        }

        /// <summary>The lines of the ITO, untracked: call Update on the lines you change.</summary>
        public static async Task<List<InternalTransferOrderItem>> GetItemsAsync(
            IRepositoryWrapper repository, Guid transferId, CancellationToken cancellationToken)
        {
            return await repository.InternalTransferOrderItem
                .FindByCondition(x => x.InternalTransferOrderId == transferId && x.IsActive)
                .OrderBy(x => x.MaterialCode)
                .ToListAsync(cancellationToken);
        }

        public static void EnsureStatus(ILoggerManager logger, InternalTransferOrder transfer, string action, params string[] statuses)
        {
            if (!statuses.Contains(transfer.Status))
            {
                logger.LogError($"Transfer is not in a status that allows {action}. TransferId: {transfer.Id}, Status: {transfer.Status}");
                throw new BadRequestCustomException(
                    $"The transfer cannot be {action} in status {transfer.Status}.",
                    "Refresh the transfer to see its current status.");
            }
        }

        /// <summary>Both locations exist, differ, belong to the same property and allow transfers.</summary>
        public static async Task<(InventoryLocation From, InventoryLocation To)> ValidateLocationsAsync(
            IRepositoryWrapper repository, ILoggerManager logger, Guid buyerId, Guid fromLocationId, Guid toLocationId)
        {
            if (fromLocationId == toLocationId)
            {
                logger.LogError($"Transfer source and destination are the same. LocationId: {fromLocationId}");
                throw new BadRequestCustomException("Source and destination must differ.", "Select a different destination location.");
            }

            InventoryLocation from = await SilaAccess.GetLocationAsync(repository, logger, buyerId, fromLocationId);
            InventoryLocation to = await SilaAccess.GetLocationAsync(repository, logger, buyerId, toLocationId);
            if (from.PropertyId != to.PropertyId)
            {
                logger.LogError($"Cross-property transfer. From: {from.Id} ({from.PropertyId}), To: {to.Id} ({to.PropertyId})");
                throw new BadRequestCustomException(
                    "Transfers across properties are not allowed",
                    "Select a source and a destination of the same property.");
            }

            if (!from.TransferEnabled || !to.TransferEnabled)
            {
                InventoryLocation disabled = from.TransferEnabled ? to : from;
                logger.LogError($"Transfers are disabled for the location. LocationId: {disabled.Id}");
                throw new BadRequestCustomException(
                    $"Transfers are not enabled for {disabled.LocationName}.",
                    "Enable transfers on the location or select another location.");
            }

            return (from, to);
        }

        /// <summary>The ITO lines with the requested quantity converted to the base unit, and the materials by id.</summary>
        public static async Task<(List<InternalTransferOrderItem> Items, Dictionary<Guid, ItemBuyerMaster> Materials)> BuildItemsAsync(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            Guid buyerId,
            Guid transferId,
            List<SilaTransferLineWriteDto> lines,
            CancellationToken cancellationToken)
        {
            if (lines == null || lines.Count == 0)
            {
                logger.LogError($"Transfer has no lines. TransferId: {transferId}");
                throw new BadRequestCustomException("Add at least one material.", "A transfer needs one or more lines.");
            }

            SilaInputRules.Lines(logger, lines, MAX_LINES, "transfer");
            if (lines.Any(x => x.Quantity <= 0))
            {
                logger.LogError($"Transfer line quantity is not positive. TransferId: {transferId}");
                throw new BadRequestCustomException("Quantities must be greater than zero.", "Enter a positive quantity on every line.");
            }

            foreach (SilaTransferLineWriteDto line in lines)
            {
                SilaInputRules.PositiveQuantity(logger, line.Quantity, "quantity");
                SilaInputRules.MaxLength(logger, line.Uom, SilaInputRules.CODE_LENGTH, "unit of measure");
            }

            if (lines.GroupBy(x => x.MaterialId).Any(x => x.Count() > 1))
            {
                logger.LogError($"Transfer has the same material twice. TransferId: {transferId}");
                throw new BadRequestCustomException("A material appears more than once.", "Combine the quantities of the same material in one line.");
            }

            Dictionary<Guid, ItemBuyerMaster> materials = await SilaAccess.GetMaterialsAsync(
                repository, logger, buyerId, lines.Select(x => x.MaterialId), cancellationToken);
            Dictionary<Guid, List<MaterialUomConversion>> conversions = await UomConverter.GetConversionsAsync(
                repository, materials.Keys, cancellationToken);

            List<InternalTransferOrderItem> items = new List<InternalTransferOrderItem>();
            foreach (SilaTransferLineWriteDto line in lines)
            {
                ItemBuyerMaster material = materials[line.MaterialId];
                decimal baseQuantity = UomConverter.ToBase(logger, material, line.Quantity, line.Uom, conversions);
                items.Add(new InternalTransferOrderItem
                {
                    Id = Guid.NewGuid(),
                    InternalTransferOrderId = transferId,
                    MaterialId = material.Id,
                    MaterialCode = material.MaterialCode ?? string.Empty,
                    MaterialName = material.Description ?? material.MaterialCode ?? string.Empty,
                    RequestedQty = baseQuantity,
                    Uom = UomConverter.BaseUomOf(material),
                    IsActive = true
                });
            }

            return (items, materials);
        }

        public static async Task<string> NextNumberAsync(IRepositoryWrapper repository, Guid buyerId, CancellationToken cancellationToken)
        {
            return await DocumentNumber.NextAsync(repository, buyerId, DocumentNumber.TRANSFER, 6, cancellationToken);
        }

        /// <summary>
        /// Sends the approved quantities: TRANSFER_OUT at the source and in transit at the destination.
        /// The caller marks the lines as updated when they are already stored.
        /// </summary>
        public static async Task DispatchAsync(
            InventoryLedger ledger,
            InternalTransferOrder transfer,
            List<InternalTransferOrderItem> items,
            Dictionary<Guid, ItemBuyerMaster> materials,
            CancellationToken cancellationToken)
        {
            foreach (InternalTransferOrderItem item in items)
            {
                item.DispatchedQty = item.ApprovedQty;
                if (item.DispatchedQty <= 0)
                {
                    continue;
                }

                ItemBuyerMaster material = materials[item.MaterialId];
                await ledger.PostAsync(new InventoryMovement
                {
                    LocationId = transfer.FromLocationId,
                    Material = material,
                    Direction = Common.SILA_DIRECTION_OUT,
                    TransactionType = Common.SILA_TXN_TRANSFER_OUT,
                    BaseQuantity = item.DispatchedQty,
                    EnteredQuantity = item.DispatchedQty,
                    EnteredUom = item.Uom,
                    ReferenceType = Common.SILA_REF_ITO,
                    ReferenceId = transfer.Id,
                    ReferenceNumber = transfer.ItoNumber,
                    Reason = transfer.Reason
                }, cancellationToken);
                await ledger.AddInTransitAsync(transfer.ToLocationId, material, item.DispatchedQty, cancellationToken);
            }
        }

        /// <summary>
        /// The per-line quantities sent by the client, keyed by line id. Lines of another transfer and negative
        /// quantities are a 400.
        /// </summary>
        public static Dictionary<Guid, decimal> ReadQuantities(
            ILoggerManager logger, InternalTransferOrder transfer, List<InternalTransferOrderItem> items, SilaTransferQuantitiesDto? request)
        {
            Dictionary<Guid, decimal> quantities = new Dictionary<Guid, decimal>();
            ValidateComment(logger, request?.Comment);
            if (request?.Items == null)
            {
                return quantities;
            }

            HashSet<Guid> lineIds = items.Select(x => x.Id).ToHashSet();
            foreach (SilaTransferLineQuantityDto line in request.Items)
            {
                if (!lineIds.Contains(line.ItemId))
                {
                    logger.LogError($"Transfer line not found. TransferId: {transfer.Id}, ItemId: {line.ItemId}");
                    throw new BadRequestCustomException("Transfer line not found.", "Refresh the transfer and enter the quantities again.");
                }

                if (line.Quantity < 0)
                {
                    logger.LogError($"Negative transfer line quantity. TransferId: {transfer.Id}, ItemId: {line.ItemId}");
                    throw new BadRequestCustomException("Quantities cannot be negative.", "Enter zero or a positive quantity.");
                }

                SilaInputRules.NonNegativeQuantity(logger, line.Quantity, "quantity");

                quantities[line.ItemId] = line.Quantity;
            }

            return quantities;
        }

        /// <summary>
        /// Books stock the requester already collected: TRANSFER_OUT at the source and TRANSFER_IN at the destination of
        /// the approved quantities (nothing goes in transit), and queues the transfer for the ERP. The caller sets the status.
        /// </summary>
        public static async Task PostCollectedAsync(
            InventoryLedger ledger,
            InternalTransferOrder transfer,
            List<InternalTransferOrderItem> items,
            Dictionary<Guid, ItemBuyerMaster> materials,
            CancellationToken cancellationToken)
        {
            foreach (InternalTransferOrderItem item in items)
            {
                item.DispatchedQty = item.ApprovedQty;
                item.ReceivedQty = item.ApprovedQty;
                if (item.ApprovedQty <= 0)
                {
                    continue;
                }

                ItemBuyerMaster material = materials[item.MaterialId];
                foreach ((Guid locationId, string direction, string type) in new[]
                {
                    (transfer.FromLocationId, Common.SILA_DIRECTION_OUT, Common.SILA_TXN_TRANSFER_OUT),
                    (transfer.ToLocationId, Common.SILA_DIRECTION_IN, Common.SILA_TXN_TRANSFER_IN)
                })
                {
                    await ledger.PostAsync(new InventoryMovement
                    {
                        LocationId = locationId,
                        Material = material,
                        Direction = direction,
                        TransactionType = type,
                        BaseQuantity = item.ApprovedQty,
                        EnteredQuantity = item.ApprovedQty,
                        EnteredUom = item.Uom,
                        ReferenceType = Common.SILA_REF_ITO,
                        ReferenceId = transfer.Id,
                        ReferenceNumber = transfer.ItoNumber,
                        Reason = transfer.Reason
                    }, cancellationToken);
                }
            }

            ledger.QueueErpPosting(Common.SILA_REF_ITO, transfer.Id, transfer.ItoNumber, transfer.ToLocationId, Common.SILA_MOVEMENT_TRANSFER);
        }

        /// <summary>What the user may do with the transfer now, from its status and the user's locations.</summary>
        public static List<string> AllowedActions(InternalTransferOrder transfer, Guid userId, ICollection<Guid> locationIds)
        {
            List<string> actions = new List<string>();
            bool source = locationIds.Contains(transfer.FromLocationId);
            bool destination = locationIds.Contains(transfer.ToLocationId);
            if (transfer.Status == Common.SILA_ITO_PENDING_APPROVAL && source)
            {
                actions.Add(ACTION_APPROVE);
                actions.Add(ACTION_REJECT);
            }

            // Already collected: the stock is with the requester; the source confirms the handover or disputes it.
            if (transfer.Status == Common.SILA_ITO_APPROVED && source && transfer.AlreadyCollected)
            {
                actions.Add(ACTION_CONFIRM_HANDOVER);
                actions.Add(ACTION_DISPUTE);
            }

            if (transfer.Status == Common.SILA_ITO_APPROVED && source && !transfer.AlreadyCollected)
            {
                actions.Add(ACTION_DISPATCH);
            }

            if (transfer.Status == Common.SILA_ITO_DISPATCHED && destination)
            {
                actions.Add(ACTION_RECEIVE);
            }

            if ((transfer.Status == Common.SILA_ITO_PENDING_APPROVAL || transfer.Status == Common.SILA_ITO_APPROVED)
                && transfer.RequestedBy == userId)
            {
                actions.Add(ACTION_CANCEL);
            }

            return actions;
        }
    }
}
