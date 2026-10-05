using Buyer.Application.Contracts;
using Buyer.Application.Features.Shared;
using Buyer.Domain.Dto;
using Buyer.Domain.Dtos;
using Buyer.Domain.Entities;
using Buyer.Infrastructure.Contracts.IRepository;
using MediatR;
using Microsoft.EntityFrameworkCore;
using SharedKernel.ExceptionHandler;
using SharedKernel.LoggerServices;

namespace Buyer.Application.Features.Queries.GetSilaAuditLog
{
    /// <summary>
    /// One page of the SILA ME workflow events (newest first) with the actor's name and the document number of the reference.
    /// Events are not tied to a location, so the log is limited to users who see every location of the buyer.
    /// </summary>
    public class GetSilaAuditLogQueryHandler : IRequestHandler<GetSilaAuditLogQuery, List<SilaAuditEventDto>>
    {
        private const int MAX_LIMIT = 200;
        private const int MAX_REFERENCE_TYPE_LENGTH = 50;

        private readonly IRepositoryWrapper _repository;
        private readonly ILoggerManager _logger;
        private readonly IIdentityApiClient _identityApiClient;

        public GetSilaAuditLogQueryHandler(IRepositoryWrapper repository, ILoggerManager logger, IIdentityApiClient identityApiClient)
        {
            _repository = repository;
            _logger = logger;
            _identityApiClient = identityApiClient;
        }

        public async Task<List<SilaAuditEventDto>> Handle(GetSilaAuditLogQuery request, CancellationToken cancellationToken)
        {
            _logger.LogInfo(
                $"Fetching audit log. OrganizationId: {request.OrganizationId}, ReferenceType: {request.ReferenceType}, ReferenceId: {request.ReferenceId}, Actor: {request.Actor}, Index: {request.Index}, Limit: {request.Limit}");

            if (!SilaAccess.HasFullAccess(request.RoleId))
            {
                _logger.LogError($"Audit log requested without full location access. UserId: {request.UserId}, RoleId: {request.RoleId}");
                throw new ForBiddenCustomException("Audit log not available.", "The audit log is available to buyer administrators, store managers and cost controllers.");
            }

            string? referenceType = string.IsNullOrWhiteSpace(request.ReferenceType) ? null : request.ReferenceType.Trim().ToUpperInvariant();
            if (referenceType != null && referenceType.Length > MAX_REFERENCE_TYPE_LENGTH)
            {
                _logger.LogError($"Audit reference type too long. Length: {referenceType.Length}");
                throw new BadRequestCustomException("Reference type is not valid.", "Choose a document type from the list.");
            }

            DateTime? from = request.From?.Date;
            DateTime? toExclusive = request.To?.Date.AddDays(1);
            if (from != null && toExclusive != null && from >= toExclusive)
            {
                _logger.LogError($"Audit period is reversed. From: {request.From:yyyy-MM-dd}, To: {request.To:yyyy-MM-dd}");
                throw new BadRequestCustomException("Period is not valid.", "The From date must be on or before the To date.");
            }

            int index = request.Index < 0 ? 0 : request.Index;
            int limit = request.Limit <= 0 ? 50 : Math.Min(request.Limit, MAX_LIMIT);
            BuyerBusinessProfile buyer = await SilaAccess.GetBuyerAsync(_repository, _logger, request.OrganizationId);
            IQueryable<InventoryWorkflowEvent> query = _repository.InventoryWorkflowEvent.FindByCondition(x => x.BuyerId == buyer.Id && x.IsActive);
            if (referenceType != null)
            {
                query = query.Where(x => x.ReferenceType == referenceType);
            }

            if (request.ReferenceId != null)
            {
                query = query.Where(x => x.ReferenceId == request.ReferenceId.Value);
            }

            if (request.Actor != null)
            {
                query = query.Where(x => x.ActorUserId == request.Actor.Value);
            }

            if (from != null)
            {
                query = query.Where(x => x.DateCreated >= from.Value);
            }

            if (toExclusive != null)
            {
                query = query.Where(x => x.DateCreated < toExclusive.Value);
            }

            List<InventoryWorkflowEvent> events = await query
                .OrderByDescending(x => x.DateCreated)
                .ThenByDescending(x => x.Id)
                .Skip(index)
                .Take(limit)
                .ToListAsync(cancellationToken);

            Dictionary<Guid, string> names = await GetActorNamesAsync(events, cancellationToken);
            Dictionary<Guid, string> numbers = await SilaAuditReferences.GetNumbersAsync(_repository, buyer.Id, events, cancellationToken);
            List<SilaAuditEventDto> result = events.Select(x => new SilaAuditEventDto
            {
                Id = x.Id,
                ReferenceType = x.ReferenceType,
                ReferenceId = x.ReferenceId,
                ReferenceNumber = numbers.TryGetValue(x.ReferenceId, out string? number) ? number : null,
                Action = x.Action,
                Comment = x.Comment,
                ActorUserId = x.ActorUserId,
                ActorName = names.TryGetValue(x.ActorUserId, out string? name) ? name : null,
                DateCreated = x.DateCreated
            }).ToList();

            _logger.LogInfo($"Audit log fetched. BuyerId: {buyer.Id}, Events: {result.Count}");
            return result;
        }

        /// <summary>Display names of the actors from Identity; the log still loads (without names) when Identity fails.</summary>
        private async Task<Dictionary<Guid, string>> GetActorNamesAsync(List<InventoryWorkflowEvent> events, CancellationToken cancellationToken)
        {
            List<Guid> actorIds = events.Select(x => x.ActorUserId).Where(x => x != Guid.Empty).Distinct().ToList();
            if (actorIds.Count == 0)
            {
                return new Dictionary<Guid, string>();
            }

            try
            {
                List<IdentityUserDto> users = await _identityApiClient.GetUsersByIds(actorIds, cancellationToken);
                return users
                    .GroupBy(x => x.UserId)
                    .ToDictionary(x => x.Key, x => string.IsNullOrWhiteSpace(x.First().Name) ? x.First().UserName : x.First().Name);
            }
            catch (Exception exception) when (exception is not OperationCanceledException)
            {
                string? detail = (exception as BaseCustomException)?.Description;
                _logger.LogError($"Audit actor names could not be loaded. Actors: {actorIds.Count}. Error: {exception.Message}{(detail != null ? $" | {detail}" : string.Empty)}");
                return new Dictionary<Guid, string>();
            }
        }
    }
}
