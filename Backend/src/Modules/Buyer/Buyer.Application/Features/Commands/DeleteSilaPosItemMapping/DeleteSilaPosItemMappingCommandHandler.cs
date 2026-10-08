using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaPosItemMapping
{
    /// <summary>Removes an item mapping (the unique index on source + code includes inactive rows, so the row is deleted).</summary>
    public class DeleteSilaPosItemMappingCommandHandler : IRequestHandler<DeleteSilaPosItemMappingCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaPosItemMappingCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeleteSilaPosItemMappingCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting POS item mapping. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}, MappingId: {request.MappingId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            PosItemMapping? mapping = await _repository.PosItemMapping.FindFirstByConditionAsync(
                x => x.Id == request.MappingId && x.PosSourceId == source.Id);
            if (mapping == null)
            {
                _logger.LogError($"POS item mapping not found. MappingId: {request.MappingId}, SourceId: {source.Id}");
                throw new NotFoundCustomException("Item mapping not found.", "Select an item mapping of this POS source.");
            }

            _repository.PosItemMapping.Delete(mapping);
            await _repository.SaveAsync();

            _logger.LogInfo($"POS item mapping deleted. MappingId: {mapping.Id}, Code: {mapping.PosItemCode}");
            return Unit.Value;
        }
    }
}
