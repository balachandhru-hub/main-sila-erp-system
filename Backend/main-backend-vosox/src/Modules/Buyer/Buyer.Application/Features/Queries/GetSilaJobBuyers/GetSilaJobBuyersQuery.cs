using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaJobBuyers
{
    /// <summary>
    /// The buyers (BuyerBusinessProfile ids) a SILA ME scheduler job has work for, so the job can run one buyer at a time
    /// in its own scope. Job is one of the JOB_* constants.
    /// </summary>
    public class GetSilaJobBuyersQuery : IRequest<List<Guid>>
    {
        public const string JOB_LOW_STOCK = "LOW_STOCK";
        public const string JOB_ERP_POSTING = "ERP_POSTING";
        public const string JOB_PHYSICAL_INVENTORY = "PHYSICAL_INVENTORY";
        public const string JOB_SUBSTITUTION = "SUBSTITUTION";

        public string Job { get; set; } = string.Empty;
    }
}
