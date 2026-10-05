using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.UpdateSilaSupplier
{
    public class UpdateSilaSupplierCommandHandler : IRequestHandler<UpdateSilaSupplierCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public UpdateSilaSupplierCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(UpdateSilaSupplierCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Updating supplier. SupplierId: {request.SupplierId}, OrganizationId: {request.OrganizationId}");
            SilaSupplierWriteDto input = SilaMasterDataRules.Normalize(request.Request);
            List<string> errors = SilaMasterDataRules.SupplierErrors(input);
            if (errors.Count > 0)
            {
                _logger.LogError($"Supplier is invalid. SupplierId: {request.SupplierId}, Errors: {errors.Count}");
                throw new BadRequestCustomException("Supplier is invalid.", string.Join(" ", errors));
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaSupplier? supplier = await _repository.SilaSupplier
                .FindFirstByConditionAsync(x => x.Id == request.SupplierId && x.BuyerId == buyer.Id && x.IsActive);
            if (supplier == null)
            {
                _logger.LogError($"Supplier not found. SupplierId: {request.SupplierId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Supplier not found.", "Select a supplier of the Supplier Master.");
            }

            if (supplier.SupplierCode != input.SupplierCode)
            {
                bool taken = await _repository.SilaSupplier
                    .FindByCondition(x => x.BuyerId == buyer.Id && x.Id != supplier.Id && x.SupplierCode == input.SupplierCode)
                    .AnyAsync(cancellationToken);
                if (taken)
                {
                    _logger.LogError($"Supplier code already exists. SupplierCode: {input.SupplierCode}, BuyerId: {buyer.Id}");
                    throw new ConflictCustomException("Supplier code already exists.", $"Another supplier (possibly deleted) uses code {input.SupplierCode}; choose another code.");
                }
            }

            SilaMasterDataRules.Apply(supplier, input);
            await _repository.SaveAsync();
            _logger.LogInfo($"Supplier updated. SupplierId: {supplier.Id}");
            return supplier.Id;
        }
    }
}
