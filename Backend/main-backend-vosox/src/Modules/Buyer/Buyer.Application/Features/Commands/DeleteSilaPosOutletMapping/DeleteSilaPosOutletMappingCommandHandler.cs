using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaPosOutletMapping
{
    /// <summary>Removes an outlet mapping (the unique index on source + code includes inactive rows, so the row is deleted).</summary>
    public class DeleteSilaPosOutletMappingCommandHandler : IRequestHandler<DeleteSilaPosOutletMappingCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaPosOutletMappingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeleteSilaPosOutletMappingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting POS outlet mapping. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}, MappingId: {request.MappingId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            PosOutletMapping? mapping = await _repository.PosOutletMapping.FindFirstByConditionAsync(
                x => x.Id == request.MappingId && x.PosSourceId == source.Id);
            if (mapping == null)
            {
                _logger.LogError($"POS outlet mapping not found. MappingId: {request.MappingId}, SourceId: {source.Id}");
                throw new NotFoundCustomException("Outlet mapping not found.", "Select an outlet mapping of this POS source.");
            }

            _repository.PosOutletMapping.Delete(mapping);
            await _repository.SaveAsync();

            _logger.LogInfo($"POS outlet mapping deleted. MappingId: {mapping.Id}, Code: {mapping.PosOutletCode}");
            return Unit.Value;
        }
    }
}
