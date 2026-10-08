using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoicePoCandidates
{
    /// <summary>
    /// Open purchase orders of the invoice's supplier, newest first; the purchase order whose number the invoice names
    /// comes first. Without a supplier, open purchase orders are searched by number or supplier name.
    /// </summary>
    public class GetSilaInvoicePoCandidatesQueryHandler : IRequestHandler<GetSilaInvoicePoCandidatesQuery, List<SilaReceivingPoListItemDto>>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoicePoCandidatesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaReceivingPoListItemDto>> Handle(GetSilaInvoicePoCandidatesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching invoice purchase order candidates. InvoiceId: {request.InvoiceId}, Search: {request.Search}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Invoice invoice = await SilaReceivingRules.GetInvoiceAsync(_repository, _logger, buyer.Id, request.InvoiceId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, MAX_LIMIT);
            List<Guid> keys = await SilaInvoiceMatching.SupplierKeysAsync(_repository, invoice, cancellationToken);

            IQueryable<PurchaseOrder> query = _repository.PurchaseOrder
                .FindByCondition(x => x.BuyerId == buyer.Id
                    && x.IsActive
                    && x.Status != SilaReceivingRules.PO_CANCELLED
                    && x.Status != Common.SILA_PO_RECEIVED
                    && x.Items.Any(item => item.IsActive && item.Quantity - item.ReceivedQuantity > 0));
            if (keys.Count > 0)
            {
                query = query.Where(x => keys.Contains(x.SupplierId));
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.PoNumber.Contains(search) || (x.SupplierName != null && x.SupplierName.Contains(search)));
            }

            string? named = invoice.PoNumber;
            List<SilaReceivingPoListItemDto> result = await query
                .OrderByDescending(x => named != null && x.PoNumber == named)
                .ThenByDescending(x => x.OrderDate)
                .Skip(index)
                .Take(limit)
                .Select(x => new SilaReceivingPoListItemDto
                {
                    Id = x.Id,
                    PoNumber = x.PoNumber,
                    SupplierId = x.SupplierId,
                    SupplierName = x.SupplierName,
                    OrderDate = x.OrderDate,
                    Status = x.Status,
                    PlantCode = x.PlantCode,
                    Currency = x.Currency,
                    TotalAmount = x.TotalAmount,
                    LineCount = x.Items.Count(item => item.IsActive),
                    OpenLineCount = x.Items.Count(item => item.IsActive && item.Quantity - item.ReceivedQuantity > 0)
                })
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Invoice purchase order candidates fetched. InvoiceId: {invoice.Id}, Count: {result.Count}");
            return result;
        }
    }
}
