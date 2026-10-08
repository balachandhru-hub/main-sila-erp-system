using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaPosSource
{
    /// <summary>
    /// Deactivates a POS source and removes its mappings. The default source can only be removed when it is the last one.
    /// Batches already received keep their source id; their lines then match by the code rules only.
    /// </summary>
    public class DeleteSilaPosSourceCommandHandler : IRequestHandler<DeleteSilaPosSourceCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaPosSourceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeleteSilaPosSourceCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting POS source. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSource source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId);
            bool others = await _repository.PosSource
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Id != source.Id)
                .AnyAsync(cancellationToken);
            if (source.IsDefault && others)
            {
                _logger.LogError($"POS default source cannot be deleted. SourceId: {source.Id}");
                throw new BadRequestCustomException("The default POS source cannot be deleted.", "Make another POS source the default first.");
            }

            source.IsActive = false;
            source.IsDefault = false;
            List<PosOutletMapping> outlets = await _repository.PosOutletMapping
                .FindByCondition(x => x.PosSourceId == source.Id)
                .ToListAsync(cancellationToken);
            List<PosItemMapping> items = await _repository.PosItemMapping
                .FindByCondition(x => x.PosSourceId == source.Id)
                .ToListAsync(cancellationToken);

            // The unique indexes (source, code) include inactive rows, so mappings are removed rather than deactivated.
            _repository.PosOutletMapping.DeleteRange(outlets);
            _repository.PosItemMapping.DeleteRange(items);
            await _repository.SaveAsync();

            _logger.LogInfo($"POS source deleted. SourceId: {source.Id}, OutletMappings: {outlets.Count}, ItemMappings: {items.Count}");
            return Unit.Value;
        }
    }
}
