using MediatR;
using SharedKernel.Integration.Dtos;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Rules;
using SharedKernel.Integration.Services;
using SharedKernel.LoggerServices;
using Buyer.Application.Features.Shared;
using Buyer.Infrastructure.Contracts.IRepository;

namespace Buyer.Application.Features.Commands.TestIntegration
{
    public class TestIntegrationCommandHandler : IRequestHandler<TestIntegrationCommand, IntegrationTestResponseDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIntegrationHttpExecutor _executor;

        public TestIntegrationCommandHandler(
            IRepositoryWrapper repository,
            ILoggerManager logger,
            IIntegrationHttpExecutor executor)
        {
            _repository = repository;
            _logger = logger;
            _executor = executor;
        }

        public async Task<IntegrationTestResponseDto> Handle(TestIntegrationCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Testing integration. ConfigurationId: {request.ConfigurationId}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");
            ApiIntegrationConfiguration configuration = await IntegrationLookup.GetTrackedAsync(_repository, _logger, request.ConfigurationId, request.OrganizationId);
            ApiIntegrationExecution execution = IntegrationTestRules.NewExecution(configuration);
            _repository.ApiIntegrationExecution.Create(execution);
            IntegrationTestResponseDto result = await IntegrationTestRules.RunAsync(_executor, configuration, execution, cancellationToken);
            await _repository.SaveAsync();
            if (result.Success)
            {
                _logger.LogInfo($"Integration test succeeded. ConfigurationId: {configuration.Id}, HttpStatus: {result.HttpStatus}");
            }
            else
            {
                _logger.LogError($"Integration test failed. ConfigurationId: {configuration.Id}, Code: {execution.ErrorCode}, HttpStatus: {result.HttpStatus}");
            }

            return result;
        }
    }
}
