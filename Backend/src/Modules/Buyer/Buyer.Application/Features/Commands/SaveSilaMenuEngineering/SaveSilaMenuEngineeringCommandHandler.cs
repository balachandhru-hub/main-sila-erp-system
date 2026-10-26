using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SaveSilaMenuEngineering
{
    public class SaveSilaMenuEngineeringCommandHandler : IRequestHandler<SaveSilaMenuEngineeringCommand, SilaMenuEngineeringEnvelopeDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveSilaMenuEngineeringCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaMenuEngineeringEnvelopeDto> Handle(SaveSilaMenuEngineeringCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving Menu Engineering. Action: {request.Request?.Action}, OrganizationId: {request.OrganizationId}");
            return SilaRetry.RunAsync(_repository, _logger, nameof(SaveSilaMenuEngineeringCommand), () =>
                SilaMenuEngineering.SaveAsync(_repository, _logger, request.OrganizationId, request.UserId, request.RoleId, request.Request, cancellationToken));
        }
    }
}
