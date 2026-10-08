using Buyer.Application.Features.Shared;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.DeleteSilaRecipeMaster
{
    /// <summary>Deactivates a recipe family or category. One that active recipes still use is a 409 naming how many.</summary>
    public class DeleteSilaRecipeMasterCommandHandler : IRequestHandler<DeleteSilaRecipeMasterCommand, Unit>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public DeleteSilaRecipeMasterCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Unit> Handle(DeleteSilaRecipeMasterCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Deleting recipe master. Kind: {request.Kind}, Id: {request.Id}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            string kind = SilaRecipeMasterRules.ParseKind(_logger, request.Kind);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            Dictionary<Guid, int> counts = await SilaRecipeMasterRules.RecipeCountsAsync(_repository, buyer.Id, kind, cancellationToken);
            int used = counts.GetValueOrDefault(request.Id);
            if (used > 0)
            {
                _logger.LogError($"Recipe master is in use. Kind: {kind}, Id: {request.Id}, Recipes: {used}");
                throw new ConflictCustomException(
                    $"The {SilaRecipeMasterRules.Label(kind)} is in use.",
                    $"{used} active recipe(s) use it. Move them to another {SilaRecipeMasterRules.Label(kind)} or deactivate them first.");
            }

            await SilaRecipeMasterRules.UpdateAsync(_repository, _logger, buyer.Id, kind, request.Id, null);
            await _repository.SaveAsync();

            _logger.LogInfo($"Recipe master deleted. Kind: {kind}, Id: {request.Id}");
            return Unit.Value;
        }
    }
}
