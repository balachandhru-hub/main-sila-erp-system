using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaSubstitutions
{
    /// <summary>One page of recipe change suggestions of the properties the user works in, newest first.</summary>
    public class GetSilaSubstitutionsQueryHandler : IRequestHandler<GetSilaSubstitutionsQuery, SilaSubstitutionPageDto>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaSubstitutionsQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaSubstitutionPageDto> Handle(GetSilaSubstitutionsQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching substitution proposals. OrganizationId: {request.OrganizationId}, Status: {request.Status}, Index: {request.Index}, Limit: {request.Limit}");

            if (request.Index < 0 || request.Limit < 1 || request.Limit > MAX_LIMIT)
            {
                _logger.LogError($"Substitution paging is invalid. Index: {request.Index}, Limit: {request.Limit}");
                throw new BadRequestCustomException("Paging is invalid.", $"Use an index of 0 or more and a limit between 1 and {MAX_LIMIT}.");
            }

            string? status = string.IsNullOrWhiteSpace(request.Status) ? null : request.Status.Trim().ToUpperInvariant();
            if (status != null && status != Common.SILA_PROPOSAL_PROPOSED && status != Common.SILA_PROPOSAL_ACCEPTED && status != Common.SILA_PROPOSAL_DISMISSED)
            {
                _logger.LogError($"Substitution status filter is invalid. Status: {request.Status}");
                throw new BadRequestCustomException("Status is invalid.", "Filter by PROPOSED, ACCEPTED or DISMISSED.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            List<Guid>? visible = await SilaSubstitutionRules.GetVisibleLocationIdsAsync(_repository, buyer.Id, request.UserId, request.RoleId, cancellationToken);
            IQueryable<RecipeSubstitutionProposal> query = _repository.RecipeSubstitutionProposal.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (visible != null)
            {
                query = query.Where(x => x.LocationId != null && visible.Contains(x.LocationId.Value));
            }

            if (status != null)
            {
                query = query.Where(x => x.Status == status);
            }

            int total = await query.CountAsync(cancellationToken);
            List<RecipeSubstitutionProposal> proposals = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.ProposalNumber)
                .Skip(request.Index * request.Limit)
                .Take(request.Limit)
                .ToListAsync(cancellationToken);
            List<SilaSubstitutionListItemDto> items = await SilaSubstitutionRules.ToListItemsAsync(_repository, buyer.Id, proposals, cancellationToken);

            _logger.LogInfo($"Substitution proposals fetched. Count: {items.Count}, Total: {total}");
            return new SilaSubstitutionPageDto { Items = items, Total = total, Index = request.Index, Limit = request.Limit };
        }
    }
}
