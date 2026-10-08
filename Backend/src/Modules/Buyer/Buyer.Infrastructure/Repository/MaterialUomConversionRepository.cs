using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class MaterialUomConversionRepository : RepositoryBase<MaterialUomConversion>, IMaterialUomConversionRepository
    {
        public MaterialUomConversionRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
