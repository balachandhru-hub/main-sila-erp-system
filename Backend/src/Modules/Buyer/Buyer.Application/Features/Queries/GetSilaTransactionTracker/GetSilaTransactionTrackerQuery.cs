using Buyer.Domain.Dtos;
using MediatR;

namespace Buyer.Application.Features.Queries.GetSilaTransactionTracker
{
    public class GetSilaTransactionTrackerQuery : IRequest<SilaTrackerPageDto>
    {
        public Guid OrganizationId { get; set; }
        public string Tracker { get; set; } = string.Empty;
        public string? TransactionType { get; set; }
        public string? Direction { get; set; }
        public DateTime? From { get; set; }
        public DateTime? To { get; set; }
        public string? CompanyCode { get; set; }
        public string? Status { get; set; }
        public Guid? UserId { get; set; }
        public Guid? PropertyId { get; set; }
        public string? Plant { get; set; }
        public string? StorageLocation { get; set; }
        public string? SourceSystem { get; set; }
        public string? TargetSystem { get; set; }
        public string? DataClass { get; set; }
        public string? Search { get; set; }
        public string? Material { get; set; }
        public string? Integration { get; set; }
        public string? Stage { get; set; }
        public int Index { get; set; }
        public int Limit { get; set; } = 25;
    }

    public class GetSilaTransactionTrackerDetailQuery : IRequest<SilaTrackerDetailDto>
    {
        public Guid OrganizationId { get; set; }
        public string Tracker { get; set; } = string.Empty;
        public string Id { get; set; } = string.Empty;
    }
}
