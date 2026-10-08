using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Commands.SaveSilaRecipeMaster
{
    /// <summary>
    /// Creates or edits a recipe family or category. The code is unique per buyer; creating the code of a deleted record
    /// restores it. Renaming a category also renames it on the recipes that use it.
    /// </summary>
    public class SaveSilaRecipeMasterCommandHandler : IRequestHandler<SaveSilaRecipeMasterCommand, Guid>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public SaveSilaRecipeMasterCommandHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<Guid> Handle(SaveSilaRecipeMasterCommand request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Saving recipe master. Kind: {request.Kind}, Id: {request.Id}, OrganizationId: {request.OrganizationId}, UserId: {request.UserId}");

            string kind = SilaRecipeMasterRules.ParseKind(_logger, request.Kind);
            SilaRecipeMasterWriteDto record = SilaRecipeMasterRules.Normalize(request.Request);
            List<string> errors = SilaRecipeMasterRules.Errors(record);
            if (errors.Count > 0)
            {
                _logger.LogError($"Recipe master is invalid. Kind: {kind}, Errors: {errors.Count}");
                throw new BadRequestCustomException($"The {SilaRecipeMasterRules.Label(kind)} is invalid.", string.Join(" ", errors));
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<(SilaRecipeMasterDto Record, bool IsActive)> all = await SilaRecipeMasterRules.LoadAllAsync(_repository, buyer.Id, kind, cancellationToken);
            List<(SilaRecipeMasterDto Record, bool IsActive)> sameCode = all
                .Where(x => string.Equals(x.Record.Code, record.Code, StringComparison.OrdinalIgnoreCase) && x.Record.Id != request.Id)
                .ToList();
            // A new record may reuse the code of a deleted one (it is restored); an edit may not take any other record's code.
            bool codeTaken = sameCode.Any(x => x.IsActive || request.Id != null);
            if (codeTaken)
            {
                _logger.LogError($"Recipe master code exists. Kind: {kind}, Code: {record.Code}");
                throw new ConflictCustomException(
                    "Code is already used.",
                    sameCode.Any(x => x.IsActive)
                        ? $"Another {SilaRecipeMasterRules.Label(kind)} has code {record.Code}. Use a different code."
                        : $"A deleted {SilaRecipeMasterRules.Label(kind)} has code {record.Code}. Create a new record with that code to restore it, or use a different code.");
            }

            Guid id;
            if (request.Id == null)
            {
                id = await SilaRecipeMasterRules.CreateAsync(_repository, buyer.Id, kind, record);
            }
            else
            {
                id = request.Id.Value;
                await SilaRecipeMasterRules.UpdateAsync(_repository, _logger, buyer.Id, kind, id, record);
            }

            if (kind == SilaRecipeMasterRules.KIND_CATEGORIES)
            {
                await SilaRecipeMasterRules.RenameCategoryOnRecipesAsync(_repository, buyer.Id, id, record.Name, cancellationToken);
            }

            await _repository.SaveAsync();
            _logger.LogInfo($"Recipe master saved. Kind: {kind}, Id: {id}, Code: {record.Code}");
            return id;
        }
    }
}
