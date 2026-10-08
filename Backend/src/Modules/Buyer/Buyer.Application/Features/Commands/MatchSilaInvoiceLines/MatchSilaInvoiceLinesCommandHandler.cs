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

            HashSet<Guid> poItemIds = invoice.PurchaseOrderId == null
                ? new HashSet<Guid>()
                : (await _repository.PurchaseOrderItem
                    .FindByCondition(x => x.PurchaseOrderId == invoice.PurchaseOrderId.Value && x.IsActive)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken)).ToHashSet();
            if (chosen.Any(id => !poItemIds.Contains(id)))
            {
                _logger.LogError($"Invoice line matched to a line of another purchase order. InvoiceId: {invoice.Id}");
                throw new BadRequestCustomException("Purchase order line not found.", $"Match invoice lines only to lines of purchase order {invoice.PoNumber}.");
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
