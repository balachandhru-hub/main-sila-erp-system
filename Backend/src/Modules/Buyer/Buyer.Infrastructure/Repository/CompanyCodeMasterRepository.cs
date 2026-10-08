using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class CompanyCodeMasterRepository : RepositoryBase<CompanyCodeMaster>, ICompanyCodeMasterRepository
    {
        public CompanyCodeMasterRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
