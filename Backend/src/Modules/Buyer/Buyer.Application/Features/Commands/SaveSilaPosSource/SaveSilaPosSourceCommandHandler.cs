using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SaveSilaPosSource
{
    /// <summary>
    /// Creates or updates a POS source. Exactly one source is the default: making a source the default clears the flag on the
    /// others, the first source is always the default, and the default cannot be switched off directly (make another source the default).
    /// </summary>
    public class SaveSilaPosSourceCommandHandler : IRequestHandler<SaveSilaPosSourceCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveSilaPosSourceCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(SaveSilaPosSourceCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving POS source. OrganizationId: {request.OrganizationId}, UserId: {request.UserId}, SourceId: {request.SourceId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaPosSources.Validate(_logger, request.Request);
            string name = request.Request.Name;
            List<PosSource> others = await _repository.PosSource
                .FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive && x.Id != request.SourceId)
                .ToListAsync(cancellationToken);
            if (others.Any(x => string.Equals(x.Name.Trim(), name, StringComparison.OrdinalIgnoreCase)))
            {
                _logger.LogError($"POS source name already used. Name: {name}, BuyerId: {buyer.Id}");
                throw new ConflictCustomException("A POS source with this name exists.", "Choose another name for the POS source.");
            }

            PosSource source;
            if (request.SourceId == null)
            {
                source = new PosSource { Id = Guid.NewGuid(), BuyerId = buyer.Id, IsActive = true };
                _repository.PosSource.Create(source);
            }
            else
            {
                source = await SilaPosSources.GetSourceAsync(_repository, _logger, buyer.Id, request.SourceId.Value);
                if (source.IsDefault && !request.Request.IsDefault && others.Count > 0)
                {
                    _logger.LogError($"POS default source cannot be switched off directly. SourceId: {source.Id}");
                    throw new BadRequestCustomException("This is the default POS source.", "Make another POS source the default instead.");
                }
            }

            source.Name = name;
            source.PosSystem = request.Request.PosSystem;
            source.IntegrationKind = request.Request.IntegrationKind;
            source.IsDefault = request.Request.IsDefault || others.Count == 0;
            if (source.IsDefault)
            {
                foreach (PosSource other in others.Where(x => x.IsDefault))
                {
                    other.IsDefault = false;
                    _repository.PosSource.Update(other);
                }
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"POS source saved. SourceId: {source.Id}, IsDefault: {source.IsDefault}");
            return source.Id;
        }
    }
}
