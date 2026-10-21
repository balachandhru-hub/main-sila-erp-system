using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaInvoiceFlow
{
    public class GetSilaInvoiceFlowQueryHandler : IRequestHandler<GetSilaInvoiceFlowQuery, SilaInvoiceFlowDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaInvoiceFlowQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaInvoiceFlowDto> Handle(GetSilaInvoiceFlowQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(
                x => x.Id == request.PostingId && x.BuyerId == buyer.Id && x.IsActive);
            if (posting == null || !SilaInvoiceTracker.IsInvoiceFamily(posting.ReferenceType))
            {
                throw new NotFoundCustomException("Transaction not found.", "Select an invoice transaction from this tracker.");
            }

            SilaInvoiceTrackerView view = await SilaInvoiceTracker.ReadAsync(_repository, buyer.Id, posting.ReferenceId, cancellationToken);
            return new SilaInvoiceFlowDto
            {
                ErpInvoiceId = view.ErpInvoiceId,
                Message = view.Message,
                Steps = view.Steps
            };
        }
    }
}
