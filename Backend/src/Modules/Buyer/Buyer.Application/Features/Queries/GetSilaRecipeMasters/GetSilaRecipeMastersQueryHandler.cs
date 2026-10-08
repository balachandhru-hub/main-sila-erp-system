using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaRecipeMasters
{
    /// <summary>One page of the active families or categories, by code, with the number of active recipes using each.</summary>
    public class GetSilaRecipeMastersQueryHandler : IRequestHandler<GetSilaRecipeMastersQuery, List<SilaRecipeMasterDto>>
    {
        private const int MAX_LIMIT = 200;
        private const string STATUS_ACTIVE = "ACTIVE";
        private const string STATUS_INACTIVE = "INACTIVE";
        private const string STATUS_ALL = "ALL";

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaRecipeMastersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaRecipeMasterDto>> Handle(GetSilaRecipeMastersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching recipe masters. Kind: {request.Kind}, OrganizationId: {request.OrganizationId}, Index: {request.Index}, Limit: {request.Limit}");

            string kind = SilaRecipeMasterRules.ParseKind(_logger, request.Kind);
            if (request.Index < 0 || request.Limit < 1 || request.Limit > MAX_LIMIT)
            {
                _logger.LogError($"Recipe master paging is invalid. Index: {request.Index}, Limit: {request.Limit}");
                throw new BadRequestCustomException("Paging is invalid.", $"Use an index of 0 or more and a limit between 1 and {MAX_LIMIT}.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<(SilaRecipeMasterDto Record, bool IsActive)> all = await SilaRecipeMasterRules.LoadAllAsync(_repository, buyer.Id, kind, cancellationToken);
            Dictionary<Guid, int> counts = await SilaRecipeMasterRules.RecipeCountsAsync(_repository, buyer.Id, kind, cancellationToken);
            string search = (request.Search ?? string.Empty).Trim();
            string status = string.IsNullOrWhiteSpace(request.Status)
                ? STATUS_ACTIVE
                : SilaInputRules.OneOf(_logger, request.Status, new[] { STATUS_ACTIVE, STATUS_INACTIVE, STATUS_ALL }, "status");
            foreach ((SilaRecipeMasterDto record, bool isActive) in all)
            {
                record.Status = isActive ? STATUS_ACTIVE : STATUS_INACTIVE;
            }

            List<SilaRecipeMasterDto> result = all
                .Where(x => status == STATUS_ALL || (status == STATUS_ACTIVE) == x.IsActive)
                .Select(x => x.Record)
                .Where(x => search.Length == 0
                    || x.Code.Contains(search, StringComparison.OrdinalIgnoreCase)
                    || x.Name.Contains(search, StringComparison.OrdinalIgnoreCase))
                .OrderBy(x => x.Code)
                .Skip(request.Index * request.Limit)
                .Take(request.Limit)
                .ToList();
            foreach (SilaRecipeMasterDto record in result)
            {
                record.RecipeCount = counts.GetValueOrDefault(record.Id);
            }

            _logger.LogInfo($"Recipe masters fetched. Kind: {kind}, Count: {result.Count}");
            return result;
        }
    }
}
