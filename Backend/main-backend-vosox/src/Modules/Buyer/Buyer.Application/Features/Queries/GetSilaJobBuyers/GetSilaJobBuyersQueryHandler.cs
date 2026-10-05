using Buyer.Domain.Common;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaJobBuyers
{
    public class GetSilaJobBuyersQueryHandler : IRequestHandler<GetSilaJobBuyersQuery, List<Guid>>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaJobBuyersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<Guid>> Handle(GetSilaJobBuyersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching buyers for a SILA job. Job: {request.Job}");
            IQueryable<Guid> buyerIds;
            switch (request.Job)
            {
                case GetSilaJobBuyersQuery.JOB_LOW_STOCK:
                    buyerIds = _repository.InventoryLocation
                        .FindByCondition(x => x.IsActive)
                        .Select(x => x.BuyerId);
                    break;
                case GetSilaJobBuyersQuery.JOB_ERP_POSTING:
                    buyerIds = _repository.InventoryErpPosting
                        .FindByCondition(x => x.IsActive && x.Status == Common.SILA_POSTING_PENDING)
                        .Select(x => x.BuyerId);
                    break;
                case GetSilaJobBuyersQuery.JOB_PHYSICAL_INVENTORY:
                    DateTime today = DateTime.UtcNow.Date;
                    buyerIds = _repository.PhysicalInventoryRequest
                        .FindByCondition(x => x.IsActive && x.Status == Common.SILA_PI_SCHEDULED && x.ScheduledDate <= today)
                        .Select(x => x.BuyerId);
                    break;
                case GetSilaJobBuyersQuery.JOB_SUBSTITUTION:
                    buyerIds = _repository.Recipe
                        .FindByCondition(x => x.IsActive && x.ActiveVersion > 0)
                        .Select(x => x.BuyerId)
                        .Union(_repository.RecipeSubstitutionProposal
                            .FindByCondition(x => x.IsActive && x.Status == Common.SILA_PROPOSAL_PROPOSED)
                            .Select(x => x.BuyerId));
                    break;
                default:
                    _logger.LogError($"Unknown SILA job. Job: {request.Job}");
                    throw new BadRequestCustomException("Unknown job.", "Use LOW_STOCK, ERP_POSTING, PHYSICAL_INVENTORY or SUBSTITUTION.");
            }

            List<Guid> result = await buyerIds.Distinct().ToListAsync(cancellationToken);
            _logger.LogInfo($"Buyers for a SILA job fetched. Job: {request.Job}, Count: {result.Count}");
            return result;
        }
    }
}
