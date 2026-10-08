using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaCompanyCodes
{
    public class GetSilaCompanyCodesQueryHandler : IRequestHandler<GetSilaCompanyCodesQuery, List<SilaCompanyCodeDto>>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaCompanyCodesQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaCompanyCodeDto>> Handle(GetSilaCompanyCodesQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching company codes. OrganizationId: {request.OrganizationId}, Search: {request.Search}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, MAX_LIMIT);
            SilaInputRules.MaxLength(_logger, request.Search, SilaInputRules.NAME_LENGTH, "Search");

            IQueryable<CompanyCodeMaster> query = _repository.CompanyCodeMaster.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.Code.Contains(search) || x.Name.Contains(search));
            }

            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = SilaInputRules.OneOf(_logger, request.Status, SilaMasterDataRules.CompanyCodeStatuses, "status");
                query = status == SilaMasterDataRules.STATUS_ACTIVE
                    ? query.Where(x => x.Status == null || x.Status == SilaMasterDataRules.STATUS_ACTIVE)
                    : query.Where(x => x.Status == status);
            }

            List<CompanyCodeMaster> companyCodes = await query
                .OrderBy(x => x.Code)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Company codes fetched. Count: {companyCodes.Count}, BuyerId: {buyer.Id}");
            return companyCodes.Select(SilaMasterDataRules.ToDto).ToList();
        }
    }
}
