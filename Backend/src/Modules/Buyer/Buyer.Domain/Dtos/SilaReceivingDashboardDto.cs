namespace Buyer.Domain.Dtos
{
    public class SilaReceivingDashboardDto
    {
        public SilaReceivingDashboardKpisDto Kpis { get; set; } = new();
        public SilaReceivingAgingDto Aging { get; set; } = new();
        public List<SilaReceivingDashboardLocationDto> Locations { get; set; } = new();
        public List<SilaReceivingTaskDto> Tasks { get; set; } = new();
        public List<SilaReceivingWorkbenchRowDto> Workbench { get; set; } = new();
        public List<SilaReceivingExceptionDto> Exceptions { get; set; } = new();
        public List<SilaReceivingActivityDto> Activity { get; set; } = new();
        public SilaReceivingTeamDto Team { get; set; } = new();
    }

    public class SilaReceivingDashboardKpisDto
    {
        public int ExpectedToday { get; set; }
        public int PendingReceipt { get; set; }
        public int PartiallyReceived { get; set; }
        public int ReceivedToday { get; set; }
        public int Overdue { get; set; }
        public int GrnPostingFailed { get; set; }
        public int ReversalsToday { get; set; }
        public int AttentionRequired { get; set; }
    }

    public class SilaReceivingAgingDto
    {
        public int PendingUnderOneDay { get; set; }
        public int PendingOneToTwoDays { get; set; }
        public int PendingThreePlusDays { get; set; }
        public int Overdue { get; set; }
        public int OpenPartials { get; set; }
        public int UnresolvedGrnFailures { get; set; }
    }

    public class SilaReceivingDashboardLocationDto
    {
        public Guid Id { get; set; }
        public string LocationName { get; set; } = string.Empty;
        public string? PropertyName { get; set; }
        public string? PlantCode { get; set; }
        public string? StorageLocationCode { get; set; }
    }

    public class SilaReceivingTaskDto
    {
        public string Priority { get; set; } = string.Empty;
        public string Type { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string? PoNumber { get; set; }
        public string? GrnNumber { get; set; }
        public string? SupplierName { get; set; }
        public string? LocationName { get; set; }
        public DateTime? ExpectedDate { get; set; }
        public string? Age { get; set; }
        public string? Status { get; set; }
        public string Action { get; set; } = string.Empty;
        public Guid? PurchaseOrderId { get; set; }
        public Guid? GoodsReceiptId { get; set; }
        public int? OpenLineCount { get; set; }
    }

    public class SilaReceivingWorkbenchRowDto
    {
        public Guid PurchaseOrderId { get; set; }
        public string PoNumber { get; set; } = string.Empty;
        public string? SupplierName { get; set; }
        public DateTime? ExpectedDate { get; set; }
        public string? PropertyName { get; set; }
        public string? PlantCode { get; set; }
        public string? StorageLocation { get; set; }
        public int LineCount { get; set; }
        public int OpenLineCount { get; set; }
        public decimal OrderedQty { get; set; }
        public decimal ReceivedQty { get; set; }
        public decimal OpenQty { get; set; }
        public string ReceiptStatus { get; set; } = string.Empty;
        public string? LatestGrnNumber { get; set; }
        public Guid? LatestGoodsReceiptId { get; set; }
        public string? ErpStatus { get; set; }
        public string? SupplierSoNumber { get; set; }
        public DateTime? LastActivity { get; set; }
        public string Action { get; set; } = string.Empty;
    }

    public class SilaReceivingExceptionDto
    {
        public string Severity { get; set; } = string.Empty;
        public string Exception { get; set; } = string.Empty;
        public string Document { get; set; } = string.Empty;
        public string? SupplierName { get; set; }
        public string? LocationName { get; set; }
        public string? Age { get; set; }
        public string? Status { get; set; }
        public string Action { get; set; } = string.Empty;
        public Guid? PurchaseOrderId { get; set; }
        public Guid? GoodsReceiptId { get; set; }
        public string? Message { get; set; }
    }

    public class SilaReceivingActivityDto
    {
        public DateTime OccurredOn { get; set; }
        public string Document { get; set; } = string.Empty;
        public string Action { get; set; } = string.Empty;
        public string? Status { get; set; }
        public Guid? PurchaseOrderId { get; set; }
        public Guid? GoodsReceiptId { get; set; }
    }

    public class SilaReceivingTeamDto
    {
        public int ReceiptsCompleted { get; set; }
        public int GrnsPosted { get; set; }
        public int PartialReceipts { get; set; }
        public int Reversals { get; set; }
        public int Failures { get; set; }
    }
}
