using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using Supplier.Infrastructure.Contracts.IRepository;

namespace Supplier.Application.Features.Queries.SupplierCatalog
{
    public class GetSupplierCatalogSubTypesQueryHandler
        : IRequestHandler<GetSupplierCatalogSubTypesQuery, List<string>>
    {
        private const int DefaultLimit = 10;
        private const int MaxLimit = 200;

        private readonly IRepositoryWrapper _repository;

        public GetSupplierCatalogSubTypesQueryHandler(
            IRepositoryWrapper repository)
        {
            _repository = repository;
        }

        public async Task<List<string>> Handle(
            GetSupplierCatalogSubTypesQuery request,
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

            var subTypes = _repository.SupplierCatalog
                .FindByCondition(x =>
                    x.SupplierId == supplier.Id &&
                    x.IsActive &&
                    x.SubType != null &&
                    x.SubType != "");

            if (!string.IsNullOrWhiteSpace(request.SearchTerm))
            {
                string type = request.SearchTerm.Trim();
                subTypes = subTypes.Where(x => x.Type == type);
            }

            int index = Math.Max(0, request.Index);
            int limit = request.Limit <= 0 ? DefaultLimit : Math.Min(request.Limit, MaxLimit);

            return await subTypes
                .Select(x => x.SubType)
                .Distinct()
                .OrderBy(x => x)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);
        }
    }
}
