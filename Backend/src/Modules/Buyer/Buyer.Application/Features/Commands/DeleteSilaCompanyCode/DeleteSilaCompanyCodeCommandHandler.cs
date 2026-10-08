using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaCompanyCode
{
    public class DeleteSilaCompanyCodeCommandHandler : IRequestHandler<DeleteSilaCompanyCodeCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaCompanyCodeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(DeleteSilaCompanyCodeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting company code. CompanyCodeId: {request.CompanyCodeId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CompanyCodeMaster? companyCode = await _repository.CompanyCodeMaster
                .FindFirstByConditionAsync(x => x.Id == request.CompanyCodeId && x.BuyerId == buyer.Id && x.IsActive);
            if (companyCode == null)
            {
                _logger.LogError($"Company code not found. CompanyCodeId: {request.CompanyCodeId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Company code not found.", "Select a company code of the Company Code Master.");
            }

            string? usage = await SilaCompanyCodeUsage.DescribeAsync(_repository, buyer, companyCode.Code, cancellationToken);
            if (usage != null)
            {
                _logger.LogError($"Company code in use cannot be deleted. Code: {companyCode.Code}, BuyerId: {buyer.Id}");
                throw new BadRequestCustomException("Company code is in use.", $"{usage} Remove that use first.");
            }

            companyCode.IsActive = false;
            await _repository.SaveAsync();
            _logger.LogInfo($"Company code deleted. CompanyCodeId: {companyCode.Id}");
            return companyCode.Id;
        }
    }
}
