using Buyer.Application.Features.Shared;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaSuppliers
{
    public class GetSilaSuppliersQueryHandler : IRequestHandler<GetSilaSuppliersQuery, List<SilaSupplierDto>>
    {
        private const int MAX_LIMIT = 200;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaSuppliersQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<List<SilaSupplierDto>> Handle(GetSilaSuppliersQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching suppliers. OrganizationId: {request.OrganizationId}, Search: {request.Search}, Status: {request.Status}");
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 20 : Math.Min(request.Limit, MAX_LIMIT);

            IQueryable<SilaSupplier> query = _repository.SilaSupplier.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (!string.IsNullOrWhiteSpace(request.Status))
            {
                string status = request.Status.Trim().ToUpperInvariant();
                if (!SilaMasterDataRules.SupplierStatuses.Contains(status))
                {
                    _logger.LogError($"Supplier status filter is invalid. Status: {status}");
                    throw new BadRequestCustomException("Invalid status.", "Filter by ACTIVE, INACTIVE or BLOCKED.");
                }

                query = query.Where(x => x.Status == status);
            }

            if (!string.IsNullOrWhiteSpace(request.Search))
            {
                string search = request.Search.Trim();
                query = query.Where(x => x.SupplierCode.Contains(search)
                    || x.Name.Contains(search)
                    || (x.TaxNumber != null && x.TaxNumber.Contains(search))
                    || (x.Aliases != null && x.Aliases.Contains(search)));
            }

            List<SilaSupplier> suppliers = await query
                .OrderBy(x => x.Name)
                .ThenBy(x => x.SupplierCode)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);

            _logger.LogInfo($"Suppliers fetched. Count: {suppliers.Count}, BuyerId: {buyer.Id}");
            return suppliers.Select(SilaMasterDataRules.ToDto).ToList();
        }
    }
}
