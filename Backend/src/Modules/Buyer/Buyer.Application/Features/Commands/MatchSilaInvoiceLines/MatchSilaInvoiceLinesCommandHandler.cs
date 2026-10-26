using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.MatchSilaInvoiceLines
{
    public class MatchSilaInvoiceLinesCommandHandler : IRequestHandler<MatchSilaInvoiceLinesCommand, SilaInvoiceDetailDto>
    {
        private const int MAX_LINES = 500;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public MatchSilaInvoiceLinesCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceDetailDto> Handle(MatchSilaInvoiceLinesCommand request, CancellationToken cancellationToken)
        {
            List<SilaInvoiceLineMatchDto> matches = request.Request.Lines ?? new List<SilaInvoiceLineMatchDto>();
            _logger.LogInfo($"Matching invoice lines. InvoiceId: {request.InvoiceId}, Lines: {matches.Count}");
            if (matches.Count == 0 || matches.GroupBy(x => x.InvoiceItemId).Any(x => x.Count() > 1))
            {
                _logger.LogError($"Invoice line matches are empty or repeated. InvoiceId: {request.InvoiceId}");
                throw new BadRequestCustomException("Invalid line matches.", "Send each invoice line once with the purchase order line it bills.");
            }

            SilaInputRules.Lines(_logger, matches, MAX_LINES, "invoice line");
            List<Guid> chosen = matches.Where(x => x.PurchaseOrderItemId != null).Select(x => x.PurchaseOrderItemId!.Value).ToList();
            if (chosen.Count != chosen.Distinct().Count())
            {
                _logger.LogError($"A purchase order line is matched twice. InvoiceId: {request.InvoiceId}");
                throw new BadRequestCustomException("Purchase order line used twice.", "Match each purchase order line to one invoice line only.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            if (invoice.Status == Common.SILA_INVOICE_GRN_POSTED)
            {
                _logger.LogError($"Invoice already received; lines cannot change. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Invoice already received.", "Goods were received against this invoice; its lines can no longer change.");
            }

            if (invoice.PurchaseOrderId == null && chosen.Count > 0)
            {
                _logger.LogError($"Invoice has no purchase order. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("No purchase order.", "Match the invoice to a purchase order before matching its lines.");
            }

            List<PurchaseOrderItem> chosenItems = chosen.Count == 0
                ? new List<PurchaseOrderItem>()
                : await _repository.PurchaseOrderItem.FindByCondition(x => chosen.Contains(x.Id) && x.IsActive).ToListAsync(cancellationToken);
            if (chosenItems.Count != chosen.Count)
            {
                _logger.LogError($"Invoice line matched to a missing purchase order line. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Purchase order line not found.", "Match invoice lines to lines of this supplier's purchase orders.");
            }

            List<Guid> chosenPoIds = chosenItems.Select(x => x.PurchaseOrderId).Distinct().ToList();
            List<PurchaseOrder> chosenOrders = chosenPoIds.Count == 0
                ? new List<PurchaseOrder>()
                : await _repository.PurchaseOrder.FindByCondition(x => chosenPoIds.Contains(x.Id) && x.BuyerId == buyer.Id && x.IsActive).ToListAsync(cancellationToken);
            if (chosenOrders.Count != chosenPoIds.Count)
            {
                _logger.LogError($"Invoice line matched to another buyer's purchase order. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Purchase order line not found.", "Match invoice lines to lines of this supplier's purchase orders.");
            }

            PurchaseOrder? headerOrder = invoice.PurchaseOrderId == null
                ? null
                : await _repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == invoice.PurchaseOrderId && x.BuyerId == buyer.Id);
            Guid? supplierId = invoice.SupplierId ?? headerOrder?.SupplierId;
            if (supplierId != null && chosenOrders.Any(x => x.SupplierId != supplierId))
            {
                _logger.LogError($"Invoice line matched to another supplier. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Purchase order of another supplier.", "Match invoice lines only to purchase orders of this supplier.");
            }

            List<Guid> itemIds = matches.Select(x => x.InvoiceItemId).ToList();
            Dictionary<Guid, InvoiceItem> items = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && itemIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            if (items.Count != itemIds.Count)
            {
                _logger.LogError($"Invoice line not found. InvoiceId: {invoice.Id}");
                throw new NotFoundCustomException("Invoice line not found.", "Reload the invoice; one of its lines no longer exists.");
            }

            // A purchase order line already matched to another invoice line of this invoice is taken over.
            List<InvoiceItem> others = await _repository.InvoiceItem
                .FindByCondition(x => x.InvoiceId == invoice.Id && x.IsActive && !itemIds.Contains(x.Id) && x.PurchaseOrderItemId != null && chosen.Contains(x.PurchaseOrderItemId.Value))
                .ToListAsync(cancellationToken);
            foreach (InvoiceItem other in others)
            {
                other.PurchaseOrderItemId = null;
                other.MatchStatus = SilaReceivingRules.MATCH_UNMATCHED;
                _repository.InvoiceItem.Update(other);
            }

            foreach (SilaInvoiceLineMatchDto match in matches)
            {
                InvoiceItem item = items[match.InvoiceItemId];
                item.PurchaseOrderItemId = match.PurchaseOrderItemId;
                item.MatchStatus = match.PurchaseOrderItemId == null ? SilaReceivingRules.MATCH_UNMATCHED : SilaReceivingRules.MATCH_MATCHED;
                _repository.InvoiceItem.Update(item);
            }

            await _repository.SaveAsync();
            SilaInvoiceDetailDto detail = await SilaReceivingRules.ToInvoiceDetailAsync(_repository, invoice, cancellationToken);
            _logger.LogInfo($"Invoice lines matched. InvoiceId: {invoice.Id}, Matched: {chosen.Count}");
            return detail;
        }
    }
}
