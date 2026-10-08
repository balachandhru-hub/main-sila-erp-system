using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Common;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;
using MaterialEntity = Buyer.Domain.Entities.ItemBuyerMaster;

namespace Buyer.Application.Features.Queries.GetSilaPosTransaction
{
    /// <summary>
    /// The transaction detail: the sale with its tracker steps, the exploded ingredient lines (its RECIPE_CONSUMPTION ledger lines),
    /// the timeline (receipt, the POS_SALE workflow events, and the ERP outcome of its posting) and the ERP posting itself.
    /// </summary>
    public class GetSilaPosTransactionQueryHandler : IRequestHandler<GetSilaPosTransactionQuery, SilaPosTransactionDetailDto>
    {
        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaPosTransactionQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<SilaPosTransactionDetailDto> Handle(GetSilaPosTransactionQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo($"Fetching POS transaction. OrganizationId: {request.OrganizationId}, TransactionId: {request.TransactionId}");

            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            PosSalesTransaction? transaction = await _repository.PosSalesTransaction
                .FindByCondition(x => x.Id == request.TransactionId && x.BuyerId == buyer.Id && x.IsActive)
                .FirstOrDefaultAsync(cancellationToken);
            if (transaction == null)
            {
                _logger.LogError($"POS transaction not found. TransactionId: {request.TransactionId}, BuyerId: {buyer.Id}");
                throw new NotFoundCustomException("Transaction not found.", "Select a POS transaction of this organization.");
            }

            if (!SilaAccess.HasFullAccess(request.RoleId))
            {
                if (transaction.OutletLocationId == null)
                {
                    _logger.LogError($"POS transaction without outlet hidden from a scoped user. TransactionId: {transaction.Id}, UserId: {request.UserId}");
                    throw new ForBiddenCustomException("No access to this transaction.", "Only users of the sale's outlet can open it.");
                }

                await SilaAccess.EnsureLocationAccessAsync(_repository, _logger, buyer.Id, request.UserId, request.RoleId, transaction.OutletLocationId.Value, cancellationToken);
            }

            InventoryErpPosting? posting = transaction.ErpPostingId == null
                ? null
                : await _repository.InventoryErpPosting
                    .FindByCondition(x => x.Id == transaction.ErpPostingId.Value && x.BuyerId == buyer.Id)
                    .FirstOrDefaultAsync(cancellationToken);
            InventoryLocation? location = transaction.OutletLocationId == null
                ? null
                : await _repository.InventoryLocation
                    .FindByCondition(x => x.Id == transaction.OutletLocationId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
            Recipe? recipe = transaction.RecipeId == null
                ? null
                : await _repository.Recipe
                    .FindByCondition(x => x.Id == transaction.RecipeId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
            PosSalesBatch? batch = transaction.BatchId == null
                ? null
                : await _repository.PosSalesBatch
                    .FindByCondition(x => x.Id == transaction.BatchId.Value)
                    .FirstOrDefaultAsync(cancellationToken);
            string? sourceName = batch?.PosSourceId == null
                ? null
                : await _repository.PosSource
                    .FindByCondition(x => x.Id == batch.PosSourceId.Value)
                    .Select(x => x.Name)
                    .FirstOrDefaultAsync(cancellationToken);

            List<InventoryTransaction> consumption = await _repository.InventoryTransaction
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceType == Common.SILA_REF_POS_SALE && x.ReferenceId == transaction.Id)
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);
            List<Guid> materialIds = consumption.Select(x => x.MaterialId).Distinct().ToList();
            Dictionary<Guid, MaterialEntity> materials = materialIds.Count == 0
                ? new Dictionary<Guid, MaterialEntity>()
                : await _repository.ItemBuyerMaster
                    .FindByCondition(x => x.BuyerId == buyer.Id && materialIds.Contains(x.Id))
                    .ToDictionaryAsync(x => x.Id, cancellationToken);
            List<InventoryWorkflowEvent> events = await _repository.InventoryWorkflowEvent
                .FindByCondition(x => x.BuyerId == buyer.Id && x.ReferenceType == Common.SILA_REF_POS_SALE && x.ReferenceId == transaction.Id && x.IsActive)
                .OrderBy(x => x.DateCreated)
                .ToListAsync(cancellationToken);

            List<Guid> userIds = events.Select(x => x.ActorUserId).Append(batch?.UploadedBy ?? Guid.Empty).Where(x => x != Guid.Empty).Distinct().ToList();
            List<IdentityUserDto> users = userIds.Count == 0 ? new List<IdentityUserDto>() : await _identityApiClient.GetUsersByIds(userIds, cancellationToken);
            Func<Guid, string?> nameOf = id => id == Guid.Empty ? "Scheduler" : users.FirstOrDefault(u => u.UserId == id)?.Name;

            SilaPosTransactionDetailDto result = new SilaPosTransactionDetailDto
            {
                Transaction = SilaPosTracker.ToDto(transaction, posting, location?.LocationName, recipe, batch?.BatchNumber, location?.LocationType),
                ErpRequest = posting?.ErpRequestPayload,
                ErpResponse = posting?.ErpResponsePayload,
                ErpHttpStatus = posting?.ErpHttpStatus,
                PosSourceName = sourceName,
                BatchStatus = batch == null ? null : (string.IsNullOrWhiteSpace(batch.Status) ? Common.SILA_POS_BATCH_PROCESSED : batch.Status),
                OutletLocationCode = location?.LocationCode,
                RecipeActiveVersion = recipe?.ActiveVersion,
                ErpMovementType = posting?.MovementType,
                ErpAttempts = posting?.Attempts ?? 0,
                ErpErrorMessage = posting?.ErrorMessage,
                ErpLastAttemptOn = posting == null || posting.Attempts == 0 ? null : posting.DateUpdated,
                Lines = consumption.Select(x => new SilaPosConsumptionLineDto
                {
                    Id = x.Id,
                    TransactionNumber = x.TransactionNumber,
                    MaterialId = x.MaterialId,
                    MaterialCode = materials.TryGetValue(x.MaterialId, out MaterialEntity? material) ? material.MaterialCode : null,
                    MaterialDescription = material?.Description,
                    Quantity = x.Quantity,
                    Uom = x.BaseUom,
                    UnitCost = x.UnitCost,
                    Value = x.Value,
                    DateCreated = x.DateCreated
                }).ToList()
            };

            result.Timeline.Add(new SilaPosTimelineEventDto
            {
                Action = Common.SILA_POS_RECEIVED,
                Comment = batch == null ? null : $"Batch {batch.BatchNumber}{(batch.FileName == null ? string.Empty : $" ({batch.FileName})")}",
                ActorName = batch == null ? null : nameOf(batch.UploadedBy),
                OccurredOn = transaction.DateCreated
            });
            result.Timeline.AddRange(events.Select(x => new SilaPosTimelineEventDto
            {
                Action = x.Action,
                Comment = x.Comment,
                ActorName = nameOf(x.ActorUserId),
                OccurredOn = x.DateCreated
            }));
            SilaPosTimelineEventDto? outcome = ErpOutcome(posting);
            if (outcome != null)
            {
                result.Timeline.Add(outcome);
            }

            result.Timeline = result.Timeline.OrderBy(x => x.OccurredOn).ToList();
            foreach (SilaPosTimelineEventDto item in result.Timeline)
            {
                (item.Step, item.Status) = SilaPosTracker.EventStep(item.Action);
            }

            result.FailureCode = result.Transaction.FailureCode;
            _logger.LogInfo($"POS transaction fetched. TransactionId: {transaction.Id}, Lines: {result.Lines.Count}, Events: {result.Timeline.Count}");
            return result;
        }

        /// <summary>The ERP result of the posting as a timeline entry (the posting job does not write POS events).</summary>
        private static SilaPosTimelineEventDto? ErpOutcome(InventoryErpPosting? posting)
        {
            if (posting == null || posting.Status == Common.SILA_POSTING_PENDING)
            {
                return null;
            }

            if (posting.Status == Common.SILA_POSTING_POSTED)
            {
                return new SilaPosTimelineEventDto
                {
                    Action = "ERP_POSTED",
                    Comment = posting.ErpReference == null ? "Posted to the ERP." : $"Material document {posting.ErpReference}.",
                    OccurredOn = posting.PostedOn ?? posting.DateUpdated
                };
            }

            return new SilaPosTimelineEventDto
            {
                Action = $"ERP_{posting.Status}",
                Comment = posting.ErrorMessage,
                OccurredOn = posting.DateUpdated
            };
        }
    }
}
