using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaTransactionTracker
{
    public class GetSilaTransactionTrackerDetailQueryHandler : IRequestHandler<GetSilaTransactionTrackerDetailQuery, SilaTrackerDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaTransactionTrackerDetailQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaTrackerDetailDto> Handle(GetSilaTransactionTrackerDetailQuery request, CancellationToken cancellationToken)
        {
            if (!SilaTrackerRules.TryParseKey(request.Id, out string source, out Guid id))
            {
                throw new NotFoundCustomException("Transaction not found.", "Select a transaction from the tracker.");
            }

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            SilaTrackerDetailDto? detail = source switch
            {
                SilaTrackerRules.SOURCE_ERP => await ErpAsync(buyer.Id, id, cancellationToken),
                SilaTrackerRules.SOURCE_POS => await PosAsync(buyer.Id, id, cancellationToken),
                SilaTrackerRules.SOURCE_PO => await PurchaseAsync(request.OrganizationId, buyer.Id, id, cancellationToken),
                _ => await RunAsync(request.OrganizationId, buyer.Id, id, cancellationToken)
            };
            if (detail == null)
            {
                throw new NotFoundCustomException("Transaction not found.", "Select a transaction from this tracker.");
            }

            return detail;
        }

        private async Task<SilaTrackerDetailDto?> ErpAsync(Guid buyerId, Guid id, CancellationToken cancellationToken)
        {
            InventoryErpPosting? posting = await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == id && x.BuyerId == buyerId && x.IsActive);
            if (posting == null)
            {
                return null;
            }

            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPosting(posting.Status, posting.Attempts, posting.ErpReference);
            SilaTrackerDetailDto detail = Base(SilaTrackerRules.SOURCE_ERP, posting.Id, posting.DateCreated, SilaTrackerRules.TransactionTypeOfPosting(posting.ReferenceType, posting.MovementType), stages);
            detail.DataClass = SilaTrackerRules.DATA_TRANSACTION;
            detail.Direction = SilaTrackerRules.DIRECTION_OUTBOUND;
            detail.CompanyCode = posting.CompanyCode;
            if (posting.LocationId != null)
            {
                InventoryLocation? location = await _repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == posting.LocationId);
                BuyerProperty? property = location == null ? null : await _repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == location.PropertyId);
                detail.PropertyName = property?.PropertyName;
                detail.Plant = property?.PlantCode;
                detail.StorageLocation = location?.StorageLocationCode;
                detail.CompanyCode ??= property?.CompanyCode;
            }

            detail.SourceSystem = "SILA";
            detail.TargetSystem = posting.IntegrationSystem ?? "SAP";
            detail.BusinessReference = posting.ReferenceNumber;
            detail.LocalReference = posting.ReferenceNumber;
            detail.UserId = posting.CreatedBy == Guid.Empty ? null : posting.CreatedBy;
            detail.RetryCount = posting.Attempts;
            detail.LastError = posting.ErrorMessage;
            detail.LocalError = posting.Status == Common.SILA_POSTING_FAILED_LOCAL ? posting.ErrorMessage : null;
            detail.ErpReference = posting.ErpReference;
            detail.ErpHttpStatus = posting.ErpHttpStatus;
            detail.IntegrationName = posting.IntegrationSystem;
            detail.MovementType = posting.MovementType;
            detail.ErpPostingId = posting.Id;
            detail.TechnicalDetail = SilaErpPayload.Sanitise(posting.ErpRequestPayload);
            detail.ErpMessage = SilaErpPayload.Sanitise(posting.ErpResponsePayload);
            detail.Attempts = await AttemptsAsync(buyerId, posting.ReferenceType, posting.ReferenceId, cancellationToken);
            return detail;
        }

        private async Task<SilaTrackerDetailDto?> PosAsync(Guid buyerId, Guid id, CancellationToken cancellationToken)
        {
            PosSalesTransaction? sale = await _repository.PosSalesTransaction.FindFirstByConditionAsync(x => x.Id == id && x.BuyerId == buyerId && x.IsActive);
            if (sale == null)
            {
                return null;
            }

            InventoryErpPosting? posting = sale.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting.FindFirstByConditionAsync(x => x.Id == sale.ErpPostingId);
            SilaTrackerRules.Stages? postingStages = posting == null ? null : SilaTrackerRules.OfPosting(posting.Status, posting.Attempts, posting.ErpReference);
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPos(sale.Status, sale.FailedStep, postingStages);
            SilaTrackerDetailDto detail = Base(SilaTrackerRules.SOURCE_POS, sale.Id, sale.DateCreated, sale.QuantitySold < 0 ? "POS_POSITIVE_CORRECTION" : "POS_SALE", stages);
            detail.BusinessDate = sale.BusinessDate;
            detail.DataClass = SilaTrackerRules.DATA_TRANSACTION;
            detail.Direction = SilaTrackerRules.DIRECTION_INBOUND;
            detail.CompanyCode = posting?.CompanyCode;
            if (sale.OutletLocationId != null)
            {
                InventoryLocation? location = await _repository.InventoryLocation.FindFirstByConditionAsync(x => x.Id == sale.OutletLocationId);
                BuyerProperty? property = location == null ? null : await _repository.BuyerProperty.FindFirstByConditionAsync(x => x.Id == location.PropertyId);
                detail.PropertyName = property?.PropertyName;
                detail.Plant = property?.PlantCode;
                detail.StorageLocation = location?.StorageLocationCode;
                detail.CompanyCode ??= property?.CompanyCode;
            }

            detail.SourceSystem = "POS";
            detail.TargetSystem = posting?.IntegrationSystem ?? "SILA";
            detail.BusinessReference = sale.SourceTransactionId;
            detail.LocalReference = sale.SourceTransactionId;
            detail.UserId = sale.CreatedBy == Guid.Empty ? null : sale.CreatedBy;
            detail.RetryCount = posting?.Attempts ?? 0;
            detail.LastError = sale.FailureMessage ?? posting?.ErrorMessage;
            detail.LocalError = sale.FailureMessage;
            detail.ErpReference = posting?.ErpReference;
            detail.ErpHttpStatus = posting?.ErpHttpStatus;
            detail.IntegrationName = posting?.IntegrationSystem;
            detail.MovementType = posting?.MovementType;
            detail.ErpPostingId = posting?.Id;
            detail.PosCode = sale.PosCode;
            detail.OutletCode = sale.OutletCode;
            detail.Quantity = sale.QuantitySold;
            detail.Uom = sale.Uom;
            detail.RecipeVersion = sale.RecipeVersion;
            detail.RecipeId = sale.RecipeId;
            detail.TechnicalDetail = SilaErpPayload.Sanitise(posting?.ErpRequestPayload);
            detail.ErpMessage = SilaErpPayload.Sanitise(posting?.ErpResponsePayload);
            detail.Attempts = await AttemptsAsync(buyerId, Common.SILA_REF_POS_SALE, sale.Id, cancellationToken);
            return detail;
        }

        private async Task<SilaTrackerDetailDto?> PurchaseAsync(Guid organizationId, Guid buyerId, Guid id, CancellationToken cancellationToken)
        {
            PurchaseDocumentIntegration? document = await _repository.PurchaseDocumentIntegration
                .FindFirstByConditionAsync(x => x.Id == id && x.BuyerOrganizationId == organizationId && x.IsActive);
            if (document == null)
            {
                return null;
            }

            PurchaseOrder? order = document.PurchaseOrderId == null
                ? null
                : await _repository.PurchaseOrder.FindFirstByConditionAsync(x => x.Id == document.PurchaseOrderId);
            SilaTrackerRules.Stages stages = SilaTrackerRules.OfPurchase(document.Status, document.OutcomeUnknown, document.ExternalDocumentNumber, document.RetryCount);
            SilaTrackerDetailDto detail = Base(SilaTrackerRules.SOURCE_PO, document.Id, document.DateCreated, document.IntegrationType, stages);
            detail.DataClass = SilaTrackerRules.DATA_TRANSACTION;
            detail.Direction = SilaTrackerRules.DIRECTION_OUTBOUND;
            detail.CompanyCode = order?.CompanyCode;
            detail.Plant = order?.PlantCode;
            detail.SourceSystem = "SILA";
            detail.TargetSystem = document.ResolvedErpType ?? "SAP";
            detail.BusinessReference = order?.PoNumber ?? document.ExternalDocumentNumber;
            detail.LocalReference = order?.PoNumber;
            detail.UserId = document.CreatedBy == Guid.Empty ? null : document.CreatedBy;
            detail.RetryCount = document.RetryCount;
            detail.LastError = document.ErrorMessage;
            detail.ErpReference = document.ExternalDocumentNumber;
            detail.IntegrationName = document.IntegrationType;
            detail.ErpMessage = SilaErpPayload.Sanitise(document.ResponseBody);
            detail.Attempts = await AttemptsAsync(buyerId, "PO_INTEGRATION", document.Id, cancellationToken);
            return detail;
        }

        private async Task<SilaTrackerDetailDto?> RunAsync(Guid organizationId, Guid buyerId, Guid id, CancellationToken cancellationToken)
        {
            ApiIntegrationExecution? execution = await _repository.ApiIntegrationExecution.FindFirstByConditionAsync(x => x.Id == id);
            if (execution == null)
            {
                return null;
            }

            ApiIntegrationConfiguration? configuration = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => x.Id == execution.ConfigurationId && IntegrationLookup.BuyerIdsOf(_repository, organizationId).Contains(x.BuyerId))
                .FirstOrDefaultAsync(cancellationToken);
            if (configuration == null)
            {
                return null;
            }

            SilaTrackerRules.Stages stages = SilaTrackerRules.OfRun(execution.Status.ToString(), execution.RecordsRead, execution.RecordsFailed, execution.Trigger.ToString());
            string direction = SilaTrackerRules.DirectionOfProcess(configuration.ProcessType);
            SilaTrackerDetailDto detail = Base(SilaTrackerRules.SOURCE_RUN, execution.Id, execution.StartedAt, configuration.ProcessType, stages);
            detail.DataClass = SilaTrackerRules.DataClassOfProcess(configuration.ProcessType);
            detail.Direction = direction;
            detail.CompanyCode = configuration.EntityCode;
            detail.SourceSystem = direction == SilaTrackerRules.DIRECTION_INBOUND ? configuration.SystemName ?? "SAP" : "SILA";
            detail.TargetSystem = direction == SilaTrackerRules.DIRECTION_INBOUND ? "SILA" : configuration.SystemName ?? "SAP";
            detail.BusinessReference = configuration.Name;
            detail.IntegrationName = configuration.Name;
            detail.UserId = execution.CreatedBy == Guid.Empty ? null : execution.CreatedBy;
            detail.LastError = execution.ErrorMessageSafe;
            detail.ErpMessage = execution.ErrorMessageSafe;
            detail.TechnicalDetail = $"Read {execution.RecordsRead}, created {execution.RecordsCreated}, updated {execution.RecordsUpdated}, failed {execution.RecordsFailed}.";
            detail.Attempts = await AttemptsAsync(buyerId, "INTEGRATION_RUN", execution.Id, cancellationToken);
            return detail;
        }

        private async Task<List<SilaTrackerAttemptDto>> AttemptsAsync(Guid buyerId, string referenceType, Guid? referenceId, CancellationToken cancellationToken)
        {
            if (referenceId == null)
            {
                return new List<SilaTrackerAttemptDto>();
            }

            List<InventoryWorkflowEvent> events = await _repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == buyerId && x.IsActive && x.ReferenceType == referenceType && x.ReferenceId == referenceId
                    && (x.Action == SilaTrackerRules.EVENT_REPROCESS || x.Action == SilaPosProcessing.EVENT_REPROCESS || x.Action == SilaPosProcessing.EVENT_POSTING_REQUEUED))
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            return events.Select(workflow =>
            {
                string comment = workflow.Comment ?? string.Empty;
                return new SilaTrackerAttemptDto
                {
                    Id = workflow.Id,
                    At = workflow.DateCreated,
                    UserId = workflow.ActorUserId == Guid.Empty ? null : workflow.ActorUserId,
                    Stage = Piece(comment, "Stage="),
                    Result = Piece(comment, "Result="),
                    PreviousError = Piece(comment, "Previous="),
                    ErpCalled = comment.Contains("ErpCalled=Yes", StringComparison.OrdinalIgnoreCase),
                    LocalCalled = comment.Contains("LocalCalled=Yes", StringComparison.OrdinalIgnoreCase)
                };
            }).ToList();
        }

        private static SilaTrackerDetailDto Base(string source, Guid id, DateTime occurredOn, string transactionType, SilaTrackerRules.Stages stages)
        {
            return new SilaTrackerDetailDto
            {
                Id = SilaTrackerRules.Key(source, id),
                Source = source,
                OccurredOn = occurredOn,
                TransactionType = transactionType,
                ReceiveStatus = stages.Receive,
                ErpStatus = stages.Erp,
                LocalStatus = stages.Local,
                OverallStatus = stages.Overall,
                Action = stages.Action,
                ReprocessFrom = stages.ReprocessFrom,
                ErpCallAllowed = stages.ErpCallAllowed
            };
        }

        private static string? Piece(string comment, string name)
        {
            int start = comment.IndexOf(name, StringComparison.OrdinalIgnoreCase);
            if (start < 0)
            {
                return null;
            }

            start += name.Length;
            int end = comment.IndexOf(';', start);
            string value = (end < 0 ? comment[start..] : comment[start..end]).Trim();
            return value.Length == 0 ? null : value;
        }
    }
}
