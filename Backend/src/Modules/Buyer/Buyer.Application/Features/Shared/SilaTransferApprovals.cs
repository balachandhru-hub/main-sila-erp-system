using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;

namespace Buyer.Application.Features.Shared
{
    /// <summary>
    /// The approval of each side of a transfer, derived from its status and workflow events: the SOURCE approves or
    /// rejects, the DESTINATION receives. Quantities are only shown for single-line transfers.
    /// </summary>
    public static class SilaTransferApprovals
    {
        public const string SIDE_SOURCE = "SOURCE";
        public const string SIDE_DESTINATION = "DESTINATION";
        private const string STATUS_PENDING = "PENDING";

        public static List<SilaTransferApprovalDto> Build(
            InternalTransferOrder transfer,
            List<InternalTransferOrderItem> items,
            List<InventoryWorkflowEvent> events,
            SilaTransferFigures.CostBook book,
            Dictionary<Guid, string> users)
        {
            InternalTransferOrderItem? single = items.Count == 1 ? items[0] : null;
            return new List<SilaTransferApprovalDto> { Source(transfer, single, events, book, users), Destination(transfer, single, events, book, users) };
        }

        private static SilaTransferApprovalDto Source(
            InternalTransferOrder transfer,
            InternalTransferOrderItem? line,
            List<InventoryWorkflowEvent> events,
            SilaTransferFigures.CostBook book,
            Dictionary<Guid, string> users)
        {
            InventoryWorkflowEvent? decision = events.LastOrDefault(x => x.Action == Common.SILA_ITO_APPROVED || x.Action == Common.SILA_ITO_REJECTED);
            string status = transfer.Status switch
            {
                Common.SILA_ITO_REJECTED => Common.SILA_ITO_REJECTED,
                Common.SILA_ITO_PENDING_APPROVAL => STATUS_PENDING,
                Common.SILA_ITO_CANCELLED => decision?.Action == Common.SILA_ITO_APPROVED ? Common.SILA_ITO_APPROVED : Common.SILA_ITO_CANCELLED,
                _ => Common.SILA_ITO_APPROVED
            };

            SilaTransferApprovalDto result = Describe(SIDE_SOURCE, status, decision, users);
            if (line != null)
            {
                decimal available = book.OnHand(transfer.FromLocationId, line.MaterialId);
                decimal leaving = line.ApprovedQty > 0 ? line.ApprovedQty : line.RequestedQty;
                result.AvailableQty = available;
                result.RequestedQty = line.RequestedQty;
                result.ApprovedQty = status == Common.SILA_ITO_APPROVED ? line.ApprovedQty : null;
                result.StockAfter = SilaTransferFigures.BeforeDispatch(transfer) ? available - leaving : available;
            }

            return result;
        }

        private static SilaTransferApprovalDto Destination(
            InternalTransferOrder transfer,
            InternalTransferOrderItem? line,
            List<InventoryWorkflowEvent> events,
            SilaTransferFigures.CostBook book,
            Dictionary<Guid, string> users)
        {
            InventoryWorkflowEvent? receipt = events.LastOrDefault(x => x.Action == Common.SILA_ITO_RECEIVED || x.Action == Common.SILA_ITO_DISCREPANCY);
            string status = transfer.Status switch
            {
                Common.SILA_ITO_RECEIVED => Common.SILA_ITO_RECEIVED,
                Common.SILA_ITO_DISCREPANCY => Common.SILA_ITO_DISCREPANCY,
                Common.SILA_ITO_REJECTED => Common.SILA_ITO_CANCELLED,
                Common.SILA_ITO_CANCELLED => Common.SILA_ITO_CANCELLED,
                _ => STATUS_PENDING
            };

            SilaTransferApprovalDto result = Describe(SIDE_DESTINATION, status, receipt, users);
            if (line != null)
            {
                decimal available = book.OnHand(transfer.ToLocationId, line.MaterialId);
                bool received = transfer.ReceivedOn != null;
                decimal incoming = line.DispatchedQty > 0 ? line.DispatchedQty : (line.ApprovedQty > 0 ? line.ApprovedQty : line.RequestedQty);
                result.AvailableQty = available;
                result.RequestedQty = incoming;
                result.ApprovedQty = received ? line.ReceivedQty : null;
                result.StockAfter = received || status == Common.SILA_ITO_CANCELLED ? available : available + incoming;
            }

            return result;
        }

        private static SilaTransferApprovalDto Describe(
            string side, string status, InventoryWorkflowEvent? decision, Dictionary<Guid, string> users)
        {
            return new SilaTransferApprovalDto
            {
                Side = side,
                Status = status,
                Comment = decision?.Comment,
                ActorName = decision == null ? null : SilaMovementLookup.NameOf(users, decision.ActorUserId),
                On = decision?.DateCreated
            };
        }
    }
}
