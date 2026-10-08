using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaQuickTransferPolicy
{
    /// <summary>Saves the buyer's quick-transfer policy (one row per buyer, created on the first save).</summary>
    public class UpdateSilaQuickTransferPolicyCommandHandler : IRequestHandler<UpdateSilaQuickTransferPolicyCommand, SilaQuickTransferPolicyDto>
    {
        private const decimal MAX_QUANTITY = 1000000m;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaQuickTransferPolicyCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaQuickTransferPolicyDto> Handle(UpdateSilaQuickTransferPolicyCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving quick-transfer policy. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            SilaQuickTransferPolicyDto input = request.Request;
            if (input.MaximumQuantity != null && (input.MaximumQuantity <= 0 || input.MaximumQuantity > MAX_QUANTITY))
            {
                _logger.LogError($"Invalid quick-transfer maximum. MaximumQuantity: {input.MaximumQuantity}");
                throw new BadRequestCustomException("Invalid maximum quantity.", $"Enter a maximum greater than zero and at most {MAX_QUANTITY:0}, or leave it empty for no limit.");
            }

            if (input.MaximumValue != null && (input.MaximumValue <= 0 || input.MaximumValue > MAX_QUANTITY))
            {
                _logger.LogError($"Invalid quick-transfer maximum value. MaximumValue: {input.MaximumValue}");
                throw new BadRequestCustomException("Invalid maximum value.", $"Enter a maximum value greater than zero and at most {MAX_QUANTITY:0}, or leave it empty for no limit.");
            }

            string? sourceTypes = SilaQuickTransferRules.JoinTypes(_logger, input.AllowedSourceTypes, "source location type");
            string? destinationTypes = SilaQuickTransferRules.JoinTypes(_logger, input.AllowedDestinationTypes, "destination location type");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            QuickTransferPolicy? policy = await _repository.QuickTransferPolicy.FindFirstByConditionAsync(x => x.BuyerId == buyer.Id);
            if (policy == null)
            {
                policy = new QuickTransferPolicy { Id = Guid.NewGuid(), BuyerId = buyer.Id };
                _repository.QuickTransferPolicy.Create(policy);
            }

            policy.Enabled = input.Enabled;
            policy.MaximumQuantity = input.MaximumQuantity;
            policy.SkipManagerApproval = input.SkipManagerApproval;
            policy.OutletToOutletAllowed = input.OutletToOutletAllowed;
            policy.SourceConfirmationRequired = input.SourceConfirmationRequired;
            policy.MaximumValue = input.MaximumValue;
            policy.DestinationConfirmationRequired = input.DestinationConfirmationRequired;
            policy.ManagerNotification = input.ManagerNotification;
            policy.AllowedSourceTypes = sourceTypes;
            policy.AllowedDestinationTypes = destinationTypes;
            policy.IsActive = true;

            InventoryLedger ledger = new InventoryLedger(_repository, buyer.Id, request.UserId);
            ledger.AddEvent(Common.SILA_REF_MASTER_DATA, policy.Id, "QUICK_TRANSFER_POLICY_SAVED",
                $"Enabled={policy.Enabled} Max={policy.MaximumQuantity} SkipApproval={policy.SkipManagerApproval} OutletToOutlet={policy.OutletToOutletAllowed} SourceConfirmation={policy.SourceConfirmationRequired} MaxValue={policy.MaximumValue} DestinationConfirmation={policy.DestinationConfirmationRequired} ManagerNotification={policy.ManagerNotification} Sources={policy.AllowedSourceTypes ?? "ALL"} Destinations={policy.AllowedDestinationTypes ?? "ALL"}");
            await _repository.SaveAsync();

            _logger.LogInfo($"Quick-transfer policy saved. BuyerId: {buyer.Id}, Enabled: {policy.Enabled}");
            return SilaQuickTransferRules.ToDto(policy);
        }
    }
}
