using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceResults
{
    public class GetSilaInvoiceResultsQueryHandler : IRequestHandler<GetSilaInvoiceResultsQuery, SilaInvoiceResultsDto>
    {
        private const int MAX_IDS = 200;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoiceResultsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceResultsDto> Handle(GetSilaInvoiceResultsQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid> ids = request.Ids.Where(x => x != Guid.Empty).Distinct().Take(MAX_IDS).ToList();
            SilaInvoiceResultsDto page = new SilaInvoiceResultsDto();
            if (ids.Count == 0)
            {
                return page;
            }

            List<InventoryErpPosting> postings = await _repository.InventoryErpPosting
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && ids.Contains(x.Id))
                .ToListAsync(cancellationToken);
            Dictionary<Guid, SilaInvoiceTrackerView> views = new Dictionary<Guid, SilaInvoiceTrackerView>();
            foreach (Guid invoiceId in postings.Where(x => SilaInvoiceTracker.IsInvoiceFamily(x.ReferenceType)).Select(x => x.ReferenceId).Distinct())
            {
                views[invoiceId] = await SilaInvoiceTracker.ReadAsync(_repository, buyer.Id, invoiceId, cancellationToken);
            }

            foreach (InventoryErpPosting posting in postings)
            {
                if (!views.TryGetValue(posting.ReferenceId, out SilaInvoiceTrackerView? view) || string.IsNullOrWhiteSpace(view.Message))
                {
                    continue;
                }

                page.Results.Add(new SilaInvoiceResultItemDto
                {
                    Id = posting.Id,
                    ErpInvoiceId = view.ErpInvoiceId,
                    Message = view.Message
                });
            }

            return page;
        }
    }
}
