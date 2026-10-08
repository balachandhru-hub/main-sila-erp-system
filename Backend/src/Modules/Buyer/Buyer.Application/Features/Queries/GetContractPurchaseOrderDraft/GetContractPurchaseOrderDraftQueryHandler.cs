using Buyer.Application.Features.Shared;
using Buyer.Application.Services;
using Buyer.Application.Services.Integration;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetContractPurchaseOrderDraft
{
    /// <summary>
    /// Tells the contract screen what a purchase order from this contract needs: whether the buyer has a purchase
    /// order API (so the ERP details must be entered), and the values that are already known: the supplier code from
    /// the buyer supplier master and the ERP details of the buyer latest order.
    /// </summary>
    public class GetContractPurchaseOrderDraftQueryHandler : IRequestHandler<GetContractPurchaseOrderDraftQuery, ContractPurchaseOrderDraftDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly ILoggerManager _logger;

        public GetContractPurchaseOrderDraftQueryHandler(IRepositoryWrapper repository, IMediator mediator, ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _logger = logger;
        }

        public async Task<ContractPurchaseOrderDraftDto> Handle(GetContractPurchaseOrderDraftQuery request, CancellationToken cancellationToken)
        {
            BuyerBusinessProfile? buyer = _repository.BuyerBusinessProfile.FindFirstByCondition(
                x => x.OrganizationId == request.OrganizationId && x.IsActive);
            if (buyer == null)
            {
                _logger.LogError($"Buyer not found. OrganizationId: {request.OrganizationId}");
                throw new NotFoundCustomException("Buyer not found.", "The signed-in organization does not have a buyer profile.");
            }

            PredefinedContract? contract = await _repository.PredefinedContract
                .FindByCondition(x => x.Id == request.ContractId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (contract == null)
            {
                _logger.LogError($"Contract not found. ContractId: {request.ContractId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Contract not found.", "No contract exists for this buyer organization.");
            }

            CreateContractPurchaseOrderRequestDto values = await ContractPurchaseOrderDrafts.LastUsedAsync(_repository, buyer.Id, cancellationToken);
            values.PurchaseOrderType ??= ContractPurchaseOrderPayload.DEFAULT_ORDER_TYPE;
            values.AccountAssignmentCategory ??= ContractPurchaseOrderPayload.DEFAULT_ACCOUNT_ASSIGNMENT_CATEGORY;
            values.PurchaseOrderDate = DateTime.UtcNow.Date;

            // The supplier code belongs to this contract supplier, never to the supplier of the last order.
            values.SupplierCode = await ContractPurchaseOrderDrafts.FindSupplierCodeAsync(_repository, buyer.Id, contract.SupplierId, cancellationToken);

            IntegrationApiDto? api = await new BuyerPurchaseDocumentGateway(_mediator, _logger)
                .FindPurchaseOrderApiAsync(buyer.OrganizationId, values.CompanyCode, cancellationToken);
            return new ContractPurchaseOrderDraftDto
            {
                ErpConfigured = api != null,
                RequiredFields = api != null ? ContractPurchaseOrderDrafts.RequiredFieldNames() : new List<string>(),
                Values = values
            };
        }
    }
}
