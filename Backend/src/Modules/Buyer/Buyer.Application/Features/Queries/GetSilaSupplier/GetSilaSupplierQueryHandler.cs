using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaSupplier
{
    public class GetSilaSupplierQueryHandler : IRequestHandler<GetSilaSupplierQuery, SilaSupplierDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaSupplierQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaSupplierDto> Handle(GetSilaSupplierQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching supplier. SupplierId: {request.SupplierId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaSupplier? supplier = await _repository.SilaSupplier
                .FindByCondition(x => x.Id == request.SupplierId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (supplier == null)
            {
                _logger.LogError($"Supplier not found. SupplierId: {request.SupplierId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Supplier not found.", "Select a supplier of the Supplier Master.");
            }

            _logger.LogInfo($"Supplier fetched. SupplierId: {supplier.Id}");
            return SilaMasterDataRules.ToDto(supplier);
        }
    }
}
