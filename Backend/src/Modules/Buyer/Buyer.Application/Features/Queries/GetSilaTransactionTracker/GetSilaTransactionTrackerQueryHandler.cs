using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.Integration.Entities;
using SharedKernel.Integration.Enums;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaTransactionTracker
{
    /// <summary>
    /// One read model over the purchasing and SILA ME records that already exist. It does not copy them into a new table.
    /// </summary>
    public class GetSilaTransactionTrackerQueryHandler : IRequestHandler<GetSilaTransactionTrackerQuery, SilaTrackerPageDto>
    {
        private const int MAX_INDEX = 5000;
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;

        public GetSilaTransactionTrackerQueryHandler(IRepositoryWrapper repository, ILoggerManager logger)
        {
            _repository = repository;
            _logger = logger;
        }

        public async Task<SilaTrackerPageDto> Handle(GetSilaTransactionTrackerQuery request, CancellationToken cancellationToken)
        {
            string tracker = NormalizeTracker(request.Tracker);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            int index = request.Index < 0 ? 0 : Math.Min(request.Index, MAX_INDEX);
            int limit = SilaInputRules.Limit(request.Limit, 25);
            DateTime from = request.From?.Date ?? (string.IsNullOrWhiteSpace(request.Search) ? DateTime.UtcNow.Date.AddDays(-30) : DateTime.MinValue);
            DateTime to = (request.To?.Date ?? DateTime.UtcNow.Date).AddDays(1);
            string? search = string.IsNullOrWhiteSpace(request.Search) ? null : request.Search.Trim();
            string? material = string.IsNullOrWhiteSpace(request.Material) ? null : request.Material.Trim();
            List<Guid>? locations = await LocationIdsAsync(buyer.Id, request, cancellationToken);
            if (locations != null && locations.Count == 0)
            {
                return new SilaTrackerPageDto();
            }

            List<SilaTrackerRowDto> rows = new List<SilaTrackerRowDto>();
            SilaTrackerSummaryDto summary = new SilaTrackerSummaryDto();
            if (tracker == SilaTrackerRules.TRACKER_SILA_ME)
            {
                await AddErpAsync(rows, summary, buyer.Id, request, from, to, search, material, locations, excludePos: true, cancellationToken);
                await AddPosAsync(rows, summary, buyer.Id, request, from, to, search, material, locations, cancellationToken);
                await AddRunsAsync(rows, summary, request.OrganizationId, SilaTrackerRules.SilaMeProcessTypes, request, from, to, search, locations, cancellationToken);
            }
            else
            {
                await AddPurchasesAsync(rows, summary, request.OrganizationId, request, from, to, search, locations, cancellationToken);
                await AddRunsAsync(rows, summary, request.OrganizationId, SilaTrackerRules.PurchasingProcessTypes, request, from, to, search, locations, cancellationToken);
            }

            List<SilaTrackerRowDto> ordered = rows.OrderByDescending(x => x.OccurredOn).ThenBy(x => x.Id).ToList();
            summary.Total = ordered.Count;
            return new SilaTrackerPageDto
            {
                Total = ordered.Count,
                Summary = summary,
                Rows = ordered.Skip(index).Take(limit).ToList()
            };
        }

        private async Task AddErpAsync(
            List<SilaTrackerRowDto> rows, SilaTrackerSummaryDto summary, Guid buyerId, GetSilaTransactionTrackerQuery request,
            DateTime from, DateTime to, string? search, string? material, List<Guid>? locations, bool excludePos, CancellationToken cancellationToken)
        {
            if (request.Direction == SilaTrackerRules.DIRECTION_INBOUND || request.DataClass == SilaTrackerRules.DATA_MASTER)
            {
                return;
            }

            if (locations == null && (request.PropertyId != null || !string.IsNullOrWhiteSpace(request.Plant) || !string.IsNullOrWhiteSpace(request.StorageLocation)))
            {
                return;
            }

            IQueryable<InventoryErpPosting> query = _repository.InventoryErpPosting.FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                && x.DateCreated >= from && x.DateCreated < to);
            if (excludePos)
            {
                query = query.Where(x => x.ReferenceType != Common.SILA_REF_POS_SALE);
            }

            if (locations != null)
            {
                query = query.Where(x => x.LocationId != null && locations.Contains(x.LocationId.Value));
            }

            if (!string.IsNullOrWhiteSpace(request.CompanyCode))
            {
                string company = request.CompanyCode.Trim();
                query = query.Where(x => x.CompanyCode != null && x.CompanyCode == company);
            }

            if (request.UserId != null)
            {
                query = query.Where(x => x.CreatedBy == request.UserId);
            }

            if (!string.IsNullOrWhiteSpace(request.TransactionType))
            {
                string type = request.TransactionType.Trim();
                query = query.Where(x => x.ReferenceType == type || x.MovementType == type
                    || (type == "INTERNAL_TRANSFER_311" && x.ReferenceType == Common.SILA_REF_ITO && x.MovementType != "301")
                    || (type == "PLANT_TRANSFER_301" && x.ReferenceType == Common.SILA_REF_ITO && x.MovementType == "301")
                    || (type == "PHYSICAL_COUNT_SHORTAGE" && x.ReferenceType == Common.SILA_REF_STOCK_COUNT && x.MovementType == "Z02")
                    || (type == "PHYSICAL_COUNT_SURPLUS" && x.ReferenceType == Common.SILA_REF_STOCK_COUNT && x.MovementType == "Z01")
                    || (type == "NEGATIVE_STOCK_ADJUSTMENT" && x.ReferenceType == Common.SILA_REF_ADJUSTMENT && x.MovementType == "Z02")
                    || (type == "POSITIVE_STOCK_ADJUSTMENT" && x.ReferenceType == Common.SILA_REF_ADJUSTMENT && x.MovementType == "Z01"));
            }

            if (!string.IsNullOrWhiteSpace(request.Integration))
            {
                string integration = request.Integration.Trim();
                query = query.Where(x => x.IntegrationSystem != null && x.IntegrationSystem.Contains(integration));
            }

            if (search != null || material != null)
            {
                string term = search ?? material!;
                query = query.Where(x => x.ReferenceNumber.Contains(term)
                    || (x.ErpReference != null && x.ErpReference.Contains(term))
                    || (material != null && x.ReferenceNumber.Contains(material)));
            }

            query = ApplyPostingStatus(query, request.Status, request.Stage);
            if (!string.IsNullOrWhiteSpace(request.SourceSystem) && !"SILA".Contains(request.SourceSystem.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            List<InventoryErpPosting> postings = await query.OrderByDescending(x => x.DateCreated).Take(MAX_INDEX).ToListAsync(cancellationToken);
            Dictionary<Guid, (string? Property, string? Plant, string? Storage, string? Company)> places = await PlacesAsync(
                postings.Where(x => x.LocationId != null).Select(x => x.LocationId!.Value).Distinct().ToList(), cancellationToken);
            foreach (InventoryErpPosting posting in postings)
            {
                SilaTrackerRules.Stages stages = SilaTrackerRules.OfPosting(posting.Status, posting.Attempts, posting.ErpReference);
                if (!Keep(stages, request))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.TargetSystem)
                    && (posting.IntegrationSystem == null || !posting.IntegrationSystem.Contains(request.TargetSystem.Trim(), StringComparison.OrdinalIgnoreCase))
                    && !"SAP".Contains(request.TargetSystem.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                places.TryGetValue(posting.LocationId ?? Guid.Empty, out (string? Property, string? Plant, string? Storage, string? Company) place);
                Add(rows, summary, new SilaTrackerRowDto
                {
                    Id = SilaTrackerRules.Key(SilaTrackerRules.SOURCE_ERP, posting.Id),
                    Source = SilaTrackerRules.SOURCE_ERP,
                    OccurredOn = posting.DateCreated,
                    TransactionType = SilaTrackerRules.TransactionTypeOfPosting(posting.ReferenceType, posting.MovementType),
                    DataClass = SilaTrackerRules.DATA_TRANSACTION,
                    Direction = SilaTrackerRules.DIRECTION_OUTBOUND,
                    CompanyCode = posting.CompanyCode ?? place.Company,
                    PropertyName = place.Property,
                    Plant = place.Plant,
                    StorageLocation = place.Storage,
                    SourceSystem = "SILA",
                    TargetSystem = posting.IntegrationSystem ?? "SAP",
                    BusinessReference = posting.ReferenceNumber,
                    UserId = posting.CreatedBy == Guid.Empty ? null : posting.CreatedBy,
                    ReceiveStatus = stages.Receive,
                    ErpStatus = stages.Erp,
                    LocalStatus = stages.Local,
                    OverallStatus = stages.Overall,
                    RetryCount = posting.Attempts,
                    LastError = posting.ErrorMessage,
                    ErpReference = posting.ErpReference,
                    ErpHttpStatus = posting.ErpHttpStatus,
                    IntegrationName = posting.IntegrationSystem,
                    Action = stages.Action,
                    ReprocessFrom = stages.ReprocessFrom,
                    ErpCallAllowed = stages.ErpCallAllowed,
                    MovementType = posting.MovementType,
                    ErpPostingId = posting.Id
                });
            }
        }

        private async Task AddPosAsync(
            List<SilaTrackerRowDto> rows, SilaTrackerSummaryDto summary, Guid buyerId, GetSilaTransactionTrackerQuery request,
            DateTime from, DateTime to, string? search, string? material, List<Guid>? locations, CancellationToken cancellationToken)
        {
            if (request.Direction == SilaTrackerRules.DIRECTION_OUTBOUND || request.DataClass == SilaTrackerRules.DATA_MASTER)
            {
                return;
            }

            if (!MatchesSystem(request, "POS", "SILA"))
            {
                return;
            }

            IQueryable<PosSalesTransaction> query = _repository.PosSalesTransaction.FindByCondition(x => x.BuyerId == buyerId && x.IsActive
                && x.DateCreated >= from && x.DateCreated < to);
            if (locations != null)
            {
                query = query.Where(x => x.OutletLocationId != null && locations.Contains(x.OutletLocationId.Value));
            }

            if (request.UserId != null)
            {
                query = query.Where(x => x.CreatedBy == request.UserId);
            }

            if (!string.IsNullOrWhiteSpace(request.TransactionType))
            {
                string type = request.TransactionType.Trim();
                if (type == "POS_POSITIVE_CORRECTION")
                {
                    query = query.Where(x => x.QuantitySold < 0);
                }
                else if (type is "POS_SALE" or "RECIPE_CONSUMPTION" or "DIRECT_CONSUMPTION")
                {
                    query = query.Where(x => x.QuantitySold >= 0);
                }
                else
                {
                    return;
                }
            }

            if (search != null)
            {
                query = query.Where(x => x.SourceTransactionId.Contains(search) || x.PosCode.Contains(search) || x.OutletCode.Contains(search));
            }

            if (material != null)
            {
                query = query.Where(x => x.PosCode.Contains(material));
            }

            List<PosSalesTransaction> sales = await query.OrderByDescending(x => x.DateCreated).Take(MAX_INDEX).ToListAsync(cancellationToken);
            List<Guid> postingIds = sales.Where(x => x.ErpPostingId != null).Select(x => x.ErpPostingId!.Value).Distinct().ToList();
            Dictionary<Guid, InventoryErpPosting> postings = postingIds.Count == 0
                ? new Dictionary<Guid, InventoryErpPosting>()
                : await _repository.InventoryErpPosting.FindByCondition(x => postingIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            Dictionary<Guid, (string? Property, string? Plant, string? Storage, string? Company)> places = await PlacesAsync(
                sales.Where(x => x.OutletLocationId != null).Select(x => x.OutletLocationId!.Value).Distinct().ToList(), cancellationToken);
            foreach (PosSalesTransaction sale in sales)
            {
                InventoryErpPosting? posting = sale.ErpPostingId != null ? postings.GetValueOrDefault(sale.ErpPostingId.Value) : null;
                if (!string.IsNullOrWhiteSpace(request.CompanyCode) && (posting?.CompanyCode == null || !string.Equals(posting.CompanyCode, request.CompanyCode.Trim(), StringComparison.OrdinalIgnoreCase)))
                {
                    places.TryGetValue(sale.OutletLocationId ?? Guid.Empty, out (string? Property, string? Plant, string? Storage, string? Company) companyPlace);
                    if (!string.Equals(companyPlace.Company, request.CompanyCode.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }
                }

                SilaTrackerRules.Stages? postingStages = posting == null ? null : SilaTrackerRules.OfPosting(posting.Status, posting.Attempts, posting.ErpReference);
                SilaTrackerRules.Stages stages = SilaTrackerRules.OfPos(sale.Status, sale.FailedStep, postingStages);
                if (!Keep(stages, request))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.Integration) && (posting?.IntegrationSystem == null || !posting.IntegrationSystem.Contains(request.Integration.Trim(), StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                places.TryGetValue(sale.OutletLocationId ?? Guid.Empty, out (string? Property, string? Plant, string? Storage, string? Company) place);
                Add(rows, summary, new SilaTrackerRowDto
                {
                    Id = SilaTrackerRules.Key(SilaTrackerRules.SOURCE_POS, sale.Id),
                    Source = SilaTrackerRules.SOURCE_POS,
                    OccurredOn = sale.DateCreated,
                    BusinessDate = sale.BusinessDate,
                    TransactionType = sale.QuantitySold < 0 ? "POS_POSITIVE_CORRECTION" : "POS_SALE",
                    DataClass = SilaTrackerRules.DATA_TRANSACTION,
                    Direction = SilaTrackerRules.DIRECTION_INBOUND,
                    CompanyCode = posting?.CompanyCode ?? place.Company,
                    PropertyName = place.Property,
                    Plant = place.Plant,
                    StorageLocation = place.Storage,
                    SourceSystem = "POS",
                    TargetSystem = posting?.IntegrationSystem ?? "SILA",
                    BusinessReference = sale.SourceTransactionId,
                    UserId = sale.CreatedBy == Guid.Empty ? null : sale.CreatedBy,
                    ReceiveStatus = stages.Receive,
                    ErpStatus = stages.Erp,
                    LocalStatus = stages.Local,
                    OverallStatus = stages.Overall,
                    RetryCount = posting?.Attempts ?? 0,
                    LastError = sale.FailureMessage ?? posting?.ErrorMessage,
                    ErpReference = posting?.ErpReference,
                    ErpHttpStatus = posting?.ErpHttpStatus,
                    IntegrationName = posting?.IntegrationSystem,
                    Action = stages.Action,
                    ReprocessFrom = stages.ReprocessFrom,
                    ErpCallAllowed = stages.ErpCallAllowed,
                    PosCode = sale.PosCode,
                    OutletCode = sale.OutletCode,
                    Quantity = sale.QuantitySold,
                    Uom = sale.Uom,
                    RecipeVersion = sale.RecipeVersion,
                    MovementType = posting?.MovementType,
                    ErpPostingId = posting?.Id
                });
            }
        }

        private async Task AddPurchasesAsync(
            List<SilaTrackerRowDto> rows, SilaTrackerSummaryDto summary, Guid organizationId, GetSilaTransactionTrackerQuery request,
            DateTime from, DateTime to, string? search, List<Guid>? locations, CancellationToken cancellationToken)
        {
            if (locations != null || request.Direction == SilaTrackerRules.DIRECTION_INBOUND || request.DataClass == SilaTrackerRules.DATA_MASTER)
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(request.SourceSystem) && !"SILA".Contains(request.SourceSystem.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return;
            }

            IQueryable<PurchaseDocumentIntegration> query = _repository.PurchaseDocumentIntegration.FindByCondition(x => x.IsActive
                && x.BuyerOrganizationId == organizationId && x.DateCreated >= from && x.DateCreated < to);
            if (request.UserId != null)
            {
                query = query.Where(x => x.CreatedBy == request.UserId);
            }

            if (!string.IsNullOrWhiteSpace(request.TransactionType))
            {
                string type = request.TransactionType.Trim();
                query = query.Where(x => x.IntegrationType == type);
            }

            if (search != null)
            {
                query = query.Where(x => (x.ExternalDocumentNumber != null && x.ExternalDocumentNumber.Contains(search)) || x.IntegrationType.Contains(search));
            }

            List<PurchaseDocumentIntegration> documents = await query.OrderByDescending(x => x.DateCreated).Take(MAX_INDEX).ToListAsync(cancellationToken);
            List<Guid> orderIds = documents.Where(x => x.PurchaseOrderId != null).Select(x => x.PurchaseOrderId!.Value).Distinct().ToList();
            Dictionary<Guid, PurchaseOrder> orders = orderIds.Count == 0
                ? new Dictionary<Guid, PurchaseOrder>()
                : await _repository.PurchaseOrder.FindByCondition(x => orderIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            foreach (PurchaseDocumentIntegration document in documents)
            {
                orders.TryGetValue(document.PurchaseOrderId ?? Guid.Empty, out PurchaseOrder? order);
                if (!string.IsNullOrWhiteSpace(request.CompanyCode) && !string.Equals(order?.CompanyCode, request.CompanyCode.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.Plant) && !string.Equals(order?.PlantCode, request.Plant.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                SilaTrackerRules.Stages stages = SilaTrackerRules.OfPurchase(document.Status, document.OutcomeUnknown, document.ExternalDocumentNumber, document.RetryCount);
                if (!Keep(stages, request))
                {
                    continue;
                }

                string target = document.ResolvedErpType ?? "SAP";
                if (!string.IsNullOrWhiteSpace(request.TargetSystem) && !target.Contains(request.TargetSystem.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                Add(rows, summary, new SilaTrackerRowDto
                {
                    Id = SilaTrackerRules.Key(SilaTrackerRules.SOURCE_PO, document.Id),
                    Source = SilaTrackerRules.SOURCE_PO,
                    OccurredOn = document.DateCreated,
                    TransactionType = document.IntegrationType,
                    DataClass = SilaTrackerRules.DATA_TRANSACTION,
                    Direction = SilaTrackerRules.DIRECTION_OUTBOUND,
                    CompanyCode = order?.CompanyCode,
                    Plant = order?.PlantCode,
                    SourceSystem = "SILA",
                    TargetSystem = document.ResolvedErpType ?? "SAP",
                    BusinessReference = order?.PoNumber ?? document.ExternalDocumentNumber,
                    UserId = document.CreatedBy == Guid.Empty ? null : document.CreatedBy,
                    ReceiveStatus = stages.Receive,
                    ErpStatus = stages.Erp,
                    LocalStatus = stages.Local,
                    OverallStatus = stages.Overall,
                    RetryCount = document.RetryCount,
                    LastError = document.ErrorMessage,
                    ErpReference = document.ExternalDocumentNumber,
                    IntegrationName = document.IntegrationType,
                    Action = stages.Action,
                    ReprocessFrom = stages.ReprocessFrom,
                    ErpCallAllowed = stages.ErpCallAllowed
                });
            }
        }

        private async Task AddRunsAsync(
            List<SilaTrackerRowDto> rows, SilaTrackerSummaryDto summary, Guid organizationId, string[] processTypes,
            GetSilaTransactionTrackerQuery request, DateTime from, DateTime to, string? search, List<Guid>? locations, CancellationToken cancellationToken)
        {
            if (locations != null)
            {
                return;
            }

            List<Guid> configurationIds = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => IntegrationLookup.BuyerIdsOf(_repository, organizationId).Contains(x.BuyerId) && processTypes.Contains(x.ProcessType))
                .Select(x => x.Id)
                .ToListAsync(cancellationToken);
            if (configurationIds.Count == 0)
            {
                return;
            }

            IQueryable<ApiIntegrationExecution> query = _repository.ApiIntegrationExecution.FindByCondition(x => configurationIds.Contains(x.ConfigurationId)
                && x.StartedAt >= from && x.StartedAt < to);
            if (request.UserId != null)
            {
                query = query.Where(x => x.CreatedBy == request.UserId);
            }

            List<ApiIntegrationExecution> executions = await query.OrderByDescending(x => x.StartedAt).Take(MAX_INDEX).ToListAsync(cancellationToken);
            Dictionary<Guid, ApiIntegrationConfiguration> configurations = await _repository.ApiIntegrationConfiguration
                .FindByCondition(x => configurationIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);
            foreach (ApiIntegrationExecution execution in executions)
            {
                if (!configurations.TryGetValue(execution.ConfigurationId, out ApiIntegrationConfiguration? configuration))
                {
                    continue;
                }

                string direction = SilaTrackerRules.DirectionOfProcess(configuration.ProcessType);
                string dataClass = SilaTrackerRules.DataClassOfProcess(configuration.ProcessType);
                if (!string.IsNullOrWhiteSpace(request.Direction) && !string.Equals(request.Direction, direction, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.DataClass) && !string.Equals(request.DataClass, dataClass, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.TransactionType) && !string.Equals(request.TransactionType, configuration.ProcessType, StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.CompanyCode) && !string.Equals(configuration.EntityCode, request.CompanyCode.Trim(), StringComparison.OrdinalIgnoreCase)
                    && !string.Equals(configuration.EntityCode, "ALL", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (!string.IsNullOrWhiteSpace(request.Integration) && !configuration.Name.Contains(request.Integration.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }

                if (search != null && !configuration.Name.Contains(search, StringComparison.OrdinalIgnoreCase)
                    && (execution.ErrorMessageSafe == null || !execution.ErrorMessageSafe.Contains(search, StringComparison.OrdinalIgnoreCase)))
                {
                    continue;
                }

                if (!MatchesSystem(request, direction == SilaTrackerRules.DIRECTION_INBOUND ? configuration.SystemName ?? "SAP" : "SILA", direction == SilaTrackerRules.DIRECTION_INBOUND ? "SILA" : configuration.SystemName ?? "SAP"))
                {
                    continue;
                }

                SilaTrackerRules.Stages stages = SilaTrackerRules.OfRun(execution.Status.ToString(), execution.RecordsRead, execution.RecordsFailed, execution.Trigger.ToString());
                if (!Keep(stages, request))
                {
                    continue;
                }

                Add(rows, summary, new SilaTrackerRowDto
                {
                    Id = SilaTrackerRules.Key(SilaTrackerRules.SOURCE_RUN, execution.Id),
                    Source = SilaTrackerRules.SOURCE_RUN,
                    OccurredOn = execution.StartedAt,
                    TransactionType = configuration.ProcessType,
                    DataClass = dataClass,
                    Direction = direction,
                    CompanyCode = configuration.EntityCode,
                    SourceSystem = direction == SilaTrackerRules.DIRECTION_INBOUND ? configuration.SystemName ?? "SAP" : "SILA",
                    TargetSystem = direction == SilaTrackerRules.DIRECTION_INBOUND ? "SILA" : configuration.SystemName ?? "SAP",
                    BusinessReference = configuration.Name,
                    UserId = execution.CreatedBy == Guid.Empty ? null : execution.CreatedBy,
                    ReceiveStatus = stages.Receive,
                    ErpStatus = stages.Erp,
                    LocalStatus = stages.Local,
                    OverallStatus = stages.Overall,
                    RetryCount = 0,
                    LastError = execution.ErrorMessageSafe,
                    IntegrationName = configuration.Name,
                    Action = stages.Action,
                    ReprocessFrom = stages.ReprocessFrom,
                    ErpCallAllowed = stages.ErpCallAllowed
                });
            }
        }

        private static IQueryable<InventoryErpPosting> ApplyPostingStatus(IQueryable<InventoryErpPosting> query, string? status, string? stage)
        {
            if (string.Equals(stage, SilaTrackerRules.FROM_LOCAL, StringComparison.OrdinalIgnoreCase))
            {
                return query.Where(x => x.Status == Common.SILA_POSTING_FAILED_LOCAL || x.Status == Common.SILA_POSTING_ERP_ACCEPTED);
            }

            if (string.Equals(stage, SilaTrackerRules.FROM_ERP, StringComparison.OrdinalIgnoreCase))
            {
                return query.Where(x => x.Status == Common.SILA_POSTING_FAILED || x.Status == Common.SILA_POSTING_SKIPPED || x.Status == Common.SILA_POSTING_UNKNOWN);
            }

            if (string.Equals(stage, SilaTrackerRules.FROM_RECEIVE, StringComparison.OrdinalIgnoreCase))
            {
                return query.Where(x => false);
            }

            if (string.IsNullOrWhiteSpace(status))
            {
                return query;
            }

            return status.Trim().ToUpperInvariant() switch
            {
                SilaTrackerRules.OVERALL_SUCCESS => query.Where(x => x.Status == Common.SILA_POSTING_POSTED),
                SilaTrackerRules.OVERALL_FAILED_LOCAL => query.Where(x => x.Status == Common.SILA_POSTING_FAILED_LOCAL || x.Status == Common.SILA_POSTING_ERP_ACCEPTED),
                SilaTrackerRules.OVERALL_UNKNOWN => query.Where(x => x.Status == Common.SILA_POSTING_UNKNOWN),
                SilaTrackerRules.OVERALL_REPROCESSING => query.Where(x => x.Status == Common.SILA_POSTING_PENDING && x.Attempts > 0),
                SilaTrackerRules.OVERALL_FAILED => query.Where(x => (x.Status == Common.SILA_POSTING_FAILED || x.Status == Common.SILA_POSTING_SKIPPED) && x.ErpReference == null),
                SilaTrackerRules.OVERALL_PROCESSING or SilaTrackerRules.OVERALL_RECEIVED => query.Where(x => x.Status == Common.SILA_POSTING_PENDING && x.Attempts == 0),
                _ => query
            };
        }

        private static bool Keep(SilaTrackerRules.Stages stages, GetSilaTransactionTrackerQuery request)
        {
            if (!string.IsNullOrWhiteSpace(request.Status) && !string.Equals(stages.Overall, request.Status.Trim(), StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            if (string.IsNullOrWhiteSpace(request.Stage))
            {
                return true;
            }

            string stage = request.Stage.Trim();
            if (string.Equals(stage, SilaTrackerRules.FROM_LOCAL, StringComparison.OrdinalIgnoreCase))
            {
                return stages.Local == SilaTrackerRules.FAILED || stages.ReprocessFrom == SilaTrackerRules.FROM_LOCAL;
            }

            if (string.Equals(stage, SilaTrackerRules.FROM_ERP, StringComparison.OrdinalIgnoreCase))
            {
                return stages.Erp is SilaTrackerRules.FAILED or SilaTrackerRules.UNKNOWN or SilaTrackerRules.PROCESSING;
            }

            return stages.Receive != SilaTrackerRules.SUCCESS || stages.ReprocessFrom == SilaTrackerRules.FROM_RECEIVE;
        }

        private static bool MatchesSystem(GetSilaTransactionTrackerQuery request, string? source, string? target)
        {
            if (!string.IsNullOrWhiteSpace(request.SourceSystem) && (source == null || !source.Contains(request.SourceSystem.Trim(), StringComparison.OrdinalIgnoreCase)))
            {
                return false;
            }

            return string.IsNullOrWhiteSpace(request.TargetSystem) || (target != null && target.Contains(request.TargetSystem.Trim(), StringComparison.OrdinalIgnoreCase));
        }

        private static void Add(List<SilaTrackerRowDto> rows, SilaTrackerSummaryDto summary, SilaTrackerRowDto row)
        {
            rows.Add(row);
            switch (row.OverallStatus)
            {
                case SilaTrackerRules.OVERALL_SUCCESS:
                    summary.Successful++;
                    break;
                case SilaTrackerRules.OVERALL_FAILED:
                case SilaTrackerRules.OVERALL_PARTIAL:
                    summary.Failed++;
                    break;
                case SilaTrackerRules.OVERALL_FAILED_LOCAL:
                    summary.Failed++;
                    summary.NeedsAttention++;
                    break;
                case SilaTrackerRules.OVERALL_UNKNOWN:
                    summary.NeedsAttention++;
                    break;
                case SilaTrackerRules.OVERALL_REPROCESSING:
                    summary.Reprocessing++;
                    summary.Processing++;
                    break;
                default:
                    summary.Processing++;
                    break;
            }
        }

        private async Task<List<Guid>?> LocationIdsAsync(Guid buyerId, GetSilaTransactionTrackerQuery request, CancellationToken cancellationToken)
        {
            bool filtered = request.PropertyId != null || !string.IsNullOrWhiteSpace(request.Plant) || !string.IsNullOrWhiteSpace(request.StorageLocation);
            if (!filtered)
            {
                return null;
            }

            List<Guid>? plants = null;
            if (!string.IsNullOrWhiteSpace(request.Plant))
            {
                string plant = request.Plant.Trim();
                plants = await _repository.BuyerProperty.FindByCondition(x => x.BuyerId == buyerId && x.PlantCode != null && x.PlantCode == plant)
                    .Select(x => x.Id)
                    .ToListAsync(cancellationToken);
            }

            IQueryable<InventoryLocation> query = _repository.InventoryLocation.FindByCondition(x => x.BuyerId == buyerId && x.IsActive);
            if (request.PropertyId != null)
            {
                query = query.Where(x => x.PropertyId == request.PropertyId);
            }

            if (plants != null)
            {
                query = query.Where(x => plants.Contains(x.PropertyId));
            }

            if (!string.IsNullOrWhiteSpace(request.StorageLocation))
            {
                string storage = request.StorageLocation.Trim();
                query = query.Where(x => x.StorageLocationCode != null && x.StorageLocationCode == storage);
            }

            return await query.Select(x => x.Id).ToListAsync(cancellationToken);
        }

        private async Task<Dictionary<Guid, (string? Property, string? Plant, string? Storage, string? Company)>> PlacesAsync(List<Guid> locationIds, CancellationToken cancellationToken)
        {
            Dictionary<Guid, (string? Property, string? Plant, string? Storage, string? Company)> result = new Dictionary<Guid, (string?, string?, string?, string?)>();
            if (locationIds.Count == 0)
            {
                return result;
            }

            List<InventoryLocation> locations = await _repository.InventoryLocation.FindByCondition(x => locationIds.Contains(x.Id)).ToListAsync(cancellationToken);
            List<Guid> propertyIds = locations.Select(x => x.PropertyId).Distinct().ToList();
            Dictionary<Guid, BuyerProperty> properties = await _repository.BuyerProperty.FindByCondition(x => propertyIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, cancellationToken);
            foreach (InventoryLocation location in locations)
            {
                properties.TryGetValue(location.PropertyId, out BuyerProperty? property);
                result[location.Id] = (property?.PropertyName, property?.PlantCode, location.StorageLocationCode, property?.CompanyCode);
            }

            return result;
        }

        private static string NormalizeTracker(string? tracker)
        {
            if (string.Equals(tracker, SilaTrackerRules.TRACKER_PURCHASING, StringComparison.OrdinalIgnoreCase))
            {
                return SilaTrackerRules.TRACKER_PURCHASING;
            }

            if (string.Equals(tracker, SilaTrackerRules.TRACKER_SILA_ME, StringComparison.OrdinalIgnoreCase))
            {
                return SilaTrackerRules.TRACKER_SILA_ME;
            }

            throw new BadRequestCustomException("Tracker is not recognised.", "Choose Purchasing or SILA ME.");
        }
    }
}
