using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaCompanyCode
{
    public class CreateSilaCompanyCodeCommandHandler : IRequestHandler<CreateSilaCompanyCodeCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaCompanyCodeCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(CreateSilaCompanyCodeCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating company code. OrganizationId: {request.OrganizationId}, Code: {request.Request.Code}");
            SilaCompanyCodeWriteDto input = SilaMasterDataRules.Normalize(request.Request);
            List<string> errors = SilaMasterDataRules.CompanyCodeErrors(input);
            if (errors.Count > 0)
            {
                _logger.LogError($"Company code is invalid. Code: {input.Code}, Errors: {errors.Count}");
                throw new BadRequestCustomException("Company code is invalid.", string.Join(" ", errors));
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            CompanyCodeMaster? existing = await _repository.CompanyCodeMaster
                .FindFirstByConditionAsync(x => x.BuyerId == buyer.Id && x.Code == input.Code);
            if (existing != null && existing.IsActive)
            {
                _logger.LogError($"Company code already exists. Code: {input.Code}, BuyerId: {buyer.Id}");
                throw new ConflictCustomException("Company code already exists.", $"Company code {input.Code} is already in the Company Code Master.");
            }

            // A deleted code is brought back rather than added twice (the code is unique per buyer).
            CompanyCodeMaster companyCode = existing ?? new CompanyCodeMaster { Id = Guid.NewGuid(), BuyerId = buyer.Id };
            SilaMasterDataRules.Apply(companyCode, input);
            if (existing == null)
            {
                _repository.CompanyCodeMaster.Create(companyCode);
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Company code created. CompanyCodeId: {companyCode.Id}, BuyerId: {buyer.Id}");
            return companyCode.Id;
        }
    }
}
