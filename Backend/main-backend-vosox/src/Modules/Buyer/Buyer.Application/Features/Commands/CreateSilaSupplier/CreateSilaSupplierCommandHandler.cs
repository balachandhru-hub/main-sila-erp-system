using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.CreateSilaSupplier
{
    public class CreateSilaSupplierCommandHandler : IRequestHandler<CreateSilaSupplierCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public CreateSilaSupplierCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(CreateSilaSupplierCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Creating supplier. OrganizationId: {request.OrganizationId}, SupplierCode: {request.Request.SupplierCode}");
            SilaSupplierWriteDto input = SilaMasterDataRules.Normalize(request.Request);
            List<string> errors = SilaMasterDataRules.SupplierErrors(input);
            if (errors.Count > 0)
            {
                _logger.LogError($"Supplier is invalid. SupplierCode: {input.SupplierCode}, Errors: {errors.Count}");
                throw new BadRequestCustomException("Supplier is invalid.", string.Join(" ", errors));
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);

            // The code is unique per buyer, deleted rows included: a deleted supplier is brought back.
            SilaSupplier? existing = await _repository.SilaSupplier
                .FindFirstByConditionAsync(x => x.BuyerId == buyer.Id && x.SupplierCode == input.SupplierCode);
            if (existing != null && existing.IsActive)
            {
                _logger.LogError($"Supplier code already exists. SupplierCode: {input.SupplierCode}, BuyerId: {buyer.Id}");
                throw new ConflictCustomException("Supplier code already exists.", $"Supplier {input.SupplierCode} is already in the Supplier Master; open it to change it.");
            }

            SilaSupplier supplier = existing ?? new SilaSupplier { Id = Guid.NewGuid(), BuyerId = buyer.Id };
            SilaMasterDataRules.Apply(supplier, input);
            if (existing == null)
            {
                _repository.SilaSupplier.Create(supplier);
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Supplier created. SupplierId: {supplier.Id}, BuyerId: {buyer.Id}");
            return supplier.Id;
        }
    }
}
