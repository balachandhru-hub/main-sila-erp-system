using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaCompanyCode
{
    public class UpdateSilaCompanyCodeCommandHandler : IRequestHandler<UpdateSilaCompanyCodeCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaCompanyCodeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(UpdateSilaCompanyCodeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating company code. CompanyCodeId: {request.CompanyCodeId}, OrganizationId: {request.OrganizationId}");
            SilaCompanyCodeWriteDto input = SilaMasterDataRules.Normalize(request.Request);
            List<string> errors = SilaMasterDataRules.CompanyCodeErrors(input);
            if (errors.Count > 0)
            {
                _logger.LogError($"Company code is invalid. CompanyCodeId: {request.CompanyCodeId}, Errors: {errors.Count}");
                throw new BadRequestCustomException("Company code is invalid.", string.Join(" ", errors));
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CompanyCodeMaster? companyCode = await _repository.CompanyCodeMaster
                .FindFirstByConditionAsync(x => x.Id == request.CompanyCodeId && x.BuyerId == buyer.Id && x.IsActive);
            if (companyCode == null)
            {
                _logger.LogError($"Company code not found. CompanyCodeId: {request.CompanyCodeId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Company code not found.", "Select a company code of the Company Code Master.");
            }

            if (companyCode.Code != input.Code)
            {
                bool taken = await _repository.CompanyCodeMaster
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.Id != companyCode.Id && x.Code == input.Code)
                    .AnyAsync(cancellationToken);
                if (taken)
                {
                    _logger.LogError($"Company code already exists. Code: {input.Code}, BuyerId: {buyer.Id}");
                    throw new ConflictCustomException("Company code already exists.", $"Another company code (possibly deleted) uses {input.Code}; choose another code.");
                }

                // Renaming a code in use would orphan the APIs and properties routed by it.
                string? usage = await SilaCompanyCodeUsage.DescribeAsync(_repository, buyer, companyCode.Code, cancellationToken);
                if (usage != null)
                {
                    _logger.LogError($"Company code in use cannot be renamed. Code: {companyCode.Code}, BuyerId: {buyer.Id}");
                    throw new BadRequestCustomException("Company code is in use.", $"{usage} Change the name only, or create a new company code.");
                }
            }

            SilaMasterDataRules.Apply(companyCode, input);
            await _repository.SaveAsync();
            _logger.LogInfo($"Company code updated. CompanyCodeId: {companyCode.Id}");
            return companyCode.Id;
        }
    }
}
