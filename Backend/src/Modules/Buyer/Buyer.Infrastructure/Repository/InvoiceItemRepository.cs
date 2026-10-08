using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using Buyer.Infrastructure.DbContext;

namespace Buyer.Infrastructure.Repository
{
    public class InvoiceItemRepository : RepositoryBase<InvoiceItem>, IInvoiceItemRepository
    {
        public InvoiceItemRepository(RepositoryContext repositoryContext) : base(repositoryContext)
        {
        }
    }
}
