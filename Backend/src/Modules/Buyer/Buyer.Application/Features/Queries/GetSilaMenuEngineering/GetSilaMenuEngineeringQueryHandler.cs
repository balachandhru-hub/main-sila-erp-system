using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using MediatR;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaMenuEngineering
{
    public class GetSilaMenuEngineeringQueryHandler : IRequestHandler<GetSilaMenuEngineeringQuery, SilaMenuEngineeringEnvelopeDto>
    {
        private readonly Buyer.Infrastructure.Contracts.IRepository.IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaMenuEngineeringQueryHandler(Buyer.Infrastructure.Contracts.IRepository.IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public Task<SilaMenuEngineeringEnvelopeDto> Handle(GetSilaMenuEngineeringQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Loading Menu Engineering. View: {request.View}, OrganizationId: {request.OrganizationId}");
            return SilaMenuEngineering.LoadAsync(_repository, _logger, request.OrganizationId, request.UserId, request.RoleId, request.View, request.Filter, request.Simulation, cancellationToken);
        }
    }
}
