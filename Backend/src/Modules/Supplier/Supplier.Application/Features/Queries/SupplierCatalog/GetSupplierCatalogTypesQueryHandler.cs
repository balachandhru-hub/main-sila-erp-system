using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Queries.SupplierCatalog
{
    public class GetSupplierCatalogTypesQueryHandler
        : IRequestHandler<GetSupplierCatalogTypesQuery, List<string>>
    {
        private const int DefaultLimit = 10;
        private const int MaxLimit = 200;

        private readonly IRepositoryWrapper _repository;

        public GetSupplierCatalogTypesQueryHandler(
            IRepositoryWrapper repository)
        {
            _repository = repository;
        }

        public async Task<List<string>> Handle(
            GetSupplierCatalogTypesQuery request,
            CancellationToken cancellationToken)
        {
            var supplier = await _repository.SupplierBusinessProfile
                .FindFirstByConditionAsync(x =>
                    x.OrganizationId == request.OrganizationId &&
                    x.IsActive);

            if (supplier == null)
                throw new NotFoundCustomException(
                    "Supplier profile not found.",
                    "Supplier profile not found.");

            var types = _repository.SupplierCatalog
                .FindByCondition(x =>
                    x.SupplierId == supplier.Id &&
                    x.IsActive &&
                    x.Type != null &&
                    x.Type != "");

            if (!string.IsNullOrWhiteSpace(request.SearchTerm))
            {
                string searchTerm = request.SearchTerm.Trim();
                types = types.Where(x => x.Type.Contains(searchTerm));
            }

            int index = Math.Max(0, request.Index);
            int limit = request.Limit <= 0 ? DefaultLimit : Math.Min(request.Limit, MaxLimit);

            return await types
                .Select(x => x.Type)
                .Distinct()
                .OrderBy(x => x)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }
    }
}
