using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaErpPostingPayload
{
    public class GetSilaErpPostingPayloadQueryHandler : IRequestHandler<GetSilaErpPostingPayloadQuery, SilaErpPostingPayloadDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaErpPostingPayloadQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaErpPostingPayloadDto> Handle(GetSilaErpPostingPayloadQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Reading ERP posting payload. OrganizationId: {request.OrganizationId}, PostingId: {request.PostingId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(
                x => x.Id == request.PostingId && x.BuyerId == buyer.Id && x.IsActive);
            if (posting == null)
            {
                _logger.LogError($"ERP posting not found. PostingId: {request.PostingId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Transaction not found.", "Select a transaction from this tracker.");
            }

            return new SilaErpPostingPayloadDto
            {
                TechnicalDetail = SilaErpPayload.Sanitise(posting.ErpRequestPayload)
            };
        }
    }
}
