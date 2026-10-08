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
        /// <summary>Buyers with an approved weekly bucket: its purchase orders are created at the weekend.</summary>
        public const string JOB_WEEKLY_BUCKET = "WEEKLY_BUCKET";
        /// <summary>Buyers with a weekly bucket that is still open: the store manager is reminded to freeze it.</summary>
        public const string JOB_WEEKLY_BUCKET_REMINDER = "WEEKLY_BUCKET_REMINDER";

        public string Job { get; set; } = string.Empty;
    }
}
