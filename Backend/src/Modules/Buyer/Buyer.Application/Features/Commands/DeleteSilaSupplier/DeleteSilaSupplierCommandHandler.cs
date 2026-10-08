using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaSupplier
{
    public class DeleteSilaSupplierCommandHandler : IRequestHandler<DeleteSilaSupplierCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaSupplierCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(DeleteSilaSupplierCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting supplier. SupplierId: {request.SupplierId}, OrganizationId: {request.OrganizationId}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaSupplier? supplier = await _repository.SilaSupplier
                .FindFirstByConditionAsync(x => x.Id == request.SupplierId && x.BuyerId == buyer.Id && x.IsActive);
            if (supplier == null)
            {
                _logger.LogError($"Supplier not found. SupplierId: {request.SupplierId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Supplier not found.", "Select a supplier of the Supplier Master.");
            }

            // Invoices matched to the supplier keep their supplier name; the link is kept for history.
            supplier.IsActive = false;
            supplier.Status = SilaMasterDataRules.STATUS_INACTIVE;
            await _repository.SaveAsync();
            _logger.LogInfo($"Supplier deleted. SupplierId: {supplier.Id}");
            return supplier.Id;
        }
    }
}
