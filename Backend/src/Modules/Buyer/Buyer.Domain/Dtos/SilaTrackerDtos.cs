using System.Text.Json.Serialization;

namespace Buyer.Domain.Dtos
{
    public class SilaTrackerPageDto
    {
        public int Total { get; set; }
        public SilaTrackerSummaryDto Summary { get; set; } = new SilaTrackerSummaryDto();
        public List<SilaTrackerRowDto> Rows { get; set; } = new List<SilaTrackerRowDto>();
    }

    public class SilaTrackerSummaryDto
    {
        public int Total { get; set; }
        public int Processing { get; set; }
        public int Successful { get; set; }
        public int Failed { get; set; }
        public int Reprocessing { get; set; }
        public int NeedsAttention { get; set; }
    }

    public class SilaTrackerRowDto
    {
        public string Id { get; set; } = string.Empty;
        public string Source { get; set; } = string.Empty;
        public DateTime OccurredOn { get; set; }
        public DateTime? BusinessDate { get; set; }
        public string TransactionType { get; set; } = string.Empty;
        public string DataClass { get; set; } = string.Empty;
        public string Direction { get; set; } = string.Empty;
        public string? CompanyCode { get; set; }
        public string? PropertyName { get; set; }
        public string? Plant { get; set; }
        public string? StorageLocation { get; set; }
        public string? SourceSystem { get; set; }
        public string? TargetSystem { get; set; }
        public string? BusinessReference { get; set; }
        public Guid? UserId { get; set; }
        public string ReceiveStatus { get; set; } = string.Empty;
        public string ErpStatus { get; set; } = string.Empty;
        public string LocalStatus { get; set; } = string.Empty;
        public string OverallStatus { get; set; } = string.Empty;
        public int RetryCount { get; set; }
        public string? LastError { get; set; }
        public string? ErpReference { get; set; }
        public int? ErpHttpStatus { get; set; }
        public string? IntegrationName { get; set; }
        public string Action { get; set; } = string.Empty;
        public string? ReprocessFrom { get; set; }
        public bool ErpCallAllowed { get; set; }

        // Recipe tracker fields kept on the SILA ME sale row.
        public string? PosCode { get; set; }
        public string? OutletCode { get; set; }
        public decimal? Quantity { get; set; }
        public string? Uom { get; set; }
        public int? RecipeVersion { get; set; }
        public string? MovementType { get; set; }
        public Guid? ErpPostingId { get; set; }
    }

    public class SilaTrackerDetailDto : SilaTrackerRowDto
    {
        public string? TechnicalDetail { get; set; }
        public string? ErpMessage { get; set; }
        public string? LocalError { get; set; }
        public string? LocalReference { get; set; }
        public Guid? RecipeId { get; set; }
        public List<SilaTrackerAttemptDto> Attempts { get; set; } = new List<SilaTrackerAttemptDto>();
    }

    public class SilaTrackerAttemptDto
    {
        public Guid Id { get; set; }
        public DateTime At { get; set; }
        public Guid? UserId { get; set; }
        public string? Stage { get; set; }
        public string? Result { get; set; }
        public string? PreviousError { get; set; }
        public bool ErpCalled { get; set; }
        public bool LocalCalled { get; set; }
    }

    public class SilaTrackerReprocessRequestDto
    {
        [JsonPropertyName("ids")]
        public List<string> Ids { get; set; } = new List<string>();
    }

    public class SilaTrackerReprocessResultDto
    {
        public int Eligible { get; set; }
        public int Ineligible { get; set; }
        public int Completed { get; set; }
        public int Failed { get; set; }
        public List<string> Messages { get; set; } = new List<string>();
    }
}
