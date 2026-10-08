using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class SilaDocumentSequenceRepository : RepositoryBase<SilaDocumentSequence>, ISilaDocumentSequenceRepository
    {
        public SilaDocumentSequenceRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
