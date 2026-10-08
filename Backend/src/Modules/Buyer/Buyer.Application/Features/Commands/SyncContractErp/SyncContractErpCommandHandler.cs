using Buyer.Application.Services;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.Contracts.IServices;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SyncContractErp
{
    /// <summary>
    /// Sends the executed contract to the buyer ERP when the buyer has a contract API (POST_CONTRACT). Called by the
    /// contract screen once both parties have signed and the contract was created, and again to retry. Safe to call
    /// repeatedly: a contract the ERP already accepted is not sent again.
    /// </summary>
    public class SyncContractErpCommandHandler : IRequestHandler<SyncContractErpCommand, ContractErpSyncDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly IMediator _mediator;
        private readonly IUserContext _userContext;
        private readonly ILoggerManager _logger;

        public SyncContractErpCommandHandler(
            IRepositoryWrapper repository,
            IMediator mediator,
            IUserContext userContext,
            ILoggerManager logger)
        {
            _repository = repository;
            _mediator = mediator;
            _userContext = userContext;
            _logger = logger;
        }

        public async Task<ContractErpSyncDto> Handle(SyncContractErpCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Syncing contract with the ERP. ContractId: {request.ContractId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

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
                // Another organization contract looks the same as a missing one.
                _logger.LogError($"Contract not found. ContractId: {request.ContractId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Contract not found.", "No contract exists for this buyer organization.");
            }

            if (string.Equals(contract.Status, Common.CONTRACT_REJECTED_STATUS, StringComparison.OrdinalIgnoreCase)
                || string.Equals(contract.Status, Common.CONTRACT_DRAFT_STATUS, StringComparison.OrdinalIgnoreCase))
            {
                throw new BadRequestCustomException("Contract cannot be sent to the ERP.", $"A {contract.Status.ToLowerInvariant()} contract is not sent to the ERP.");
            }

            ContractErpIntegrationProcessor processor = new ContractErpIntegrationProcessor(_repository, _mediator, _userContext, _logger);

            // Every approver of the contract must have approved it.
            if (await processor.ApprovalPendingAsync(contract.Id, cancellationToken))
            {
                _logger.LogError($"Contract approval is not complete. ContractId: {contract.Id}");
                throw new BadRequestCustomException("Contract is not approved.", "Every approver must approve the contract before it is sent to the ERP.");
            }

            return await processor.SendAsync(contract.Id, buyer.Id, buyer.OrganizationId, request.UserId, cancellationToken);
        }
    }
}
