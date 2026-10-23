using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaCreditMemos
{
    public class GetSilaCreditMemosQueryHandler : IRequestHandler<GetSilaCreditMemosQuery, List<SilaCreditMemoListItemDto>>
    {
        private static readonly string[] ExactStatuses =
        {
            Common.SILA_CREDIT_MEMO_DRAFT,
            Common.SILA_CREDIT_MEMO_PENDING_APPROVAL,
            Common.SILA_CREDIT_MEMO_READY_TO_POST,
            Common.SILA_CREDIT_MEMO_POSTING,
            Common.SILA_CREDIT_MEMO_POSTED,
            Common.SILA_CREDIT_MEMO_POSTING_FAILED,
            Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN,
            Common.SILA_CREDIT_MEMO_LOCAL_FAILED
        };

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaCreditMemosQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaCreditMemoListItemDto>> Handle(GetSilaCreditMemosQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching credit memos. OrganizationId: {request.OrganizationId}, Search: {request.Search}, Status: {request.Status}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = SilaInputRules.Limit(request.Limit, 20);

            IQueryable<CreditMemo> query = _repository.CreditMemo.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string[] statuses = StatusesOf(request.Status);
                query = query.Where(x => statuses.Contains(x.Status));
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                List<Guid> erpIds = await _repository.InventoryErpPosting
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive
                        && x.ReferenceType == Common.SILA_REF_CREDIT_MEMO
                        && x.ErpReference != null && x.ErpReference.Contains(search))
                    .Select(x => x.ReferenceId)
                    .ToListAsync(cancellationToken);
                query = query.Where(x =>
                    (x.CreditMemoNumber != null && x.CreditMemoNumber.Contains(search))
                    || (x.CreditMemoReference != null && x.CreditMemoReference.Contains(search))
                    || (x.ReferenceSupplierInvoiceNumber != null && x.ReferenceSupplierInvoiceNumber.Contains(search))
                    || (x.ReferenceErpInvoiceId != null && x.ReferenceErpInvoiceId.Contains(search))
                    || (x.SupplierName != null && x.SupplierName.Contains(search))
                    || (x.PoNumber != null && x.PoNumber.Contains(search))
                    || erpIds.Contains(x.Id));
            }

            List<SilaCreditMemoListItemDto> result = await query
                .OrderByDescending(x => x.DateCreated)
                .Skip(index)
                .Take(limit)
                .Select(x => new SilaCreditMemoListItemDto
                {
                    Id = x.Id,
                    CreditMemoNumber = x.CreditMemoNumber,
                    ReferenceInvoiceId = x.ReferenceInvoiceId,
                    ReferenceSupplierInvoiceNumber = x.ReferenceSupplierInvoiceNumber,
                    ReferenceErpInvoiceId = x.ReferenceErpInvoiceId,
                    Status = x.Status,
                    GrossAmount = x.GrossAmount,
                    Currency = x.Currency,
                    CreatedOn = x.DateCreated,
                    SupplierName = x.SupplierName,
                    PoNumber = x.PoNumber
                })
                .ToListAsync(cancellationToken);

            List<Guid> memoIds = result.Select(x => x.Id).ToList();
            List<CreditMemo> rows = memoIds.Count == 0
                ? new List<CreditMemo>()
                : await _repository.CreditMemo.FindByCondition(x => memoIds.Contains(x.Id)).ToListAsync(cancellationToken);
            List<Guid> postingIds = rows.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await _repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, CreditMemo> byId = rows.ToDictionary(x => x.Id);
            foreach (SilaCreditMemoListItemDto item in result)
            {
                if (!byId.TryGetValue(item.Id, out CreditMemo? memo) || memo.ErpPostingId == null)
                {
                    continue;
                }

                if (!postings.TryGetValue(memo.ErpPostingId.Value, out InventoryErpPosting? posting))
                {
                    continue;
                }

                item.ErpReference = posting.ErpReference;
                item.FiscalYear = SilaCreditMemoPosting.ReadFiscalYear(posting.ErpResponsePayload);
            }

            _logger.LogInfo($"Credit memos fetched. Count: {result.Count}, BuyerId: {buyer.Id}");
            return result;
        }

        private string[] StatusesOf(string raw)
        {
            if (raw.Equals("IN_PROGRESS", StringComparison.OrdinalIgnoreCase))
            {
                return SilaCreditMemoLifecycle.OpenStatuses
                    .Concat(new[] { Common.SILA_CREDIT_MEMO_POSTING })
                    .Distinct(StringComparer.OrdinalIgnoreCase)
                    .ToArray();
            }

            if (raw.Equals("FAILED", StringComparison.OrdinalIgnoreCase))
            {
                return new[]
                {
                    Common.SILA_CREDIT_MEMO_POSTING_FAILED,
                    Common.SILA_CREDIT_MEMO_POSTING_UNKNOWN
                };
            }

            if (raw.Equals(Common.SILA_CREDIT_MEMO_POSTED, StringComparison.OrdinalIgnoreCase))
            {
                return new[] { Common.SILA_CREDIT_MEMO_POSTED };
            }

            return new[] { SilaInputRules.OneOf(_logger, raw, ExactStatuses, "credit memo status") };
        }
    }
}
