using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SetSilaCompanyCodeStatus
{
    /// <summary>Suspends or activates a company code. A suspended code stays listed (status INACTIVE) and keeps its history.</summary>
    public class SetSilaCompanyCodeStatusCommandHandler : IRequestHandler<SetSilaCompanyCodeStatusCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SetSilaCompanyCodeStatusCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(SetSilaCompanyCodeStatusCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Setting company code status. CompanyCodeId: {request.CompanyCodeId}, Status: {request.Status}, OrganizationId: {request.OrganizationId}");
            string status = SilaInputRules.OneOf(_logger, request.Status, SilaMasterDataRules.CompanyCodeStatuses, "status");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CompanyCodeMaster? companyCode = await _repository.CompanyCodeMaster
                .FindFirstByConditionAsync(x => x.Id == request.CompanyCodeId && x.BuyerId == buyer.Id && x.IsActive);
            if (companyCode == null)
            {
                _logger.LogError($"Company code not found. CompanyCodeId: {request.CompanyCodeId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Company code not found.", "Select a company code of the Company Code Master.");
            }

            string current = string.IsNullOrWhiteSpace(companyCode.Status) ? SilaMasterDataRules.STATUS_ACTIVE : companyCode.Status;
            if (current == status)
            {
                _logger.LogError($"Company code already has the status. Code: {companyCode.Code}, Status: {status}");
                throw new BadRequestCustomException(
                    status == SilaMasterDataRules.STATUS_ACTIVE ? "Company code is already active." : "Company code is already suspended.",
                    "Refresh the list to see its current status.");
            }

            companyCode.Status = status;
            companyCode.UpdatedBy = request.UserId;
            await _repository.SaveAsync();
            _logger.LogInfo($"Company code status set. Code: {companyCode.Code}, Status: {status}");
            return companyCode.Id;
        }
    }
}
