using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetContractPurchaseOrders
{
    public class GetContractPurchaseOrdersQueryHandler : IRequestHandler<GetContractPurchaseOrdersQuery, List<ContractPurchaseOrderDto>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetContractPurchaseOrdersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<ContractPurchaseOrderDto>> Handle(GetContractPurchaseOrdersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching purchase orders of contract. ContractId: {request.ContractId}, OrganizationId: {request.OrganizationId}");

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

            Dictionary<Guid, List<ContractPurchaseOrderDto>> orders = await ContractPurchaseOrderRules.ListByContractAsync(
                _repository, new List<PredefinedContract> { contract }, cancellationToken);
            List<ContractPurchaseOrderDto> result = orders.GetValueOrDefault(contract.Id) ?? new List<ContractPurchaseOrderDto>();
            _logger.LogInfo($"Purchase orders of contract fetched. Count: {result.Count}, ContractId: {contract.Id}");
            return result;
        }
    }
}
