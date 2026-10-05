using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InvoiceExtractionRepository : RepositoryBase<InvoiceExtraction>, IInvoiceExtractionRepository
    {
        public InvoiceExtractionRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
